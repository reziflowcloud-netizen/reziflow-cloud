import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

const REQUIRED_FIELDS = ['messages', 'message_echoes']
const OPTIONAL_FIELDS = ['message_deliveries', 'message_reads', 'messaging_postbacks']

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function apiVersion(value: string) {
  return value.startsWith('v') ? value : `v${value || '23.0'}`
}

async function loadMetaSettings(user: any) {
  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return null

  const settings = getLeadWebhookSettings(organization.settings)
  return {
    token: settings.facebookLeadPageAccessToken || '',
    version: apiVersion(settings.facebookLeadApiVersion || 'v23.0'),
  }
}

async function graphJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || data?.error || `Meta request failed with status ${response.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return data
}

async function pageInfo(version: string, token: string) {
  const url = new URL(`https://graph.facebook.com/${version}/me`)
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('access_token', token)
  const data = await graphJson(url)
  return {
    id: String(data?.id || '').trim(),
    name: String(data?.name || '').trim(),
  }
}

async function subscribedApps(version: string, pageId: string, token: string) {
  const url = new URL(`https://graph.facebook.com/${version}/${pageId}/subscribed_apps`)
  url.searchParams.set('fields', 'name,subscribed_fields')
  url.searchParams.set('access_token', token)
  const data = await graphJson(url)
  return Array.isArray(data?.data) ? data.data : []
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await loadMetaSettings(user)
  if (!settings) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  if (!settings.token) return NextResponse.json({ error: 'Facebook Page Access Token is empty' }, { status: 400 })

  try {
    const page = await pageInfo(settings.version, settings.token)
    if (!page.id) return NextResponse.json({ error: 'Meta did not return a Page id for this token' }, { status: 400 })
    const apps = await subscribedApps(settings.version, page.id, settings.token)
    return NextResponse.json({ page, apps, requiredFields: REQUIRED_FIELDS, optionalFields: OPTIONAL_FIELDS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Meta subscription check failed' }, { status: 400 })
  }
}

export async function POST(_request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await loadMetaSettings(user)
  if (!settings) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  if (!settings.token) return NextResponse.json({ error: 'Facebook Page Access Token is empty' }, { status: 400 })

  try {
    const page = await pageInfo(settings.version, settings.token)
    if (!page.id) return NextResponse.json({ error: 'Meta did not return a Page id for this token' }, { status: 400 })

    const url = new URL(`https://graph.facebook.com/${settings.version}/${page.id}/subscribed_apps`)
    const body = new URLSearchParams()
    body.set('access_token', settings.token)
    body.set('subscribed_fields', [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].join(','))
    await graphJson(url, { method: 'POST', body })

    const apps = await subscribedApps(settings.version, page.id, settings.token)
    return NextResponse.json({ ok: true, page, apps, requiredFields: REQUIRED_FIELDS, optionalFields: OPTIONAL_FIELDS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Meta subscription update failed' }, { status: 400 })
  }
}
