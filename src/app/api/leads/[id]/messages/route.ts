import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

const DIRECTIONS = new Set(['incoming', 'outgoing'])
const SENDER_TYPES = new Set(['lead', 'bot', 'employee', 'system'])
const META_CHANNELS = new Set(['facebook', 'instagram', 'messenger'])
type MetaSendMode = 'response' | 'human_agent'

function metaChannelFromMessengerId(value?: string | null) {
  const [channel, recipientId] = String(value || '').split(':')
  if ((channel === 'facebook' || channel === 'instagram') && recipientId) {
    return { channel, recipientId }
  }
  return null
}

function pageAccessTokensForChannel(settings: ReturnType<typeof getLeadWebhookSettings>, channel: string) {
  const candidates = channel === 'instagram'
    ? [
        { label: 'Instagram Page Access Token', token: settings.instagramMessagesPageAccessToken || '' },
        { label: 'Facebook Page Access Token', token: settings.facebookLeadPageAccessToken || '' },
      ]
    : [{ label: 'Facebook Page Access Token', token: settings.facebookLeadPageAccessToken || '' }]
  const seen = new Set<string>()
  return candidates
    .map(item => ({ ...item, token: item.token.trim() }))
    .filter(item => {
      if (!item.token || seen.has(item.token)) return false
      seen.add(item.token)
      return true
    })
}

function metaOutgoingErrorMessage(channel: string, data: any, status: number) {
  const rawMessage = String(data?.error?.message || `Meta Graph API error ${status}`)
  const lower = rawMessage.toLowerCase()
  const trace = data?.error?.fbtrace_id ? ` FB trace: ${data.error.fbtrace_id}` : ''

  if (isOutsideWindowMetaError(data, status)) {
    return [
      'Meta закрыла стандартное окно ответа: прошло больше 24 часов с последнего сообщения лида.',
      'CRM попробует отправку как ручной ответ HUMAN_AGENT, если эта функция доступна приложению.',
      'Если прошло больше 7 дней или Human Agent не одобрен Meta, нужно чтобы лид снова написал в Instagram/Facebook.',
      `Meta Graph: ${rawMessage}${trace}`,
    ].join(' ')
  }

  if (
    channel === 'instagram' &&
    (
      (lower.includes('advanced access') && lower.includes('instagram_manage_messages')) ||
      (lower.includes('расширенного доступа') && lower.includes('instagram')) ||
      (lower.includes('приложение не имеет') && lower.includes('управление сообщениями в instagram'))
    )
  ) {
    return [
      'Meta не разрешила отправить Instagram Direct обычному лиду.',
      'У Meta-приложения нет Advanced Access для instagram_manage_messages, либо токен этой организации выдан другим приложением без такого доступа.',
      'Поэтому ответы аккаунтам с ролью администратора/разработчика могут работать, а реальные лиды блокируются.',
      'Нужно получить Advanced Access в Meta App Review и заново подключить Instagram/Page token для этой организации через то же приложение.',
      `Meta Graph: ${rawMessage}${trace}`,
    ].join(' ')
  }

  if (lower.includes('cannot parse access token') || lower.includes('invalid oauth access token')) {
    return `Meta не приняла токен доступа. Пересоздай Page Access Token для этой организации и сохрани его в настройках интеграции. Meta Graph: ${rawMessage}${trace}`
  }

  if (lower.includes('application does not have the capability')) {
    return `Meta не разрешила этот вызов API для текущего токена/приложения. Проверь, что токен выдан правильным Meta-приложением и у приложения есть доступ к Instagram/Facebook Messaging и Human Agent, если ответ идет после 24 часов. Meta Graph: ${rawMessage}${trace}`
  }

  return `Meta не приняла сообщение: ${rawMessage}${trace}`
}

function isOutsideWindowMetaError(data: any, status: number) {
  const rawMessage = String(data?.error?.message || `Meta Graph API error ${status}`).toLowerCase()
  return (
    rawMessage.includes('outside of allowed window') ||
    rawMessage.includes('outside the allowed window') ||
    (rawMessage.includes('24') && rawMessage.includes('window')) ||
    (rawMessage.includes('24') && rawMessage.includes('hour')) ||
    (rawMessage.includes('7') && rawMessage.includes('day') && rawMessage.includes('window'))
  )
}

async function sendMetaMessage(params: {
  accessToken: string
  apiVersion: string
  recipientId: string
  text: string
  channel: string
  sendMode?: MetaSendMode
}) {
  const version = params.apiVersion.startsWith('v') ? params.apiVersion : `v${params.apiVersion}`
  const url = new URL(`https://graph.facebook.com/${version}/me/messages`)
  url.searchParams.set('access_token', params.accessToken)
  const sendMode = params.sendMode || 'response'
  const payload: any = {
    recipient: { id: params.recipientId },
    message: { text: params.text },
  }
  if (sendMode === 'human_agent') {
    payload.messaging_type = 'MESSAGE_TAG'
    payload.tag = 'HUMAN_AGENT'
  } else {
    payload.messaging_type = 'RESPONSE'
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (response.ok) return { ...data, requestTarget: 'facebook:/me/messages', sendMode }

  const error = new Error(metaOutgoingErrorMessage(params.channel, data, response.status))
  ;(error as any).outsideWindow = isOutsideWindowMetaError(data, response.status)
  ;(error as any).metaError = data?.error || data
  ;(error as any).sendMode = sendMode
  throw error
}

function parsedPayload(payload: any) {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function metaPageIdFromPayload(payload: any) {
  const data = parsedPayload(payload)
  const summaryPageId = String(payload?.metaEvent?.pageId || '').trim()
  if (summaryPageId) return summaryPageId
  const entryId = String(data?.raw?.entry?.[0]?.id || '').trim()
  if (entryId) return entryId
  return String(data?.entry?.[0]?.id || '').trim()
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

  const logs = await (prisma as any).leadWebhookLog.findMany({
    where: { organizationId, leadId, source: channel },
    select: { payload: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  for (const log of logs) {
    const pageId = metaPageIdFromPayload(log.payload)
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
    const pageAccessTokens = pageAccessTokensForChannel(settings, metaTarget.channel)
    if (pageAccessTokens.length === 0) {
      return NextResponse.json({ error: `Не сохранен Page Access Token для ${metaTarget.channel === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger'}` }, { status: 400 })
    }

    try {
      const metaSenderId = await getMetaSenderIdForLead(organizationId, lead.id, metaTarget.channel)
      let metaResponse: any = null
      let metaAccessTokenSource = ''
      let lastMetaError = ''
      let metaSendMode: MetaSendMode = 'response'
      for (const candidate of pageAccessTokens) {
        try {
          metaResponse = await sendMetaMessage({
            accessToken: candidate.token,
            apiVersion: settings.facebookLeadApiVersion || 'v23.0',
            recipientId: metaTarget.recipientId,
            text,
            channel: metaTarget.channel,
            sendMode: 'response',
          })
          metaAccessTokenSource = candidate.label
          metaSendMode = 'response'
          break
        } catch (error: any) {
          lastMetaError = error?.message || 'Не удалось отправить сообщение в Meta'
          if (error?.outsideWindow) {
            try {
              metaResponse = await sendMetaMessage({
                accessToken: candidate.token,
                apiVersion: settings.facebookLeadApiVersion || 'v23.0',
                recipientId: metaTarget.recipientId,
                text,
                channel: metaTarget.channel,
                sendMode: 'human_agent',
              })
              metaAccessTokenSource = candidate.label
              metaSendMode = 'human_agent'
              break
            } catch (humanAgentError: any) {
              lastMetaError = humanAgentError?.message || lastMetaError
            }
          }
        }
      }
      if (!metaResponse) throw new Error(lastMetaError || 'Не удалось отправить сообщение в Meta')
      externalMessageId = String(metaResponse?.message_id || externalMessageId || '').trim() || null
      outboundPayload = {
        ...(body.payload || {}),
        metaResponse,
        metaSenderId: metaSenderId || null,
        metaAccessTokenSource,
        metaSendMode,
        metaTokenFallbackUsed: pageAccessTokens.length > 1 && metaAccessTokenSource !== pageAccessTokens[0].label,
      }
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
