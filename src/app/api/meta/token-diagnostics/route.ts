import { NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function apiVersion(value: string) {
  return value.startsWith('v') ? value : `v${value || '23.0'}`
}

type TokenKind = 'facebook' | 'instagram'

const REQUIRED_PERMISSION_GROUPS: Record<TokenKind, { label: string; permissions: string[] }[]> = {
  facebook: [
    { label: 'pages_messaging', permissions: ['pages_messaging'] },
    { label: 'pages_manage_metadata', permissions: ['pages_manage_metadata'] },
  ],
  instagram: [
    {
      label: 'instagram_manage_messages / instagram_business_manage_messages',
      permissions: ['instagram_manage_messages', 'instagram_business_manage_messages'],
    },
    { label: 'pages_manage_metadata', permissions: ['pages_manage_metadata'] },
  ],
}

function configuredMetaAppAccessToken() {
  const direct = process.env.META_APP_ACCESS_TOKEN?.trim()
  if (direct) return direct

  const appId = process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim()
  if (appId && appSecret) return `${appId}|${appSecret}`
  return ''
}

function expectedMetaAppId() {
  return process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || ''
}

function tokenScopes(data: any) {
  const scopes = new Set<string>()
  if (Array.isArray(data?.scopes)) {
    data.scopes.forEach((scope: unknown) => {
      if (typeof scope === 'string') scopes.add(scope)
    })
  }
  if (Array.isArray(data?.granular_scopes)) {
    data.granular_scopes.forEach((scope: any) => {
      if (typeof scope?.scope === 'string') scopes.add(scope.scope)
    })
  }
  return Array.from(scopes).sort()
}

function missingPermissionGroups(kind: TokenKind, scopes: string[]) {
  const scopeSet = new Set(scopes)
  return REQUIRED_PERMISSION_GROUPS[kind]
    .filter(group => !group.permissions.some(permission => scopeSet.has(permission)))
    .map(group => group.label)
}

async function debugToken(token: string, version: string, kind: TokenKind) {
  const appAccessToken = configuredMetaAppAccessToken()
  const expectedAppId = expectedMetaAppId()
  const requiredPermissions = REQUIRED_PERMISSION_GROUPS[kind].map(group => group.label)

  if (!appAccessToken) {
    return {
      configured: false,
      requiredPermissions,
    }
  }

  const url = new URL(`https://graph.facebook.com/${apiVersion(version)}/debug_token`)
  url.searchParams.set('input_token', token)
  url.searchParams.set('access_token', appAccessToken)

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    const data = body?.data || {}
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        error: body?.error?.message || `Meta debug_token error ${response.status}`,
        requiredPermissions,
      }
    }

    const scopes = tokenScopes(data)
    return {
      configured: true,
      ok: true,
      appId: typeof data.app_id === 'string' ? data.app_id : data.app_id ? String(data.app_id) : '',
      appName: typeof data.application === 'string' ? data.application : '',
      type: typeof data.type === 'string' ? data.type : '',
      isValid: data.is_valid === true,
      expiresAt: typeof data.expires_at === 'number' && data.expires_at > 0 ? data.expires_at : null,
      scopes,
      granularScopes: Array.isArray(data.granular_scopes) ? data.granular_scopes : [],
      requiredPermissions,
      missingPermissions: missingPermissionGroups(kind, scopes),
      expectedAppId: expectedAppId || null,
      appMatchesExpected: expectedAppId && data.app_id ? String(data.app_id) === expectedAppId : null,
    }
  } catch (error: any) {
    return {
      configured: true,
      ok: false,
      error: error?.message || 'Unable to contact Meta debug_token',
      requiredPermissions,
    }
  }
}

async function inspectToken(label: string, token: string, version: string, kind: TokenKind) {
  if (!token) return { label, configured: false }

  const url = new URL(`https://graph.facebook.com/${apiVersion(version)}/me`)
  url.searchParams.set('fields', 'id,name,instagram_business_account{id,username},connected_instagram_account{id,username}')
  url.searchParams.set('access_token', token)
  const debug = debugToken(token, version, kind)

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        label,
        configured: true,
        ok: false,
        error: data?.error?.message || `Meta Graph API error ${response.status}`,
        debug: await debug,
      }
    }
    return { label, configured: true, ok: true, data, debug: await debug }
  } catch (error: any) {
    return {
      label,
      configured: true,
      ok: false,
      error: error?.message || 'Unable to contact Meta Graph API',
      debug: await debug,
    }
  }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const version = settings.facebookLeadApiVersion || 'v23.0'
  const [facebook, instagram] = await Promise.all([
    inspectToken('Facebook Page Access Token', settings.facebookLeadPageAccessToken || '', version, 'facebook'),
    inspectToken('Instagram Page Access Token', settings.instagramMessagesPageAccessToken || '', version, 'instagram'),
  ])

  return NextResponse.json({
    apiVersion: version,
    facebook,
    instagram,
    hint: 'Для ответов реальным Instagram-лидам Page Access Token должен быть выдан тем же Meta-приложением, у которого есть Advanced Access для instagram_manage_messages, и должен относиться к странице, связанной с нужным Instagram Business Account.',
  })
}
