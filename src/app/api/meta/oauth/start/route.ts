import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import {
  META_OAUTH_STATE_COOKIE,
  encodeMetaOAuthState,
  generateMetaOAuthState,
  getMetaAppId,
  getMetaAppSecret,
  getMetaOAuthScopes,
  normalizeMetaApiVersion,
} from '@/lib/metaOAuth'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL('/settings/integrations', request.nextUrl.origin)
  url.searchParams.set('meta_error', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return redirectWithError(request, 'Unauthorized')
  if (!canManage(user)) return redirectWithError(request, 'Forbidden')

  const appId = getMetaAppId()
  const appSecret = getMetaAppSecret()
  if (!appId || !appSecret) {
    return redirectWithError(request, 'Add META_APP_ID and META_APP_SECRET in Vercel before connecting Meta.')
  }

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return redirectWithError(request, 'Organization not found')

  const settings = getLeadWebhookSettings(organization.settings)
  const version = normalizeMetaApiVersion(settings.facebookLeadApiVersion || 'v23.0')
  const redirectUri = new URL('/api/meta/oauth/callback', request.nextUrl.origin).toString()
  const state = generateMetaOAuthState()

  const loginUrl = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
  loginUrl.searchParams.set('client_id', appId)
  loginUrl.searchParams.set('redirect_uri', redirectUri)
  loginUrl.searchParams.set('state', state)
  loginUrl.searchParams.set('response_type', 'code')
  loginUrl.searchParams.set('scope', getMetaOAuthScopes().join(','))
  loginUrl.searchParams.set('auth_type', 'rerequest')

  const configurationId = (process.env.META_LOGIN_CONFIG_ID || '').trim()
  if (configurationId) loginUrl.searchParams.set('config_id', configurationId)

  const response = NextResponse.redirect(loginUrl)
  response.cookies.set(
    META_OAUTH_STATE_COOKIE,
    encodeMetaOAuthState({
      state,
      organizationId,
      userId: String(user.id || ''),
      createdAt: Date.now(),
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: 15 * 60,
      path: '/',
    }
  )
  return response
}
