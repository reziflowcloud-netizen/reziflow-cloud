import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLeadWebhookSettings, sanitizeLeadWebhookPayload } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

type MetaMessagingEvent = {
  pageId?: string
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

type MetaConversationMessage = {
  id?: string
  message?: string
  created_time?: string
  from?: { id?: string; name?: string }
  to?: { data?: Array<{ id?: string; name?: string }> }
}

function collectMessagingEvents(body: any): MetaMessagingEvent[] {
  const entries = Array.isArray(body?.entry) ? body.entry : []
  const events: MetaMessagingEvent[] = []

  for (const entry of entries) {
    const pageId = String(entry?.id || '').trim()
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : []
    for (const event of messaging) events.push({ ...event, pageId })
  }

  return events
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
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

function pageSenderName(channel: string) {
  return channel === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger'
}

function apiVersion(value: string) {
  return value.startsWith('v') ? value : `v${value || '23.0'}`
}

async function fetchFacebookConversationMessages(pageId: string, participantId: string, accessToken: string, version: string) {
  if (!pageId || !participantId) return []
  if (!accessToken) throw new Error('Facebook Page Access Token is empty')
  const url = new URL(`https://graph.facebook.com/${apiVersion(version)}/${pageId}/conversations`)
  url.searchParams.set('user_id', participantId)
  url.searchParams.set('fields', 'messages.limit(20){id,message,from,to,created_time}')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Facebook conversation sync failed with status ${response.status}`
    throw new Error(message)
  }

  const conversation = Array.isArray(data?.data) ? data.data[0] : null
  const messages = Array.isArray(conversation?.messages?.data) ? conversation.messages.data : []
  return messages as MetaConversationMessage[]
}

async function fetchInstagramConversationMessages(igUserId: string, participantId: string, accessToken: string, version: string) {
  if (!igUserId || !participantId) return []
  if (!accessToken) throw new Error('Instagram Page Access Token is empty')
  const url = new URL(`https://graph.facebook.com/${apiVersion(version)}/${igUserId}/conversations`)
  url.searchParams.set('platform', 'instagram')
  url.searchParams.set('user_id', participantId)
  url.searchParams.set('fields', 'messages.limit(20){id,message,from,to,created_time}')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Instagram conversation sync failed with status ${response.status}`
    const trace = data?.error?.fbtrace_id ? ` FB trace: ${data.error.fbtrace_id}` : ''
    throw new Error(`${message}${trace}`)
  }

  const conversation = Array.isArray(data?.data) ? data.data[0] : null
  const messages = Array.isArray(conversation?.messages?.data) ? conversation.messages.data : []
  return messages as MetaConversationMessage[]
}

async function syncMetaConversationMessages(args: {
  organizationId: string
  settings: ReturnType<typeof getLeadWebhookSettings>
  participantId: string
  pageId: string
  channel: 'facebook' | 'instagram'
  safePayload: any
  eventSummary: any
}) {
  const token = pageAccessTokenForChannel(args.settings, args.channel)
  const version = args.settings.facebookLeadApiVersion || 'v23.0'
  const messages = args.channel === 'instagram'
    ? await fetchInstagramConversationMessages(args.pageId, args.participantId, token, version)
    : await fetchFacebookConversationMessages(args.pageId, args.participantId, token, version)
  const textMessages = messages
    .map(message => ({
      ...message,
      text: String(message.message || '').trim(),
      sentAt: message.created_time ? new Date(message.created_time) : new Date(),
    }))
    .filter(message => message.text)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())

  if (!textMessages.length) return { created: 0, leadId: null as string | null }

  const messengerId = `${args.channel}:${args.participantId}`
  const profile = await fetchProfile(args.participantId, token, version)
  const displayName = profileName(profile, args.channel)
  const defaultStatus = await (prisma as any).leadStatus.findFirst({
    where: { organizationId: args.organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { name: true },
  })

  const result = await (prisma as any).$transaction(async (tx: any) => {
    let lead = await tx.lead.findFirst({
      where: { organizationId: args.organizationId, messengerId },
      select: { id: true },
    })

    if (!lead) {
      lead = await tx.lead.create({
          data: {
            organizationId: args.organizationId,
            status: defaultStatus?.name || undefined,
            source: args.channel,
            messengerId,
            fullName: displayName,
            instagram: args.channel === 'instagram' ? String(profile?.username || '').trim() || null : null,
            facebook: args.channel === 'facebook' ? displayName : null,
            notes: `Лид создан из сообщения ${sourceLabel(args.channel)}`,
          },
          select: { id: true },
        })
    }

    const candidateRows = textMessages.map(message => {
      const externalMessageId = String(message.id || '').trim()
        || `${args.channel}-sync:${args.participantId}:${message.sentAt.getTime()}:${message.text.slice(0, 40)}`
      const isOutgoing = String(message.from?.id || '').trim() === args.pageId
      return {
        organizationId: args.organizationId,
        leadId: lead.id,
        channel: args.channel,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        senderType: isOutgoing ? 'system' : 'lead',
        senderName: isOutgoing ? pageSenderName(args.channel) : String(message.from?.name || '').trim() || displayName,
        externalMessageId,
        text: message.text,
        payload: {
          metaEvent: args.eventSummary,
          conversationSync: true,
          raw: args.safePayload,
        },
        sentAt: message.sentAt,
      }
    })

    const existingMessages = await tx.leadMessage.findMany({
      where: {
        organizationId: args.organizationId,
        externalMessageId: { in: candidateRows.map(row => row.externalMessageId) },
      },
      select: { externalMessageId: true },
    })
    const existingIds = new Set(existingMessages.map((message: any) => message.externalMessageId).filter(Boolean))
    const rowsToCreate = candidateRows.filter(row => !existingIds.has(row.externalMessageId))
    const createResult = rowsToCreate.length
      ? await tx.leadMessage.createMany({ data: rowsToCreate, skipDuplicates: true })
      : { count: 0 }
    const created = Number(createResult?.count || 0)
    if (created > 0) {
      await tx.leadWebhookLog.create({
        data: {
          organizationId: args.organizationId,
          leadId: lead.id,
          status: 'message',
          source: args.channel,
          payload: {
            metaEvent: args.eventSummary,
            conversationSync: true,
            syncedMessages: created,
            raw: args.safePayload,
          },
        },
      })
    }

    return { created, leadId: lead.id as string }
  })

  return result
}

function metaEventKind(event: MetaMessagingEvent & Record<string, any>) {
  if (event.message?.is_echo === true) return 'message_echo'
  if (event.message) return 'message'
  if (event.delivery) return 'delivery'
  if (event.read) return 'read'
  if (event.reaction) return 'reaction'
  if (event.postback) return 'postback'
  if (event.referral) return 'referral'
  if (event.optin) return 'optin'
  if (event.standby) return 'standby'
  return 'unknown'
}

function metaEventSummary(event: MetaMessagingEvent & Record<string, any>) {
  return {
    kind: metaEventKind(event),
    pageId: String(event.pageId || '').trim() || null,
    senderId: String(event.sender?.id || '').trim() || null,
    recipientId: String(event.recipient?.id || '').trim() || null,
    hasMessage: !!event.message,
    isEcho: event.message?.is_echo === true,
    hasText: !!String(event.message?.text || '').trim(),
    messageKeys: event.message && typeof event.message === 'object' ? Object.keys(event.message) : [],
    eventKeys: Object.keys(event || {}).filter(key => key !== 'pageId'),
  }
}

function shouldTryConversationSync(kind: string) {
  return kind === 'read' || kind === 'delivery'
}

function isSilentMetaEvent(kind: string) {
  return kind === 'read' || kind === 'delivery' || kind === 'reaction'
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
    const eventSummary = metaEventSummary(event as MetaMessagingEvent & Record<string, any>)
    const isEcho = event.message?.is_echo === true
    const senderId = String(event.sender?.id || '').trim()
    const recipientId = String(event.recipient?.id || '').trim()
    const pageId = String(event.pageId || '').trim()
    const sentByPage = !!pageId && senderId === pageId
    const isPageOutgoing = isEcho || sentByPage
    const candidateIds = isPageOutgoing ? uniqueValues([recipientId, senderId]) : uniqueValues([senderId])
    const participantCandidates = uniqueValues([
      ...candidateIds.filter(id => id !== pageId),
      ...candidateIds,
    ])
    const text = messageText(event)
    if (!participantCandidates.length || !text) {
      let syncError = ''
      if (
        participantCandidates[0]
        && pageId
        && (channel === 'facebook' || channel === 'instagram')
        && shouldTryConversationSync(eventSummary.kind)
      ) {
        try {
          const syncResult = await syncMetaConversationMessages({
            organizationId: organization.id,
            settings,
            participantId: participantCandidates[0],
            pageId,
            channel: channel as 'facebook' | 'instagram',
            safePayload,
            eventSummary,
          })
          if (syncResult.created > 0) {
            processed += syncResult.created
            if (syncResult.leadId && !leadIds.includes(syncResult.leadId)) leadIds.push(syncResult.leadId)
            continue
          }
          continue
        } catch (error: any) {
          syncError = error?.message || `${sourceLabel(channel)} conversation sync failed`
        }
      }

      if (isSilentMetaEvent(eventSummary.kind) && !syncError) continue

      await (prisma as any).leadWebhookLog.create({
        data: {
          organizationId: organization.id,
          status: syncError ? 'failed' : 'ignored',
          source,
          payload: { metaEvent: eventSummary, raw: safePayload },
          error: !participantCandidates.length
            ? 'Meta message skipped: no sender or recipient id'
            : syncError
              ? `Meta sent a ${eventSummary.kind} event without text. Conversation sync failed: ${syncError}`
              : 'Meta message skipped: no text or supported attachment',
        },
      })
      continue
    }

    const externalMessageId = String(event.message?.mid || event.postback?.payload || '').trim() || `${participantCandidates[0]}:${event.timestamp || Date.now()}`
    const messengerIds = participantCandidates.map(id => `${channel}:${id}`)
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

    const existingLead = await (prisma as any).lead.findFirst({
      where: { organizationId: organization.id, messengerId: { in: messengerIds } },
      select: { id: true, messengerId: true },
    })
    const messengerId = existingLead?.messengerId || messengerIds[0]
    const participantId = String(messengerId).replace(`${channel}:`, '')

    const profile = await fetchProfile(
      participantId,
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
      let lead = existingLead
        ? { id: existingLead.id }
        : await tx.lead.findFirst({
          where: { organizationId: organization.id, messengerId: { in: messengerIds } },
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
            notes: `Лид создан из сообщения ${sourceLabel(channel)}`,
          },
          select: { id: true },
        })
      }

      await tx.leadMessage.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          channel,
          direction: isPageOutgoing ? 'outgoing' : 'incoming',
          senderType: isPageOutgoing ? 'system' : 'lead',
          senderName: isPageOutgoing ? pageSenderName(channel) : displayName,
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
          payload: { metaEvent: eventSummary, raw: safePayload },
        },
      })

      return lead
    })

    processed++
    if (!leadIds.includes(result.id)) leadIds.push(result.id)
  }

  return NextResponse.json({ ok: true, processed, leadIds })
}
