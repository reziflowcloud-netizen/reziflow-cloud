import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'
import { normalizeMetaApiVersion, unsubscribePageFromMeta } from '@/lib/metaOAuth'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = settingsObject(organization.settings)
  const settings = getLeadWebhookSettings(current)
  let unsubscribeWarning = ''

  if (settings.metaOAuthPageId && settings.facebookLeadPageAccessToken) {
    try {
      await unsubscribePageFromMeta(
        normalizeMetaApiVersion(settings.facebookLeadApiVersion),
        settings.metaOAuthPageId,
        settings.facebookLeadPageAccessToken
      )
    } catch (caught: any) {
      unsubscribeWarning = caught?.message || 'Meta webhook subscription could not be removed.'
    }
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      settings: {
        ...current,
        facebookLeadEnabled: false,
        facebookMessagesEnabled: false,
        facebookLeadPageAccessToken: '',
        instagramMessagesPageAccessToken: '',
        instagramDirectAccessToken: '',
        metaOAuthConnected: false,
        metaOAuthConnectedAt: '',
        metaOAuthUserId: '',
        metaOAuthUserName: '',
        metaOAuthPageId: '',
        metaOAuthPageName: '',
        metaOAuthInstagramId: '',
        metaOAuthInstagramUsername: '',
        metaOAuthPendingPages: [],
        metaOAuthPageCandidates: [],
        metaOAuthGrantedScopes: '',
        metaOAuthDeniedScopes: '',
        metaOAuthSubscriptionError: '',
        metaOAuthSubscribedAt: '',
      },
    },
  })

  return NextResponse.json({
    ok: true,
    unsubscribeWarning,
  })
}
