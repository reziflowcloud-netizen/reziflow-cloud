import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { POST as postForOrganizationSlug } from './[slug]/route'

export const dynamic = 'force-dynamic'

function stringValue(value: unknown) {
  return String(value || '').trim()
}

function inferChannel(body: any) {
  return String(body?.object || '').toLowerCase() === 'instagram' ? 'instagram' : 'facebook'
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function collectMetaBusinessIds(body: any) {
  const ids: string[] = []
  const entries = Array.isArray(body?.entry) ? body.entry : []

  for (const entry of entries) {
    ids.push(stringValue(entry?.id))

    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : []
    for (const event of messaging) {
      ids.push(stringValue(event?.recipient?.id))
      if (event?.message?.is_echo === true) ids.push(stringValue(event?.sender?.id))
    }

    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      ids.push(
        stringValue(change?.value?.page_id),
        stringValue(change?.value?.recipient?.id),
        stringValue(change?.value?.sender?.id)
      )
    }
  }

  return uniqueIds(ids)
}

function globalMetaVerifyToken() {
  return (
    process.env.META_MESSAGES_VERIFY_TOKEN ||
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    ''
  ).trim()
}

async function verifyTokenBelongsToAnyOrganization(token: string) {
  const organizations = await prisma.organization.findMany({
    select: { settings: true },
  })
  return organizations.some(organization => {
    const settings = getLeadWebhookSettings(organization.settings)
    return Boolean(settings.facebookLeadVerifyToken && settings.facebookLeadVerifyToken === token)
  })
}

async function findOrganizationForMetaMessages(body: any) {
  const channel = inferChannel(body)
  const ids = collectMetaBusinessIds(body)
  if (!ids.length) return null

  const organizations = await prisma.organization.findMany({
    select: { slug: true, settings: true },
    orderBy: { updatedAt: 'desc' },
  })

  const connected = organizations
    .map(organization => ({
      slug: organization.slug,
      settings: getLeadWebhookSettings(organization.settings),
    }))
    .filter(organization => organization.settings.facebookMessagesEnabled)

  if (channel === 'instagram') {
    const byInstagram = connected.find(organization => (
      organization.settings.metaOAuthInstagramId &&
      ids.includes(organization.settings.metaOAuthInstagramId)
    ))
    if (byInstagram) return byInstagram
  }

  const byPage = connected.find(organization => (
    organization.settings.metaOAuthPageId &&
    ids.includes(organization.settings.metaOAuthPageId)
  ))
  if (byPage) return byPage

  return connected.find(organization => (
    organization.settings.metaOAuthInstagramId &&
    ids.includes(organization.settings.metaOAuthInstagramId)
  )) || null
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token') || ''
  const challenge = request.nextUrl.searchParams.get('hub.challenge') || ''

  if (mode !== 'subscribe' || !token) {
    return new NextResponse('Invalid webhook verification request', { status: 403 })
  }

  const globalToken = globalMetaVerifyToken()
  if (globalToken && token === globalToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  if (await verifyTokenBelongsToAnyOrganization(token)) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Invalid verify token', { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}))
  const organization = await findOrganizationForMetaMessages(body)

  if (!organization) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      ignored: true,
      reason: 'No LegalHub organization is connected to the Meta Page or Instagram Business account from this webhook event.',
      metaIds: collectMetaBusinessIds(body),
    })
  }

  return postForOrganizationSlug(request, { params: { slug: organization.slug } })
}
