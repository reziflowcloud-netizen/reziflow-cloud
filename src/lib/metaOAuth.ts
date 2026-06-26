import { randomBytes } from 'crypto'

export const META_OAUTH_STATE_COOKIE = 'legalhub-meta-oauth-state'

export const META_MESSAGE_FIELDS = [
  'messages',
  'message_echoes',
  'message_deliveries',
  'message_reads',
  'messaging_postbacks',
]

const DEFAULT_META_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_messages',
]

export type MetaOAuthState = {
  state: string
  organizationId: string
  userId: string
  createdAt: number
}

export type MetaGraphPage = {
  id: string
  name: string
  accessToken: string
  tasks: string[]
  instagramBusinessAccount: {
    id?: string
    username?: string
  } | null
  connectedInstagramAccount: {
    id?: string
    username?: string
  } | null
}

export function normalizeMetaApiVersion(value?: string) {
  const version = String(value || process.env.META_GRAPH_API_VERSION || 'v23.0').trim()
  if (!version) return 'v23.0'
  return version.startsWith('v') ? version : `v${version}`
}

export function getMetaAppId() {
  return (process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '').trim()
}

export function getMetaAppSecret() {
  return (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim()
}

export function getMetaOAuthScopes() {
  const configured = (process.env.META_OAUTH_SCOPES || '').trim()
  if (!configured) return DEFAULT_META_SCOPES
  return configured
    .split(/[,\s]+/)
    .map(scope => scope.trim())
    .filter(Boolean)
}

export function generateMetaOAuthState() {
  return randomBytes(24).toString('hex')
}

export function encodeMetaOAuthState(payload: MetaOAuthState) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeMetaOAuthState(value: string | undefined): MetaOAuthState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    return {
      state: String(parsed.state || ''),
      organizationId: String(parsed.organizationId || ''),
      userId: String(parsed.userId || ''),
      createdAt: Number(parsed.createdAt || 0),
    }
  } catch {
    return null
  }
}

export async function graphJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || data?.error || `Meta request failed with status ${response.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return data
}

export async function subscribePageToMetaMessages(version: string, pageId: string, pageAccessToken: string) {
  const url = new URL(`https://graph.facebook.com/${normalizeMetaApiVersion(version)}/${pageId}/subscribed_apps`)
  const body = new URLSearchParams()
  body.set('access_token', pageAccessToken)
  body.set('subscribed_fields', META_MESSAGE_FIELDS.join(','))
  return graphJson(url, { method: 'POST', body })
}

export function publicMetaPage(page: MetaGraphPage) {
  return {
    id: page.id,
    name: page.name,
    tasks: page.tasks,
    instagramBusinessAccount: page.instagramBusinessAccount,
    connectedInstagramAccount: page.connectedInstagramAccount,
  }
}
