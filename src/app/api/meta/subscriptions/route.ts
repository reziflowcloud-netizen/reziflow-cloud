import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { META_MESSAGE_FIELDS, graphJson, normalizeMetaApiVersion, subscribePageToMetaMessages } from '@/lib/metaOAuth'

export const dynamic = 'force-dynamic'

const REQUIRED_FIELDS = ['messages', 'message_echoes']
const OPTIONAL_FIELDS = META_MESSAGE_FIELDS.filter(field => !REQUIRED_FIELDS.includes(field))

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
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
    version: normalizeMetaApiVersion(settings.facebookLeadApiVersion || 'v23.0'),
  }
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

    await subscribePageToMetaMessages(settings.version, page.id, settings.token)

    const apps = await subscribedApps(settings.version, page.id, settings.token)
    return NextResponse.json({ ok: true, page, apps, requiredFields: REQUIRED_FIELDS, optionalFields: OPTIONAL_FIELDS })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Meta subscription update failed' }, { status: 400 })
  }
}
