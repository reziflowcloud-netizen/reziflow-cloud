import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { LEAD_WEBHOOK_TARGET_FIELDS, generateLeadWebhookKey, getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function normalizeAssignmentMode(value: unknown) {
  return value === 'single' || value === 'round_robin' ? value : 'off'
}

async function getOrganizationForUser(user: any) {
  const organizationId = getOrganizationId(user)
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, settings: true },
  })
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organization = await getOrganizationForUser(user)
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = settingsObject(organization.settings)
  let settings = getLeadWebhookSettings(current)

  if (!settings.leadWebhookKey) {
    settings = { ...settings, leadWebhookKey: generateLeadWebhookKey() }
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        settings: {
          ...current,
          leadWebhookEnabled: settings.leadWebhookEnabled !== false,
          leadWebhookKey: settings.leadWebhookKey,
          leadWebhookFieldMap: settings.leadWebhookFieldMap || [],
          leadWebhookAssignmentMode: settings.leadWebhookAssignmentMode || 'off',
          leadWebhookAssignmentUserId: settings.leadWebhookAssignmentUserId || null,
          leadWebhookAssignmentUserIds: settings.leadWebhookAssignmentUserIds || [],
          leadWebhookAssignmentCursor: settings.leadWebhookAssignmentCursor || 0,
        },
      },
    })
  }

  return NextResponse.json({
    slug: organization.slug,
    enabled: settings.leadWebhookEnabled !== false,
    key: settings.leadWebhookKey,
    fieldMap: settings.leadWebhookFieldMap || [],
    assignment: {
      mode: settings.leadWebhookAssignmentMode || 'off',
      userId: settings.leadWebhookAssignmentUserId || null,
      userIds: settings.leadWebhookAssignmentUserIds || [],
    },
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organization = await getOrganizationForUser(user)
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const current = settingsObject(organization.settings)
  const previous = getLeadWebhookSettings(current)
  const nextKey = body.regenerateKey ? generateLeadWebhookKey() : previous.leadWebhookKey || generateLeadWebhookKey()
  const nextEnabled = typeof body.enabled === 'boolean' ? body.enabled : previous.leadWebhookEnabled !== false
  const nextFieldMap = Array.isArray(body.fieldMap)
    ? body.fieldMap
        .map((item: any) => ({
          external: String(item?.external || '').trim(),
          target: String(item?.target || '').trim(),
        }))
        .filter((item: any) => item.external && LEAD_WEBHOOK_TARGET_FIELDS.includes(item.target))
    : previous.leadWebhookFieldMap || []
  const incomingAssignment = body.assignment && typeof body.assignment === 'object' ? body.assignment : null
  const nextAssignmentMode = incomingAssignment ? normalizeAssignmentMode(incomingAssignment.mode) : previous.leadWebhookAssignmentMode || 'off'
  const nextAssignmentUserId = incomingAssignment?.userId ? Number(incomingAssignment.userId) : previous.leadWebhookAssignmentUserId || null
  const nextAssignmentUserIds = Array.isArray(incomingAssignment?.userIds)
    ? incomingAssignment.userIds.map(Number).filter(Number.isFinite)
    : previous.leadWebhookAssignmentUserIds || []

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      settings: {
        ...current,
        leadWebhookEnabled: nextEnabled,
        leadWebhookKey: nextKey,
        leadWebhookFieldMap: nextFieldMap,
        leadWebhookAssignmentMode: nextAssignmentMode,
        leadWebhookAssignmentUserId: Number.isFinite(nextAssignmentUserId) ? nextAssignmentUserId : null,
        leadWebhookAssignmentUserIds: nextAssignmentUserIds,
      },
    },
  })

  return NextResponse.json({
    slug: organization.slug,
    enabled: nextEnabled,
    key: nextKey,
    fieldMap: nextFieldMap,
    assignment: {
      mode: nextAssignmentMode,
      userId: Number.isFinite(nextAssignmentUserId) ? nextAssignmentUserId : null,
      userIds: nextAssignmentUserIds,
    },
  })
}
