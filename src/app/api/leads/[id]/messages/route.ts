import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

const DIRECTIONS = new Set(['incoming', 'outgoing'])
const SENDER_TYPES = new Set(['lead', 'bot', 'employee', 'system'])
const META_CHANNELS = new Set(['facebook', 'instagram', 'messenger'])

function metaChannelFromMessengerId(value?: string | null) {
  const [channel, recipientId] = String(value || '').split(':')
  if ((channel === 'facebook' || channel === 'instagram') && recipientId) {
    return { channel, recipientId }
  }
  return null
}

function pageAccessTokenForChannel(settings: ReturnType<typeof getLeadWebhookSettings>, channel: string) {
  if (channel === 'instagram') {
    return settings.instagramMessagesPageAccessToken || settings.facebookLeadPageAccessToken || ''
  }
  return settings.facebookLeadPageAccessToken || ''
}

async function sendMetaMessage(params: {
  accessToken: string
  apiVersion: string
  recipientId: string
  text: string
  channel: string
  senderId?: string | null
}) {
  const version = params.apiVersion.startsWith('v') ? params.apiVersion : `v${params.apiVersion}`
  const senderId = String(params.senderId || '').trim() || 'me'
  const facebookBody = JSON.stringify({
    recipient: { id: params.recipientId },
    messaging_type: 'RESPONSE',
    message: { text: params.text },
  })
  const instagramBody = JSON.stringify({
    recipient: { id: params.recipientId },
    message: { text: params.text },
  })
  const attempts = params.channel === 'instagram'
    ? [
        { label: 'facebook:/me/messages', url: new URL(`https://graph.facebook.com/${version}/me/messages`), auth: 'query', body: facebookBody },
        ...(senderId !== 'me' ? [{ label: 'facebook:sender/messages', url: new URL(`https://graph.facebook.com/${version}/${senderId}/messages`), auth: 'query', body: facebookBody }] : []),
        { label: 'instagram:/me/messages', url: new URL(`https://graph.instagram.com/${version}/me/messages`), auth: 'bearer', body: instagramBody },
        ...(senderId !== 'me' ? [{ label: 'instagram:sender/messages', url: new URL(`https://graph.instagram.com/${version}/${senderId}/messages`), auth: 'bearer', body: instagramBody }] : []),
        { label: 'instagram:/me/messages?access_token', url: new URL(`https://graph.instagram.com/${version}/me/messages`), auth: 'query', body: instagramBody },
        ...(senderId !== 'me' ? [{ label: 'instagram:sender/messages?access_token', url: new URL(`https://graph.instagram.com/${version}/${senderId}/messages`), auth: 'query', body: instagramBody }] : []),
      ]
    : [{ label: 'facebook:/me/messages', url: new URL(`https://graph.facebook.com/${version}/me/messages`), auth: 'query', body: facebookBody }]

  const errors: string[] = []
  for (const attempt of attempts) {
    if (attempt.auth === 'query') attempt.url.searchParams.set('access_token', params.accessToken)
    const response = await fetch(attempt.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(attempt.auth === 'bearer' ? { Authorization: `Bearer ${params.accessToken}` } : {}),
      },
      body: attempt.body,
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok) return { ...data, requestTarget: attempt.label }
    const message = data?.error?.message || `Meta Graph API error ${response.status}`
    errors.push(`${attempt.label}: ${message}`)
  }

  const visibleErrors = errors.slice(0, 4).join(' | ')
  throw new Error(visibleErrors ? `Meta не приняла сообщение: ${visibleErrors}` : 'Meta did not accept the outgoing message')
}

function metaPageIdFromPayload(payload: any) {
  const summaryPageId = String(payload?.metaEvent?.pageId || '').trim()
  if (summaryPageId) return summaryPageId
  const entryId = String(payload?.raw?.entry?.[0]?.id || '').trim()
  return entryId || ''
}

async function getMetaSenderIdForLead(organizationId: string, leadId: string, channel: string) {
  const messages = await (prisma as any).leadMessage.findMany({
    where: { organizationId, leadId, channel },
    select: { payload: true },
    orderBy: { sentAt: 'desc' },
    take: 20,
  })

  for (const message of messages) {
    const pageId = metaPageIdFromPayload(message.payload)
    if (pageId) return pageId
  }

  return ''
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await (prisma as any).leadMessage.findMany({
    where: { leadId: params.id, organizationId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { sentAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({
    where: { id: params.id, organizationId },
    select: { id: true, source: true, messengerId: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const text = String(body.text || '').trim()
  if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })

  const direction = DIRECTIONS.has(String(body.direction)) ? String(body.direction) : 'outgoing'
  const senderType = SENDER_TYPES.has(String(body.senderType)) ? String(body.senderType) : (direction === 'outgoing' ? 'employee' : 'lead')
  const channel = String(body.channel || lead.source || 'manual').trim() || 'manual'
  const sentAt = body.sentAt ? new Date(body.sentAt) : new Date()
  let externalMessageId = body.externalMessageId ? String(body.externalMessageId).trim() : null
  let outboundPayload: any = body.payload || undefined

  if (direction === 'outgoing' && senderType === 'employee' && META_CHANNELS.has(channel)) {
    const metaTarget = metaChannelFromMessengerId(lead.messengerId)
    if (!metaTarget) {
      return NextResponse.json({ error: 'У этого лида нет Meta recipient id для отправки сообщения' }, { status: 400 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    })
    const settings = getLeadWebhookSettings(organization?.settings)
    if (!settings.facebookMessagesEnabled) {
      return NextResponse.json({ error: 'Интеграция сообщений Facebook/Instagram выключена' }, { status: 400 })
    }
    const pageAccessToken = pageAccessTokenForChannel(settings, metaTarget.channel)
    if (!pageAccessToken) {
      return NextResponse.json({ error: `Не сохранен Page Access Token для ${metaTarget.channel === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger'}` }, { status: 400 })
    }

    try {
      const metaSenderId = await getMetaSenderIdForLead(organizationId, lead.id, metaTarget.channel)
      const metaResponse = await sendMetaMessage({
        accessToken: pageAccessToken,
        apiVersion: settings.facebookLeadApiVersion || 'v23.0',
        recipientId: metaTarget.recipientId,
        text,
        channel: metaTarget.channel,
        senderId: metaSenderId,
      })
      externalMessageId = String(metaResponse?.message_id || externalMessageId || '').trim() || null
      outboundPayload = { ...(body.payload || {}), metaResponse, metaSenderId: metaSenderId || null }
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Не удалось отправить сообщение в Meta' }, { status: 502 })
    }
  }

  const message = await (prisma as any).leadMessage.create({
    data: {
      organizationId,
      leadId: params.id,
      authorId: senderType === 'employee' ? user.id : null,
      channel,
      direction,
      senderType,
      senderName: body.senderName ? String(body.senderName).trim() : null,
      externalMessageId,
      text,
      payload: outboundPayload,
      sentAt,
    },
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(message)
}
