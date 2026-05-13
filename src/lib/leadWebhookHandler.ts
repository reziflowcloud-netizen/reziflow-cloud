import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLeadBody } from '@/lib/leads'
import { applyLeadWebhookMapping, getLeadWebhookSettings, keyMatches, sanitizeLeadWebhookPayload, settingsObject } from '@/lib/leadWebhook'

export function readWebhookKey(request: NextRequest, body: any, pathKey?: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  return request.headers.get('x-reziflow-key') || bearer || pathKey || request.nextUrl.searchParams.get('key') || body?.apiKey || body?.key || ''
}

function appendPayloadNote(notes: string | null, payload: any) {
  const sourceNote = payload?.sourceName || payload?.campaign || payload?.formName || payload?.form_name
  const parts = [notes, sourceNote ? `Source details: ${sourceNote}` : 'Lead received via webhook'].filter(Boolean)
  return parts.join('\n')
}

async function readWebhookBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return request.json().catch(() => ({}))
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text().catch(() => '')
    return Object.fromEntries(new URLSearchParams(text))
  }
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null)
    if (!formData) return {}
    return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : value.name]))
  }
  return request.json().catch(() => ({}))
}

function findPayloadValue(payload: any, names: string[]) {
  if (!payload || typeof payload !== 'object') return ''
  for (const name of names) {
    const value = payload[name]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  const normalizedNames = names.map(name => String(name).trim().toLowerCase())
  for (const key of Object.keys(payload)) {
    if (!normalizedNames.includes(String(key).trim().toLowerCase())) continue
    const value = payload[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  if (payload.rawSheetRow && typeof payload.rawSheetRow === 'object') {
    return findPayloadValue(payload.rawSheetRow, names)
  }
  return ''
}

function inferNextContactAtFromPreferredHours(payload: any) {
  const text = findPayloadValue(payload, ['Години', 'Годины', 'Час', 'Время', 'preferredHours', 'preferred_hours', 'callTime', 'call_time'])
    || String(payload?.nextContactNote || '').trim()
  const match = text.match(/(\d{1,2})(?:[.:](\d{2}))?/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next
}

async function resolveAssignedToId(organizationId: string, organizationSettings: unknown, mappedBody: Record<string, unknown>, settings: ReturnType<typeof getLeadWebhookSettings>) {
  if (mappedBody.assignedToId) return Number(mappedBody.assignedToId)
  if (settings.leadWebhookAssignmentMode === 'single' && settings.leadWebhookAssignmentUserId) {
    const user = await prisma.user.findFirst({
      where: { id: settings.leadWebhookAssignmentUserId, organizationId },
      select: { id: true },
    })
    return user?.id || null
  }
  if (settings.leadWebhookAssignmentMode === 'round_robin') {
    const userIds = settings.leadWebhookAssignmentUserIds || []
    if (userIds.length === 0) return null
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, organizationId },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const validIds = userIds.filter(id => users.some(user => user.id === id))
    if (validIds.length === 0) return null
    const cursor = settings.leadWebhookAssignmentCursor || 0
    const picked = validIds[cursor % validIds.length]
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...settingsObject(organizationSettings),
          leadWebhookAssignmentCursor: cursor + 1,
        },
      },
    })
    return picked
  }
  return null
}

export async function handleLeadWebhookPing(request: NextRequest, slug: string, pathKey?: string) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ ok: false, error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const receivedKey = readWebhookKey(request, {}, pathKey)
  if (!keyMatches(settings.leadWebhookKey || '', receivedKey)) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source: 'webhook-test',
        payload: { method: 'GET' },
        error: 'Invalid webhook key',
      },
    })
    return NextResponse.json({ ok: false, error: 'Invalid webhook key' }, { status: 401 })
  }

  await (prisma as any).leadWebhookLog.create({
    data: {
      organizationId: organization.id,
      status: 'ping',
      source: 'webhook-test',
      payload: { method: 'GET' },
    },
  })

  return NextResponse.json({ ok: true, message: 'ReziFlow lead webhook is connected' })
}

export async function handleLeadWebhookPost(request: NextRequest, slug: string, pathKey?: string) {
  const body = await readWebhookBody(request)
  const safePayload = sanitizeLeadWebhookPayload(body)
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  if (settings.leadWebhookEnabled === false) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source: body?.source || null,
        payload: safePayload,
        error: 'Lead webhook is disabled',
      },
    })
    return NextResponse.json({ error: 'Lead webhook is disabled' }, { status: 403 })
  }

  const receivedKey = readWebhookKey(request, body, pathKey)
  if (!keyMatches(settings.leadWebhookKey || '', receivedKey)) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source: body?.source || null,
        payload: safePayload,
        error: 'Invalid webhook key',
      },
    })
    return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 })
  }

  const mappedBody = applyLeadWebhookMapping(body, settings.leadWebhookFieldMap || [])
  const assignedToId = await resolveAssignedToId(organization.id, organization.settings, mappedBody, settings)
  const data = normalizeLeadBody({
    ...mappedBody,
    assignedToId: assignedToId || mappedBody.assignedToId,
    source: mappedBody.source || body.source || 'website',
    nextContactAt: mappedBody.nextContactAt || body.nextContactAt || inferNextContactAtFromPreferredHours({ ...body, ...mappedBody }),
  })

  if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'failed',
        source: data.source || null,
        payload: { raw: safePayload, mapped: sanitizeLeadWebhookPayload(mappedBody) },
        error: 'Provide firstName, lastName, fullName, phone, email, Instagram or Facebook',
      },
    })
    return NextResponse.json({ error: 'Provide firstName, lastName, fullName, phone, email, Instagram or Facebook' }, { status: 400 })
  }

  const lead = await (prisma as any).$transaction(async (tx: any) => {
    const duplicateWhere: any[] = []
    if (data.phone) duplicateWhere.push({ phone: data.phone })
    if (data.email) duplicateWhere.push({ email: data.email })
    if (data.instagram) duplicateWhere.push({ instagram: data.instagram })
    if (data.facebook) duplicateWhere.push({ facebook: data.facebook })

    if (duplicateWhere.length) {
      const duplicate = await tx.lead.findFirst({
        where: {
          organizationId: organization.id,
          source: data.source || undefined,
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
          OR: duplicateWhere,
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (duplicate) {
        await tx.leadWebhookLog.create({
          data: {
            organizationId: organization.id,
            leadId: duplicate.id,
            status: 'duplicate',
            source: data.source || null,
            payload: { raw: safePayload, mapped: sanitizeLeadWebhookPayload(mappedBody) },
          },
        })
        return duplicate
      }
    }

    const created = await tx.lead.create({
      data: {
        organizationId: organization.id,
        ...data,
        notes: appendPayloadNote(data.notes, body),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    })
    await tx.leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        leadId: created.id,
        status: 'created',
        source: data.source || null,
        payload: { raw: safePayload, mapped: sanitizeLeadWebhookPayload(mappedBody) },
      },
    })
    return created
  })

  return NextResponse.json({ ok: true, leadId: lead.id, lead }, { status: 201 })
}
