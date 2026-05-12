import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLeadBody } from '@/lib/leads'
import { applyLeadWebhookMapping, getLeadWebhookSettings, keyMatches, sanitizeLeadWebhookPayload } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function parseTelegramLeadText(text: string) {
  const normalized = compactText(text)
  const phoneMatch = normalized.match(/(\+?\d[\d\s().-]{6,}\d)\s*$/)
  const phone = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, '') : ''
  const beforePhone = phoneMatch ? normalized.slice(0, phoneMatch.index).trim() : normalized

  const dateMatch = beforePhone.match(/(\d{2}\.\d{2}\.\d{4})\s*(\d{1,2}:\d{2})?/)
  const submittedAt = dateMatch ? compactText(dateMatch[0]) : ''
  let rest = dateMatch ? beforePhone.replace(dateMatch[0], '').trim() : beforePhone

  const windowMatch = rest.match(/(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})/)
  const contactWindow = windowMatch ? compactText(windowMatch[0]) : ''
  let serviceInterest = ''
  let fullName = ''

  if (windowMatch && typeof windowMatch.index === 'number') {
    serviceInterest = rest.slice(0, windowMatch.index).trim()
    fullName = rest.slice(windowMatch.index + windowMatch[0].length).trim()
  } else {
    const nameMatch = rest.match(/([A-ZА-ЯІЇЄҐŁŚŻŹĆŃÓ][A-Za-zА-Яа-яІіЇїЄєҐґŁłŚśŻżŹźĆćŃńÓó'’ -]{1,48})$/)
    if (nameMatch && typeof nameMatch.index === 'number') {
      serviceInterest = rest.slice(0, nameMatch.index).trim()
      fullName = nameMatch[1].trim()
    } else {
      serviceInterest = rest.trim()
    }
  }

  return {
    fullName,
    phone,
    serviceInterest,
    source: 'telegram',
    notes: [
      submittedAt ? `Submitted: ${submittedAt}` : '',
      contactWindow ? `Preferred time: ${contactWindow}` : '',
      `Telegram message: ${text}`,
    ].filter(Boolean).join('\n'),
  }
}

function getTelegramMessage(update: any) {
  return update?.message || update?.channel_post || update?.edited_message || update?.edited_channel_post || null
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'ReziFlow Telegram lead webhook is active' })
}

export async function POST(request: NextRequest, { params }: { params: { slug: string, key: string } }) {
  const body = await request.json().catch(() => ({}))
  const safePayload = sanitizeLeadWebhookPayload(body)
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  if (!keyMatches(settings.leadWebhookKey || '', params.key)) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source: 'telegram',
        payload: safePayload,
        error: 'Invalid webhook key',
      },
    })
    return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 })
  }

  const message = getTelegramMessage(body)
  const text = String(message?.text || message?.caption || '').trim()
  const chatId = message?.chat?.id ? String(message.chat.id) : ''
  const messageId = message?.message_id ? String(message.message_id) : ''

  if (!text) return NextResponse.json({ ok: true, skipped: true, reason: 'No text message' })

  const messengerId = chatId && messageId ? `telegram:${chatId}:${messageId}` : ''
  if (messengerId) {
    const existing = await (prisma as any).lead.findFirst({
      where: { organizationId: organization.id, messengerId },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ ok: true, duplicate: true, leadId: existing.id })
  }

  const parsed = parseTelegramLeadText(text)
  const mappedBody = applyLeadWebhookMapping(parsed, settings.leadWebhookFieldMap || [])
  const data = normalizeLeadBody({
    ...mappedBody,
    source: 'telegram',
    messengerId: messengerId || undefined,
  })

  if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'failed',
        source: 'telegram',
        payload: { raw: safePayload, mapped: sanitizeLeadWebhookPayload(mappedBody) },
        error: 'Telegram message does not contain recognizable lead data',
      },
    })
    return NextResponse.json({ error: 'Telegram message does not contain recognizable lead data' }, { status: 400 })
  }

  const lead = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.lead.create({
      data: {
        organizationId: organization.id,
        ...data,
      },
    })
    await tx.leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        leadId: created.id,
        status: 'created',
        source: 'telegram',
        payload: { raw: safePayload, mapped: sanitizeLeadWebhookPayload(mappedBody) },
      },
    })
    return created
  })

  return NextResponse.json({ ok: true, leadId: lead.id, lead }, { status: 201 })
}
