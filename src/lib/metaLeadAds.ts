import { createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { inboundEventKey, inboundLeadOnce } from '@/lib/inboundLeadEvent'
import { applyLeadWebhookMapping, getLeadWebhookSettings } from '@/lib/leadWebhook'
import { normalizeLeadBody } from '@/lib/leads'
import { resolveInboundLeadAssignment } from '@/lib/leadRouting'
import { notifyAssignment } from '@/lib/notifications'
import { assertBillingLimit } from '@/lib/billing'
import { leadAdsSource, metaNumericId, metaRetryDelay, pilotAllows, type MetaLeadAdsEvent } from '@/lib/metaLeadAdsPolicy'

const db = prisma as any

export function leadAdsAppConfig() {
  const appId = metaNumericId(process.env.META_LEAD_ADS_APP_ID)
  const secret = process.env.META_LEAD_ADS_APP_SECRET || ''
  const verifyToken = process.env.META_LEAD_ADS_VERIFY_TOKEN || ''
  const receiptKey = process.env.META_LEAD_ADS_RECEIPT_HMAC_KEY || ''
  const activationRaw = process.env.META_LEAD_ADS_ACTIVATED_AT || ''
  const activationTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(activationRaw) &&
    Number.isFinite(Date.parse(activationRaw)) ? new Date(activationRaw) : null
  const legacySecrets = [process.env.META_APP_SECRET, process.env.FACEBOOK_APP_SECRET, process.env.INSTAGRAM_APP_SECRET]
  const legacyAppIds = [process.env.META_APP_ID, process.env.FACEBOOK_APP_ID]
  if (!appId || secret.length < 24 || verifyToken.length < 24 || receiptKey.length < 32 ||
      (process.env.META_LEAD_ADS_ENABLED === 'true' && !activationTime) ||
      receiptKey === secret || receiptKey === verifyToken ||
      legacySecrets.some(value => value && value === secret) || legacyAppIds.some(value => value && value === appId)) return null
  return { appId, secret, verifyToken, receiptKey, activationTime }
}

export function pageToken(pageId: string): string | null {
  if (!metaNumericId(pageId)) return null
  return process.env[`META_LEAD_ADS_PAGE_TOKEN_${pageId}`] || null
}

function receiptFingerprint(receiptKey: string, appId: string, leadgenId: string): string {
  return createHmac('sha256', receiptKey).update(`${appId}:${leadgenId}`).digest('hex')
}

export async function acceptLeadAdsEvent(event: MetaLeadAdsEvent, appId: string, receiptKey: string) {
  const binding = await db.metaLeadAdsBinding.findUnique({
    where: { appId_pageId_formId: { appId, pageId: event.pageId, formId: event.formId } },
    select: { id: true, organizationId: true, enabled: true, mode: true, pilotLeadIds: true, activatedAt: true },
  })
  if (!binding?.enabled || !binding.activatedAt || binding.mode === 'off') return { accepted: false, reason: 'UNBOUND_OR_OFF' }
  if (binding.mode !== 'shadow' && !pilotAllows(binding.mode, event.leadgenId, binding.pilotLeadIds)) {
    return { accepted: false, reason: 'PILOT_LEAD_NOT_ALLOWED' }
  }
  // Shadow stores only an HMAC of the signed event's ID. It never calls Graph.
  const eventFingerprint = receiptFingerprint(receiptKey, appId, event.leadgenId)
  const leadgenId = binding.mode === 'shadow' ? `shadow:${eventFingerprint}` : event.leadgenId
  try {
    const delivery = await db.metaLeadAdsDelivery.create({
      data: {
        organizationId: binding.organizationId, bindingId: binding.id, appId, leadgenId, eventFingerprint,
        acceptedMode: binding.mode,
        status: binding.mode === 'shadow' ? 'shadow' : 'pending',
      },
      select: { id: true },
    })
    return { accepted: true, reason: binding.mode === 'shadow' ? 'SHADOW' : 'QUEUED', deliveryId: delivery.id }
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
    const existing = await db.metaLeadAdsDelivery.findUnique({
      where: { appId_eventFingerprint: { appId, eventFingerprint } }, select: { bindingId: true },
    })
    return existing?.bindingId === binding.id
      ? { accepted: true, reason: 'REPLAY' }
      : { accepted: false, reason: 'CROSS_BINDING_REPLAY' }
  }
}

class GraphFailure extends Error {
  constructor(public code: string, public retryable: boolean, public retryAfter?: number) { super(code) }
}

async function fetchLead(leadgenId: string, pageId: string, secret: string) {
  const token = pageToken(pageId)
  if (!token) throw new GraphFailure('PAGE_TOKEN_MISSING', true)
  const version = /^v\d+\.\d+$/.test(process.env.META_LEAD_ADS_GRAPH_VERSION || '')
    ? process.env.META_LEAD_ADS_GRAPH_VERSION : 'v23.0'
  const url = new URL(`https://graph.facebook.com/${version}/${leadgenId}`)
  url.searchParams.set('fields', 'id,form_id,platform,field_data')
  url.searchParams.set('appsecret_proof', createHmac('sha256', secret).update(token).digest('hex'))
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
  } catch { throw new GraphFailure('GRAPH_TRANSPORT', true) }
  if (!response.ok) {
    const rawRetry = Number(response.headers.get('retry-after'))
    throw new GraphFailure(`GRAPH_${response.status}`, response.status === 429 || response.status >= 500,
      Number.isFinite(rawRetry) ? rawRetry : undefined)
  }
  const raw = await response.text()
  if (raw.length > 131072) throw new GraphFailure('GRAPH_RESPONSE_TOO_LARGE', false)
  try { return JSON.parse(raw) } catch { throw new GraphFailure('GRAPH_INVALID_JSON', true) }
}

function fieldsToPayload(metaLead: any): Record<string, string> {
  if (!Array.isArray(metaLead?.field_data)) throw new GraphFailure('GRAPH_FIELDS_MISSING', false)
  const fields: Record<string, string> = {}
  for (const item of metaLead.field_data.slice(0, 100)) {
    const name = String(item?.name || '').trim().slice(0, 100)
    if (!name || !Array.isArray(item?.values)) continue
    fields[name] = item.values.slice(0, 10).map((value: unknown) => String(value).slice(0, 2000)).join(', ')
  }
  return fields
}

export async function processLeadAdsDelivery(id: string, appId: string, secret: string, activationTime: Date) {
  const now = new Date()
  const current = await db.metaLeadAdsDelivery.findUnique({ where: { id }, select: {
    id: true, status: true, attempts: true, nextAttemptAt: true, leaseUntil: true,
    leadgenId: true, appId: true, bindingId: true, organizationId: true, acceptedMode: true, createdAt: true,
  } })
  if (!current || current.appId !== appId || !metaNumericId(current.leadgenId)) return 'skipped'
  const eligible = current.status === 'pending' && current.nextAttemptAt <= now ||
    current.status === 'processing' && current.leaseUntil && current.leaseUntil <= now
  if (!eligible) return 'skipped'
  const claimed = await db.metaLeadAdsDelivery.updateMany({ where: {
    id, attempts: current.attempts, status: current.status,
    ...(current.status === 'pending' ? { nextAttemptAt: { lte: now } } : { leaseUntil: { lte: now } }),
  }, data: { status: 'processing', attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + 120000), lastErrorCode: null } })
  if (claimed.count !== 1) return 'skipped'
  const attempts = current.attempts + 1
  try {
    if (current.createdAt < activationTime) throw new GraphFailure('GLOBAL_ACTIVATION_EXPIRED', false)
    const binding = await db.metaLeadAdsBinding.findFirst({ where: {
      id: current.bindingId, organizationId: current.organizationId, appId, enabled: true,
    }, select: { id: true, pageId: true, formId: true, mode: true, pilotLeadIds: true, activatedAt: true } })
    if (!binding || binding.mode !== current.acceptedMode || !binding.activatedAt || binding.activatedAt > current.createdAt ||
        !pilotAllows(binding.mode, current.leadgenId, binding.pilotLeadIds)) throw new GraphFailure('BINDING_DISABLED', false)
    const metaLead = await fetchLead(current.leadgenId, binding.pageId, secret)
    if (metaNumericId(metaLead?.id) !== current.leadgenId || metaNumericId(metaLead?.form_id) !== binding.formId) {
      throw new GraphFailure('GRAPH_IDENTITY_MISMATCH', false)
    }
    const source = leadAdsSource(metaLead.platform)
    const settingsRow = await db.organization.findUnique({ where: { id: current.organizationId }, select: { settings: true } })
    if (!settingsRow) throw new GraphFailure('ORGANIZATION_MISSING', false)
    const settings = getLeadWebhookSettings(settingsRow.settings)
    const mapped = applyLeadWebhookMapping(fieldsToPayload(metaLead), settings.leadWebhookFieldMap || [])
    const data = normalizeLeadBody({ ...mapped, source, messengerId: `meta-lead-ads:${current.leadgenId}` })
    if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) throw new GraphFailure('EMPTY_CONTACT', false)
    let diagnosticCode: string | null = null
    const lead = await inboundLeadOnce(db, current.organizationId,
      inboundEventKey('meta-lead-ads', {}, `${appId}:${current.leadgenId}`),
      { source, payload: { metaLeadAdsDeliveryId: id } }, async (tx: any) => {
        // Recheck under the tenant lock immediately before contact creation.
        const active = await tx.metaLeadAdsBinding.findFirst({ where: {
          id: binding.id, organizationId: current.organizationId, appId, pageId: binding.pageId,
          formId: binding.formId, enabled: true,
        }, select: { mode: true, pilotLeadIds: true, activatedAt: true } })
        if (!active || active.mode !== current.acceptedMode || !active.activatedAt || active.activatedAt > current.createdAt ||
            !pilotAllows(active.mode, current.leadgenId, active.pilotLeadIds)) throw new GraphFailure('BINDING_DISABLED', false)
        await assertBillingLimit(current.organizationId, 'leads', 1, tx)
        const assignment = await resolveInboundLeadAssignment({
          organizationId: current.organizationId, sourceKey: source,
          organizationSettings: settingsRow.settings, settings, client: tx,
        })
        const { origin: _origin, ...selectedResponsible } = assignment
        // A fallback User without an active Employee cannot receive the
        // existing assignment notification. Keep the Lead in admin scope.
        const unlinkedFallback = Boolean(selectedResponsible.assignedToId && !selectedResponsible.employeeId)
        if (unlinkedFallback) diagnosticCode = 'UNLINKED_FALLBACK'
        else if (!selectedResponsible.assignedToId) diagnosticCode = 'NO_RESPONSIBLE'
        const responsible = unlinkedFallback
          ? { employeeId: null, assignedToId: null }
          : selectedResponsible
        const created = await tx.lead.create({ data: {
          organizationId: current.organizationId, ...data, ...responsible,
        } })
        await notifyAssignment(tx, 'lead', created)
        return created
      }, { pushOnReplay: false })
    await db.metaLeadAdsDelivery.updateMany({ where: { id, status: 'processing', attempts }, data: {
      status: 'complete', leadId: lead?.id || null, leaseUntil: null, lastErrorCode: diagnosticCode,
    } })
    return 'complete'
  } catch (error: any) {
    const failure = error instanceof GraphFailure ? error : new GraphFailure('PROCESSING_FAILURE', true)
    const retry = failure.retryable && attempts < 8
    await db.metaLeadAdsDelivery.updateMany({ where: { id, status: 'processing', attempts }, data: {
      status: retry ? 'pending' : 'blocked', leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + metaRetryDelay(attempts, failure.retryAfter) * 1000),
      lastErrorCode: failure.code,
    } })
    return retry ? 'retry' : 'blocked'
  }
}

export async function processDueLeadAdsDeliveries(appId: string, secret: string, activationTime: Date, limit = 10) {
  const now = new Date()
  const rows = await db.metaLeadAdsDelivery.findMany({ where: {
    appId,
    OR: [{ status: 'pending', nextAttemptAt: { lte: now } }, { status: 'processing', leaseUntil: { lte: now } }],
  }, select: { id: true }, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: Math.min(limit, 20) })
  const result = { complete: 0, retry: 0, blocked: 0, skipped: 0 }
  for (const row of rows) result[await processLeadAdsDelivery(row.id, appId, secret, activationTime) as keyof typeof result]++
  return result
}
