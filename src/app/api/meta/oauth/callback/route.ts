import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'
import {
  META_OAUTH_STATE_COOKIE,
  MetaGraphPage,
  decodeMetaOAuthState,
  getMetaAppId,
  getMetaAppSecret,
  graphJson,
  normalizeMetaApiVersion,
} from '@/lib/metaOAuth'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function integrationRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/settings/integrations', request.nextUrl.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  const response = NextResponse.redirect(url)
  response.cookies.delete(META_OAUTH_STATE_COOKIE)
  return response
}

function noPagesMessage(grantedScopes: string) {
  const granted = new Set(grantedScopes.split(',').map(scope => scope.trim()).filter(Boolean))
  const missing = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata']
    .filter(scope => grantedScopes && !granted.has(scope))
  const missingText = missing.length ? ` Missing scopes: ${missing.join(', ')}.` : ''
  return `Meta connected the user, but returned no Facebook Pages. In the Meta dialog click "Edit settings" and allow access to the Facebook Page, or remove this app from Facebook Business Integrations and connect again.${missingText}`
}

async function exchangeCodeForUserToken(version: string, appId: string, appSecret: string, redirectUri: string, code: string) {
  const codeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  codeUrl.searchParams.set('client_id', appId)
  codeUrl.searchParams.set('client_secret', appSecret)
  codeUrl.searchParams.set('redirect_uri', redirectUri)
  codeUrl.searchParams.set('code', code)
  const codeData = await graphJson(codeUrl)
  const shortToken = String(codeData?.access_token || '').trim()
  if (!shortToken) throw new Error('Meta did not return a user access token.')

  const exchangeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
  exchangeUrl.searchParams.set('client_id', appId)
  exchangeUrl.searchParams.set('client_secret', appSecret)
  exchangeUrl.searchParams.set('fb_exchange_token', shortToken)

  try {
    const exchangeData = await graphJson(exchangeUrl)
    return String(exchangeData?.access_token || shortToken).trim()
  } catch {
    return shortToken
  }
}

async function fetchMetaUser(version: string, userToken: string) {
  const url = new URL(`https://graph.facebook.com/${version}/me`)
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('access_token', userToken)
  const data = await graphJson(url)
  return {
    id: String(data?.id || '').trim(),
    name: String(data?.name || '').trim(),
  }
}

async function fetchMetaPages(version: string, userToken: string) {
  const pages: MetaGraphPage[] = []
  let nextUrl: URL | null = new URL(`https://graph.facebook.com/${version}/me/accounts`)
  nextUrl.searchParams.set('fields', 'id,name,access_token,tasks,instagram_business_account{id,username},connected_instagram_account{id,username}')
  nextUrl.searchParams.set('limit', '100')
  nextUrl.searchParams.set('access_token', userToken)

  while (nextUrl) {
    const data = await graphJson(nextUrl)
    const items = Array.isArray(data?.data) ? data.data : []
    for (const item of items) {
      const id = String(item?.id || '').trim()
      const name = String(item?.name || '').trim()
      const accessToken = String(item?.access_token || '').trim()
      if (!id || !name || !accessToken) continue

      pages.push({
        id,
        name,
        accessToken,
        tasks: Array.isArray(item?.tasks) ? item.tasks.map(String).filter(Boolean) : [],
        instagramBusinessAccount: item?.instagram_business_account && typeof item.instagram_business_account === 'object'
          ? {
              id: String(item.instagram_business_account.id || '').trim(),
              username: String(item.instagram_business_account.username || '').trim(),
            }
          : null,
        connectedInstagramAccount: item?.connected_instagram_account && typeof item.connected_instagram_account === 'object'
          ? {
              id: String(item.connected_instagram_account.id || '').trim(),
              username: String(item.connected_instagram_account.username || '').trim(),
            }
          : null,
      })
    }

    const next = typeof data?.paging?.next === 'string' ? data.paging.next : ''
    nextUrl = next ? new URL(next) : null
  }

  return pages
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return integrationRedirect(request, { meta_error: 'Unauthorized' })
  if (!canManage(user)) return integrationRedirect(request, { meta_error: 'Forbidden' })

  const error = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error')
  if (error) return integrationRedirect(request, { meta_error: error })

  const returnedState = request.nextUrl.searchParams.get('state') || ''
  const storedState = decodeMetaOAuthState(request.cookies.get(META_OAUTH_STATE_COOKIE)?.value)
  const organizationId = getOrganizationId(user)
  if (!storedState || storedState.state !== returnedState || storedState.organizationId !== organizationId) {
    return integrationRedirect(request, { meta_error: 'Meta connection state is invalid or expired. Please try again.' })
  }
  if (Date.now() - storedState.createdAt > 15 * 60 * 1000) {
    return integrationRedirect(request, { meta_error: 'Meta connection session expired. Please try again.' })
  }

  const code = request.nextUrl.searchParams.get('code') || ''
  if (!code) return integrationRedirect(request, { meta_error: 'Meta did not return an authorization code.' })
  const grantedScopes = request.nextUrl.searchParams.get('granted_scopes') || ''
  const deniedScopes = request.nextUrl.searchParams.get('denied_scopes') || ''

  const appId = getMetaAppId()
  const appSecret = getMetaAppSecret()
  if (!appId || !appSecret) {
    return integrationRedirect(request, { meta_error: 'META_APP_ID or META_APP_SECRET is missing.' })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, settings: true },
  })
  if (!organization) return integrationRedirect(request, { meta_error: 'Organization not found' })

  const current = settingsObject(organization.settings)
  const settings = getLeadWebhookSettings(current)
  const version = normalizeMetaApiVersion(settings.facebookLeadApiVersion || 'v23.0')
  const redirectUri = new URL('/api/meta/oauth/callback', request.nextUrl.origin).toString()

  try {
    const userToken = await exchangeCodeForUserToken(version, appId, appSecret, redirectUri, code)
    const [metaUser, pages] = await Promise.all([
      fetchMetaUser(version, userToken),
      fetchMetaPages(version, userToken),
    ])

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        settings: {
          ...current,
          metaOAuthConnected: false,
          metaOAuthUserId: metaUser.id,
          metaOAuthUserName: metaUser.name,
          metaOAuthPendingPages: pages,
          metaOAuthGrantedScopes: grantedScopes,
          metaOAuthDeniedScopes: deniedScopes,
          metaOAuthSubscriptionError: '',
          facebookLeadApiVersion: version,
        },
      },
    })

    if (!pages.length) {
      return integrationRedirect(request, { meta_error: noPagesMessage(grantedScopes) })
    }

    return integrationRedirect(request, { meta_oauth: 'select' })
  } catch (caught: any) {
    return integrationRedirect(request, { meta_error: caught?.message || 'Meta OAuth connection failed.' })
  }
}
