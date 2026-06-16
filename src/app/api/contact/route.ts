import { NextRequest, NextResponse } from 'next/server'
import { ensureDefaultOrganization } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'
import { sendContactNotification } from '@/lib/emailNotifications'

export const dynamic = 'force-dynamic'

function cleanField(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const honeypot = cleanField(body.website, 120)

  if (honeypot) {
    return NextResponse.json({ ok: true, emailSent: false })
  }

  const name = cleanField(body.name, 160)
  const contact = cleanField(body.contact, 220)
  const company = cleanField(body.company, 220)
  const message = cleanField(body.message, 1200)
  const page = cleanField(body.page, 300) || request.headers.get('referer') || 'contact'

  if (!name || !contact) {
    return NextResponse.json({ error: 'Name and contact are required' }, { status: 400 })
  }

  const organization = await ensureDefaultOrganization()
  const defaultStatus = await (prisma as any).leadStatus.findFirst({
    where: { organizationId: organization.id },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { name: true },
  })
  const owner = await prisma.user.findFirst({
    where: { organizationId: organization.id, role: { in: ['owner', 'admin'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const isEmail = looksLikeEmail(contact)
  const isHandle = contact.startsWith('@')
  const notes = [
    'Заявка с публичного сайта LegalHub CRM',
    `Страница: ${page}`,
    company ? `Компания: ${company}` : '',
    `Контакт: ${contact}`,
    message ? `Комментарий: ${message}` : '',
  ].filter(Boolean).join('\n')

  const lead = await (prisma as any).lead.create({
    data: {
      organizationId: organization.id,
      assignedToId: owner?.id || null,
      status: defaultStatus?.name || undefined,
      source: 'website',
      fullName: name,
      phone: !isEmail && !isHandle ? contact : null,
      email: isEmail ? contact : null,
      messengerId: isHandle ? contact : null,
      serviceInterest: 'LegalHub CRM',
      notes,
    },
    select: { id: true },
  })

  const email = await sendContactNotification({
    subject: 'Новая заявка с сайта LegalHub CRM',
    title: 'Новая заявка с сайта LegalHub CRM',
    replyTo: isEmail ? contact : null,
    lines: [
      ['Имя', name],
      ['Контакт', contact],
      ['Компания', company],
      ['Страница', page],
      ['ID лида', lead.id],
    ],
    message,
  })

  return NextResponse.json({ ok: true, leadId: lead.id, emailSent: email.sent })
}
