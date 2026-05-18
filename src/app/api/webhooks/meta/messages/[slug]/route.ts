import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLeadWebhookSettings, sanitizeLeadWebhookPayload } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

type MetaMessagingEvent = {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: any[]
  }
  postback?: {
    title?: string
    payload?: string
  }
}

function collectMessagingEvents(body: any): MetaMessagingEvent[] {
  const entries = Array.isArray(body?.entry) ? body.entry : []
  const events: MetaMessagingEvent[] = []

  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : []
    for (const event of messaging) events.push(event)
  }

  return events
}

function messageText(event: MetaMessagingEvent) {
  const text = String(event.message?.text || '').trim()
  if (text) return text
  const postbackTitle = String(event.postback?.title || '').trim()
  if (postbackTitle) return postbackTitle
  const postbackPayload = String(event.postback?.payload || '').trim()
  if (postbackPayload) return postbackPayload
  if (Array.isArray(event.message?.attachments) && event.message.attachments.length > 0) return '[Вложение]'
  return ''
}

function inferChannel(body: any) {
  return String(body?.object || '').toLowerCase() === 'instagram' ? 'instagram' : 'facebook'
}

function sourceLabel(channel: string) {
  return channel === 'instagram' ? 'Instagram' : 'Facebook'
}

function pageAccessTokenForChannel(settings: ReturnType<typeof getLeadWebhookSettings>, channel: string) {
  if (channel === 'instagram') {
    return settings.instagramMessagesPageAccessToken || settings.facebookLeadPageAccessToken || ''
  }
  return settings.facebookLeadPageAccessToken || ''
}

async function fetchProfile(senderId: string, accessToken: string, apiVersion: string) {
  if (!accessToken) return null
  const version = apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`
  const url = new URL(`https://graph.facebook.com/${version}/${senderId}`)
  url.searchParams.set('fields', 'name,first_name,last_name,username')
  url.searchParams.set('access_token', accessToken)

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return null
    return data
  } catch {
    return null
  }
}

function profileName(profile: any, channel: string) {
  const fullName = String(profile?.name || '').trim()
  if (fullName) return fullName
  const name = [profile?.first_name, profile?.last_name].map(item => String(item || '').trim()).filter(Boolean).join(' ')
  if (name) return name
  const username = String(profile?.username || '').trim()
  if (username) return username
  return `Лид из ${sourceLabel(channel)}`
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { settings: true },
  })
  if (!organization) return new NextResponse('Organization not found', { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge') || ''

  if (mode === 'subscribe' && token && token === settings.facebookLeadVerifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Invalid verify token', { status: 403 })
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const body = await request.json().catch(() => ({}))
  const safePayload = sanitizeLeadWebhookPayload(body)
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const channel = inferChannel(body)
  const source = channel

  if (!settings.facebookMessagesEnabled) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source,
        payload: safePayload,
        error: 'Meta messages integration is disabled',
      },
    })
    return NextResponse.json({ error: 'Meta messages integration is disabled' }, { status: 403 })
  }

  const events = collectMessagingEvents(body)
  if (events.length === 0) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'failed',
        source,
        payload: safePayload,
        error: 'No messaging events in Meta webhook payload',
      },
    })
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  const leadIds: string[] = []

  for (const event of events) {
    if (event.message?.is_echo) continue

    const senderId = String(event.sender?.id || '').trim()
    const text = messageText(event)
    if (!senderId || !text) continue

    const externalMessageId = String(event.message?.mid || event.postback?.payload || '').trim() || `${senderId}:${event.timestamp || Date.now()}`
    const messengerId = `${channel}:${senderId}`
    const sentAt = event.timestamp ? new Date(event.timestamp) : new Date()

    const existingMessage = await (prisma as any).leadMessage.findFirst({
      where: { organizationId: organization.id, externalMessageId },
      select: { id: true, leadId: true },
    })
    if (existingMessage) {
      processed++
      if (!leadIds.includes(existingMessage.leadId)) leadIds.push(existingMessage.leadId)
      continue
    }

    const profile = await fetchProfile(
      senderId,
      pageAccessTokenForChannel(settings, channel),
      settings.facebookLeadApiVersion || 'v23.0'
    )
    const displayName = profileName(profile, channel)
    const defaultStatus = await (prisma as any).leadStatus.findFirst({
      where: { organizationId: organization.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { name: true },
    })

    const result = await (prisma as any).$transaction(async (tx: any) => {
      let lead = await tx.lead.findFirst({
        where: { organizationId: organization.id, messengerId },
        select: { id: true },
      })

      if (!lead) {
        lead = await tx.lead.create({
          data: {
            organizationId: organization.id,
            status: defaultStatus?.name || undefined,
            source,
            messengerId,
            fullName: displayName,
            instagram: channel === 'instagram' ? String(profile?.username || '').trim() || null : null,
            facebook: channel === 'facebook' ? displayName : null,
            lastContactAt: sentAt,
            lastContactNote: text,
            notes: `Лид создан из сообщения ${sourceLabel(channel)}`,
          },
          select: { id: true },
        })
      } else {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            lastContactAt: sentAt,
            lastContactNote: text,
          },
        })
      }

      await tx.leadMessage.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          channel,
          direction: 'incoming',
          senderType: 'lead',
          senderName: displayName,
          externalMessageId,
          text,
          payload: safePayload,
          sentAt,
        },
      })

      await tx.leadWebhookLog.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          status: 'message',
          source,
          payload: safePayload,
        },
      })

      return lead
    })

    processed++
    if (!leadIds.includes(result.id)) leadIds.push(result.id)
  }

  return NextResponse.json({ ok: true, processed, leadIds })
}
