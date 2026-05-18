import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { LEAD_WEBHOOK_TARGET_FIELDS, generateFacebookVerifyToken, generateLeadWebhookKey, getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'

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
    settings = {
      ...settings,
      leadWebhookKey: generateLeadWebhookKey(),
      facebookLeadVerifyToken: settings.facebookLeadVerifyToken || generateFacebookVerifyToken(),
    }
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
          facebookLeadEnabled: settings.facebookLeadEnabled === true,
          facebookMessagesEnabled: settings.facebookMessagesEnabled === true,
          facebookLeadVerifyToken: settings.facebookLeadVerifyToken,
          facebookLeadPageAccessToken: settings.facebookLeadPageAccessToken || '',
          instagramMessagesPageAccessToken: settings.instagramMessagesPageAccessToken || '',
          facebookLeadApiVersion: settings.facebookLeadApiVersion || 'v23.0',
        },
      },
    })
  } else if (!settings.facebookLeadVerifyToken) {
    settings = { ...settings, facebookLeadVerifyToken: generateFacebookVerifyToken() }
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        settings: {
          ...current,
          facebookLeadVerifyToken: settings.facebookLeadVerifyToken,
          facebookLeadApiVersion: settings.facebookLeadApiVersion || 'v23.0',
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
    facebook: {
      enabled: settings.facebookLeadEnabled === true,
      messagesEnabled: settings.facebookMessagesEnabled === true,
      verifyToken: settings.facebookLeadVerifyToken || '',
      pageAccessToken: settings.facebookLeadPageAccessToken || '',
      instagramPageAccessToken: settings.instagramMessagesPageAccessToken || '',
      apiVersion: settings.facebookLeadApiVersion || 'v23.0',
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
  const incomingFacebook = body.facebook && typeof body.facebook === 'object' ? body.facebook : null
  const nextFacebookEnabled = incomingFacebook && typeof incomingFacebook.enabled === 'boolean'
    ? incomingFacebook.enabled
    : previous.facebookLeadEnabled === true
  const nextFacebookMessagesEnabled = incomingFacebook && typeof incomingFacebook.messagesEnabled === 'boolean'
    ? incomingFacebook.messagesEnabled
    : previous.facebookMessagesEnabled === true
  const nextFacebookVerifyToken = body.regenerateFacebookVerifyToken
    ? generateFacebookVerifyToken()
    : incomingFacebook && typeof incomingFacebook.verifyToken === 'string'
      ? incomingFacebook.verifyToken.trim() || previous.facebookLeadVerifyToken || generateFacebookVerifyToken()
      : previous.facebookLeadVerifyToken || generateFacebookVerifyToken()
  const nextFacebookPageAccessToken = incomingFacebook && typeof incomingFacebook.pageAccessToken === 'string'
    ? incomingFacebook.pageAccessToken.trim()
    : previous.facebookLeadPageAccessToken || ''
  const nextInstagramPageAccessToken = incomingFacebook && typeof incomingFacebook.instagramPageAccessToken === 'string'
    ? incomingFacebook.instagramPageAccessToken.trim()
    : previous.instagramMessagesPageAccessToken || ''
  const nextFacebookApiVersion = incomingFacebook && typeof incomingFacebook.apiVersion === 'string'
    ? incomingFacebook.apiVersion.trim() || 'v23.0'
    : previous.facebookLeadApiVersion || 'v23.0'

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
        facebookLeadEnabled: nextFacebookEnabled,
        facebookMessagesEnabled: nextFacebookMessagesEnabled,
        facebookLeadVerifyToken: nextFacebookVerifyToken,
        facebookLeadPageAccessToken: nextFacebookPageAccessToken,
        instagramMessagesPageAccessToken: nextInstagramPageAccessToken,
        facebookLeadApiVersion: nextFacebookApiVersion,
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
    facebook: {
      enabled: nextFacebookEnabled,
      messagesEnabled: nextFacebookMessagesEnabled,
      verifyToken: nextFacebookVerifyToken,
      pageAccessToken: nextFacebookPageAccessToken,
      instagramPageAccessToken: nextInstagramPageAccessToken,
      apiVersion: nextFacebookApiVersion,
    },
  })
}
