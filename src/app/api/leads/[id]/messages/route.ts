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

async function sendMetaMessage(params: {
  accessToken: string
  apiVersion: string
  recipientId: string
  text: string
}) {
  const version = params.apiVersion.startsWith('v') ? params.apiVersion : `v${params.apiVersion}`
  const url = new URL(`https://graph.facebook.com/${version}/me/messages`)
  url.searchParams.set('access_token', params.accessToken)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      messaging_type: 'RESPONSE',
      message: { text: params.text },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = data?.error?.message || 'Meta did not accept the outgoing message'
    throw new Error(error)
  }
  return data
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
    if (!settings.facebookLeadPageAccessToken) {
      return NextResponse.json({ error: 'Не сохранен Page Access Token страницы Facebook' }, { status: 400 })
    }

    try {
      const metaResponse = await sendMetaMessage({
        accessToken: settings.facebookLeadPageAccessToken,
        apiVersion: settings.facebookLeadApiVersion || 'v23.0',
        recipientId: metaTarget.recipientId,
        text,
      })
      externalMessageId = String(metaResponse?.message_id || externalMessageId || '').trim() || null
      outboundPayload = { ...(body.payload || {}), metaResponse }
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Не удалось отправить сообщение в Meta' }, { status: 502 })
    }
  }

  const message = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.leadMessage.create({
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

    await tx.lead.update({
      where: { id: params.id },
      data: {
        lastContactAt: sentAt,
        lastContactNote: text,
      },
    })

    return created
  })

  return NextResponse.json(message)
}
