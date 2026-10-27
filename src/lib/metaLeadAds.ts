import { createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { inboundEventKey, inboundLeadOnce } from '@/lib/inboundLeadEvent'
import { applyLeadWebhookMapping, getLeadWebhookSettings } from '@/lib/leadWebhook'
import { normalizeLeadBody } from '@/lib/leads'
import { resolveInboundLeadAssignment } from '@/lib/leadRouting'
import { notifyAssignment } from '@/lib/notifications'
import { assertBillingLimit } from '@/lib/billing'
import { leadAdsSource, metaNumericId, metaRetryDelay, pilotAllows, type MetaLeadAdsEvent } from '@/lib/metaLeadAdsPolicy'
import { leadAdsTupleAuthorized } from '@/lib/metaLeadAdsAuthorization'

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

export async function acceptLeadAdsEvents(events: MetaLeadAdsEvent[], appId: string, receiptKey: string) {
  if (!events.length) return { accepted: 0, shadow: 0, replayed: 0, rejected: 0 }
  // The signed HTTP body is already bounded to 64 KiB. One short transaction
  // locks only the referenced bindings and accounts for the entire package.
  // A DB error rolls back all new receipts and the caller returns 503.
  return db.$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1500ms'")
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'")
    const tuples = new Map(events.map(event => [`${event.pageId}:${event.formId}`, {
      pageId: event.pageId, formId: event.formId,
    }]))
    const candidates = await tx.metaLeadAdsBinding.findMany({ where: {
      appId, OR: Array.from(tuples.values()),
    }, select: { id: true } })
    const ids = candidates.map((row: any) => row.id)
    if (ids.length) await tx.$queryRawUnsafe(
      'SELECT id FROM "MetaLeadAdsBinding" WHERE id = ANY($1::text[]) ORDER BY id FOR SHARE', ids)
    const bindings = ids.length ? await tx.metaLeadAdsBinding.findMany({ where: { id: { in: ids }, appId },
      select: { id: true, organizationId: true, pageId: true, formId: true,
        enabled: true, mode: true, pilotLeadIds: true, activatedAt: true } }) : []
    const byTuple = new Map<string, any>(bindings.map((row: any) => [`${row.pageId}:${row.formId}`, row]))
    const pending = new Map<string, any>()
    let rejected = 0, replayed = 0
    for (const event of events) {
      const binding = byTuple.get(`${event.pageId}:${event.formId}`)
      if (!binding?.enabled || !binding.activatedAt || binding.mode === 'off' ||
          !leadAdsTupleAuthorized({ appId, pageId: event.pageId, formId: event.formId,
            organizationId: binding.organizationId, mode: binding.mode, pageToken: pageToken(event.pageId) }) ||
          (binding.mode !== 'shadow' && !pilotAllows(binding.mode, event.leadgenId, binding.pilotLeadIds))) {
        rejected++; continue
      }
      const eventFingerprint = receiptFingerprint(receiptKey, appId, event.leadgenId)
      const existing = pending.get(eventFingerprint)
      if (existing) {
        if (existing.bindingId === binding.id) replayed++
        else rejected++
        continue
      }
      pending.set(eventFingerprint, { organizationId: binding.organizationId, bindingId: binding.id,
        appId, eventFingerprint, leadgenId: binding.mode === 'shadow' ? `shadow:${eventFingerprint}` : event.leadgenId,
        acceptedMode: binding.mode, status: binding.mode === 'shadow' ? 'shadow' : 'pending' })
    }
    const values = Array.from(pending.values())
    if (!values.length) return { accepted: 0, shadow: 0, replayed, rejected }
    const fingerprints = values.map(row => row.eventFingerprint)
    const before = await tx.metaLeadAdsDelivery.findMany({ where: { appId, eventFingerprint: { in: fingerprints } },
      select: { eventFingerprint: true, bindingId: true } })
    const known = new Map(before.map((row: any) => [row.eventFingerprint, row.bindingId]))
    // A retried envelope skips its already committed prefix. Only unfamiliar
    // fingerprints reach INSERT; concurrent duplicates still use the unique
    // key and are verified against their binding after commit contention.
    const missing = values.filter(row => !known.has(row.eventFingerprint))
    for (let offset = 0; offset < missing.length; offset += 150) {
      await tx.metaLeadAdsDelivery.createMany({ data: missing.slice(offset, offset + 150), skipDuplicates: true })
    }
    const after = await tx.metaLeadAdsDelivery.findMany({ where: { appId, eventFingerprint: { in: fingerprints } },
      select: { eventFingerprint: true, bindingId: true } })
    const stored = new Map(after.map((row: any) => [row.eventFingerprint, row.bindingId]))
    let accepted = 0, shadow = 0
    for (const row of values) {
      if (stored.get(row.eventFingerprint) !== row.bindingId) { rejected++; continue }
      if (known.has(row.eventFingerprint)) { replayed++; continue }
      if (row.status === 'shadow') shadow++
      else accepted++
    }
    return { accepted, shadow, replayed, rejected }
  }, { timeout: 40000, maxWait: 2000 })
}

class GraphFailure extends Error {
  constructor(public code: string, public retryable: boolean, public retryAfter?: number) { super(code) }
}

async function fetchLead(leadgenId: string, pageId: string, secret: string, deadline: number) {
  const token = pageToken(pageId)
  if (!token) throw new GraphFailure('PAGE_TOKEN_MISSING', true)
  const version = /^v\d+\.\d+$/.test(process.env.META_LEAD_ADS_GRAPH_VERSION || '')
    ? process.env.META_LEAD_ADS_GRAPH_VERSION : 'v23.0'
  const url = new URL(`https://graph.facebook.com/${version}/${leadgenId}`)
  url.searchParams.set('fields', 'id,form_id,platform,field_data,created_time')
  url.searchParams.set('appsecret_proof', createHmac('sha256', secret).update(token).digest('hex'))
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(Math.min(10000, Math.max(1000, deadline - Date.now() - 2000))),
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

export async function processLeadAdsDelivery(id: string, appId: string, secret: string, activationTime: Date,
  deadline = Date.now() + 45000) {
  // Prisma defaults use PostgreSQL time with microsecond precision. A newly
  // inserted receipt can be later than the same-millisecond JavaScript clock.
  // Use the database clock for due and lease comparisons.
  const [{ now }] = await db.$queryRawUnsafe('SELECT clock_timestamp() AS now') as [{ now: Date }]
  const current = await db.metaLeadAdsDelivery.findUnique({ where: { id }, select: {
    id: true, status: true, attempts: true, nextAttemptAt: true, leaseUntil: true,
    leadgenId: true, appId: true, bindingId: true, organizationId: true, acceptedMode: true, createdAt: true,
  } })
  if (!current || current.appId !== appId || !metaNumericId(current.leadgenId)) return 'skipped'
  const eligible = current.status === 'pending' && current.nextAttemptAt <= now ||
    current.status === 'processing' && current.leaseUntil && current.leaseUntil <= now
  if (!eligible) return 'skipped'
  if (Date.now() + 35000 >= deadline) return 'skipped'
  if (current.attempts >= 8) {
    const eventKey = inboundEventKey('meta-lead-ads', {}, `${appId}:${current.leadgenId}`)
    const prior = await db.leadWebhookLog.findFirst({ where: { organizationId: current.organizationId,
      status: 'created', payload: { path: ['assignmentEventKey'], equals: eventKey } }, select: { leadId: true } })
    const recovered = Boolean(prior?.leadId && await db.lead.findFirst({ where: {
      id: prior.leadId, organizationId: current.organizationId }, select: { id: true } }))
    await db.metaLeadAdsDelivery.updateMany({ where: { id, attempts: current.attempts, status: current.status },
      data: { status: recovered ? 'complete' : 'blocked', leadId: recovered ? prior.leadId : null,
        leaseUntil: null, lastErrorCode: recovered ? 'RECOVERED_AFTER_COMMIT' : 'MAX_ATTEMPTS' } })
    return recovered ? 'complete' : 'blocked'
  }
  const claimed = await db.metaLeadAdsDelivery.updateMany({ where: {
    id, attempts: current.attempts, status: current.status,
    ...(current.status === 'pending' ? { nextAttemptAt: { lte: now } } : { leaseUntil: { lte: now } }),
  }, data: { status: 'processing', attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + 120000), lastErrorCode: null } })
  if (claimed.count !== 1) return 'skipped'
  const attempts = current.attempts + 1
  try {
    if (current.createdAt < activationTime) throw new GraphFailure('GLOBAL_ACTIVATION_EXPIRED', false)
    // Start fetch under a short binding-row lock, then commit before waiting
    // on Graph. DELETE/PUT update that same row. Once disable commits, no new
    // request can be initiated; an already started response must still pass
    // the final tenant-locked authorization check before a Lead is created.
    const graphStart = await db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1500ms'")
      const locked = await tx.$queryRawUnsafe('SELECT id FROM "MetaLeadAdsBinding" WHERE id = $1 AND "organizationId" = $2 FOR SHARE', current.bindingId, current.organizationId)
      if (!locked.length) return { failure: { code: 'BINDING_DISABLED', retryable: false } }
      const active = await tx.metaLeadAdsBinding.findFirst({ where: {
        id: current.bindingId, organizationId: current.organizationId, appId, enabled: true,
      }, select: { id: true, pageId: true, formId: true, mode: true, pilotLeadIds: true, activatedAt: true } })
      if (!active || active.mode !== current.acceptedMode || !active.activatedAt || active.activatedAt > current.createdAt ||
          !pilotAllows(active.mode, current.leadgenId, active.pilotLeadIds) ||
          !leadAdsTupleAuthorized({ appId, pageId: active.pageId, formId: active.formId,
            organizationId: current.organizationId, mode: active.mode, pageToken: pageToken(active.pageId) })) {
        return { failure: { code: 'BINDING_DISABLED', retryable: false } }
      }
      const request = fetchLead(current.leadgenId, active.pageId, secret, deadline)
        .then(value => ({ value }), error => ({ error }))
      return { binding: active, request }
    }, { timeout: 4000, maxWait: 1000 })
    if (graphStart.failure) throw new GraphFailure(graphStart.failure.code, graphStart.failure.retryable)
    const graphResult = await graphStart.request
    if (graphResult.error) throw graphResult.error
    const binding = graphStart.binding
    const metaLead = graphResult.value
    if (metaNumericId(metaLead?.id) !== current.leadgenId || metaNumericId(metaLead?.form_id) !== binding.formId) {
      throw new GraphFailure('GRAPH_IDENTITY_MISMATCH', false)
    }
    const createdAt = typeof metaLead?.created_time === 'string' ? Date.parse(metaLead.created_time) : NaN
    if (!Number.isFinite(createdAt) || createdAt > Date.now() + 300000 || Date.now() - createdAt > 365 * 86400000) {
      throw new GraphFailure('LEAD_AGE_UNVERIFIED', false)
    }
    if (Date.now() + 23000 >= deadline) throw new GraphFailure('DEADLINE_RETRY', true)
    const source = leadAdsSource(metaLead.platform)
    const settingsRow = await db.organization.findUnique({ where: { id: current.organizationId }, select: { settings: true } })
    if (!settingsRow) throw new GraphFailure('ORGANIZATION_MISSING', false)
    const settings = getLeadWebhookSettings(settingsRow.settings)
    const mapped = applyLeadWebhookMapping(fieldsToPayload(metaLead), settings.leadWebhookFieldMap || [])
    const data = normalizeLeadBody({ ...mapped, source, messengerId: `meta-lead-ads:${current.leadgenId}` })
    if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) throw new GraphFailure('EMPTY_CONTACT', false)
    if (Date.now() + 23000 >= deadline) throw new GraphFailure('DEADLINE_RETRY', true)
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
            !pilotAllows(active.mode, current.leadgenId, active.pilotLeadIds) ||
            !leadAdsTupleAuthorized({ appId, pageId: binding.pageId, formId: binding.formId,
              organizationId: current.organizationId, mode: active.mode, pageToken: pageToken(binding.pageId) })) {
          throw new GraphFailure('BINDING_DISABLED', false)
        }
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
      }, { pushOnReplay: false, dispatchPush: false, shortLockWait: true,
        transactionTimeoutMs: Math.min(15000, Math.max(1000, deadline - Date.now() - 7000)) })
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

export async function processDueLeadAdsDeliveries(appId: string, secret: string, activationTime: Date,
  deadline = Date.now() + 45000, limit = 20) {
  const now = new Date()
  const rows = await db.metaLeadAdsDelivery.findMany({ where: {
    appId,
    OR: [{ status: 'pending', nextAttemptAt: { lte: now } }, { status: 'processing', leaseUntil: { lte: now } }],
  }, select: { id: true }, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: Math.min(limit, 20) })
  const result = { complete: 0, retry: 0, blocked: 0, skipped: 0 }
  for (const row of rows) {
    if (Date.now() + 35000 >= deadline) break
    result[await processLeadAdsDelivery(row.id, appId, secret, activationTime, deadline) as keyof typeof result]++
  }
  const oldest = await db.metaLeadAdsDelivery.findFirst({ where: { appId, status: 'pending' },
    select: { createdAt: true }, orderBy: { createdAt: 'asc' } })
  return { ...result, pending: await db.metaLeadAdsDelivery.count({ where: { appId, status: 'pending' } }),
    blockedTotal: await db.metaLeadAdsDelivery.count({ where: { appId, status: 'blocked' } }),
    oldestPendingSeconds: oldest ? Math.max(0, Math.floor((Date.now() - oldest.createdAt.getTime()) / 1000)) : null }
}
