import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLeadBody } from '@/lib/leads'
import { applyLeadWebhookMapping, getLeadWebhookSettings, keyMatches, sanitizeLeadWebhookPayload, settingsObject } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function readWebhookKey(request: NextRequest, body: any) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  return request.headers.get('x-reziflow-key') || bearer || body?.apiKey || body?.key || ''
}

function appendPayloadNote(notes: string | null, payload: any) {
  const sourceNote = payload?.sourceName || payload?.campaign || payload?.formName
  const parts = [notes, sourceNote ? `Source details: ${sourceNote}` : 'Lead received via webhook'].filter(Boolean)
  return parts.join('\n')
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

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const body = await request.json().catch(() => ({}))
  const safePayload = sanitizeLeadWebhookPayload(body)
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
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

  const receivedKey = readWebhookKey(request, body)
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
