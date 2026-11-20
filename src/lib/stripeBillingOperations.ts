import { createHash, randomUUID } from 'node:crypto'
import type { Organization, Prisma, PrismaClient, StripeBillingState, StripeBillingOperation, StripeBillingCoordinator } from '@prisma/client'
import { authorizeStripeBilling, type Actor } from './stripeBillingAccess.ts'
import { StripeBillingError } from './stripeBillingConfig.ts'

export const BILLING_LEASE_MS = 60000
// Stripe documents retention of at least 24h. Stop uncertain POST replay at 23h.
export const IDEMPOTENCY_WINDOW_MS = 23 * 3600000
type Tx = Prisma.TransactionClient
export type OperationKind = 'customer' | 'checkout' | 'portal' | 'reconcile'
export type OperationParams = { actor?: Actor; credentialFingerprint: string; request: unknown }
export type Lease = {
  operation: StripeBillingOperation; generation: number; token: string
  organization: Organization; state: StripeBillingState; coordinator: StripeBillingCoordinator
}

export function fingerprint(value: unknown): string {
  const canonical = (v: any): any => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(canonical)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export function organizationFingerprint(org: Organization) {
  const { plan, status, billingProvider, billingStatus, billingCustomerId, billingSubscriptionId, billingPriceId,
    trialStartedAt, trialEndsAt, currentPeriodEndsAt, cancelAtPeriodEnd, graceEndsAt } = org
  // CRM routing, UI and notification writes share settings. Only the billing
  // override belongs to this fence; all administrative billing columns remain.
  const settings = org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings) ? org.settings : {}
  const billingLimits = 'billingLimits' in settings ? settings.billingLimits : null
  return fingerprint({ plan, status, billingProvider, billingStatus, billingCustomerId, billingSubscriptionId,
    billingPriceId, trialStartedAt, trialEndsAt, currentPeriodEndsAt, cancelAtPeriodEnd, graceEndsAt, billingLimits })
}

// This module accepts database callbacks only. Provider work belongs between
// reserve/finalize calls, never in a callback or while a connection is retained.
export async function shortBillingTransaction<T>(db: PrismaClient, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '750ms'")
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2500ms'")
      return work(tx)
    }, { maxWait: 1000, timeout: 5000 })
  } catch (error: any) {
    if (['P2024', 'P2028'].includes(error?.code) || ['55P03', '57014', '40P01'].includes(error?.meta?.code)) {
      throw new StripeBillingError('BILLING_BUSY', 503)
    }
    throw error
  }
}

async function lockedOrganization(tx: Tx, organizationId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`
  if (!rows.length) throw new StripeBillingError('ORGANIZATION_NOT_FOUND', 404)
  return tx.organization.findUniqueOrThrow({ where: { id: organizationId } })
}

export async function reserveBillingOperation(args: {
  db: PrismaClient; organizationId: string; kind: OperationKind; actor?: Actor
  credentialFingerprint: string; event?: { id: string }
  eligible: (org: Organization) => boolean
  request: (org: Organization, state: StripeBillingState, operationId: string) => unknown
}): Promise<Lease | null> {
  return shortBillingTransaction(args.db, async tx => {
    const org = await lockedOrganization(tx, args.organizationId)
    if (args.actor) await authorizeStripeBilling(args.actor, tx)
    if (args.event && await tx.stripeBillingEvent.findUnique({ where: { id: args.event.id } })) return null
    if (args.kind === 'customer' && org.billingCustomerId) throw new StripeBillingError('BILLING_BUSY', 503)
    if (!args.eligible(org)) throw new StripeBillingError('MANUAL_BILLING_REQUIRED')
    const previousState = await tx.stripeBillingState.findUnique({ where: { organizationId: org.id } })
    const state = previousState || await tx.stripeBillingState.create({ data: {
      organizationId: org.id, customerKey: randomUUID(), checkoutKey: randomUUID(),
    } })
    const coordinator = await tx.stripeBillingCoordinator.upsert({ where: { organizationId: org.id }, update: {}, create: { organizationId: org.id } })
    if (args.kind === 'checkout' && coordinator.financialHoldSubscriptionId) throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
    const now = new Date()
    if (coordinator.leaseUntil && coordinator.leaseUntil > now) throw new StripeBillingError('BILLING_BUSY', 503)
    const active = coordinator.operationId ? await tx.stripeBillingOperation.findUniqueOrThrow({ where: { id: coordinator.operationId } }) : null
    if (active && active.kind !== args.kind && active.kind !== 'reconcile' && active.phase !== 'complete') {
      throw new StripeBillingError(active.phase === 'manual_review' ? 'MANUAL_REVIEW_REQUIRED' : 'BILLING_BUSY', 503)
    }
    const dedupeKey = args.kind === 'customer' ? `customer:${org.id}:${state.customerKey}`
      : args.kind === 'checkout' ? `checkout:${org.id}:${state.checkoutKey}`
      : args.kind === 'reconcile' ? `event:${args.event!.id}`
      : active?.kind === 'portal' && active.phase !== 'complete' ? active.dedupeKey : `portal:${randomUUID()}`
    let operation = await tx.stripeBillingOperation.findUnique({ where: { dedupeKey } })
    if (!operation) {
      // Reviewed v1 rows do not prove whether an unmapped Customer POST ran.
      if (args.kind === 'customer' && previousState) throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
      const id = randomUUID()
      const params: OperationParams = { ...(args.actor ? { actor: {
        id: args.actor.id, organizationId: args.actor.organizationId, sessionVersion: args.actor.sessionVersion ?? 0,
      } } : {}),
        credentialFingerprint: args.credentialFingerprint, request: args.request(org, state, id) }
      operation = await tx.stripeBillingOperation.create({ data: {
        id, organizationId: org.id, dedupeKey, kind: args.kind, phase: 'reserved', idempotencyKey: `lh-${args.kind}-${id}`,
        paramsJson: JSON.stringify(params), requestFingerprint: fingerprint(params), organizationFingerprint: organizationFingerprint(org),
        ...(args.kind === 'checkout' && state.checkoutSessionId ? { providerId: state.checkoutSessionId } : {}),
      } })
    }
    if (operation.organizationId !== org.id || operation.kind !== args.kind || fingerprint(JSON.parse(operation.paramsJson)) !== operation.requestFingerprint) {
      throw new StripeBillingError('OPERATION_INTEGRITY_FAILURE', 503)
    }
    if (operation.phase === 'manual_review') throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
    const params = JSON.parse(operation.paramsJson) as OperationParams
    if (params.actor) await authorizeStripeBilling(params.actor, tx)
    operation = await tx.stripeBillingOperation.update({ where: { id: operation.id }, data: {
      phase: 'in_flight', organizationFingerprint: organizationFingerprint(org),
      firstAttemptAt: operation.firstAttemptAt || now,
      idempotencyExpiresAt: operation.idempotencyExpiresAt || new Date(now.getTime() + IDEMPOTENCY_WINDOW_MS),
    } })
    const token = randomUUID(), generation = coordinator.generation + 1
    await tx.stripeBillingCoordinator.update({ where: { organizationId: org.id }, data: {
      operationId: operation.id, generation, leaseToken: token, leaseUntil: new Date(now.getTime() + BILLING_LEASE_MS),
    } })
    return { operation, generation, token, organization: org, state, coordinator }
  })
}

function fenced(coordinator: StripeBillingCoordinator, lease: Lease) {
  return coordinator.operationId === lease.operation.id && coordinator.generation === lease.generation &&
    coordinator.leaseToken === lease.token && coordinator.leaseUntil && coordinator.leaseUntil > new Date()
}

export async function markProviderAttempt(db: PrismaClient, lease: Lease, enabled?: () => boolean) {
  await shortBillingTransaction(db, async tx => {
    const org = await lockedOrganization(tx, lease.organization.id)
    const coordinator = await tx.stripeBillingCoordinator.findUniqueOrThrow({ where: { organizationId: org.id } })
    if (!fenced(coordinator, lease)) throw new StripeBillingError('BILLING_STALE_LEASE', 503)
    if (enabled && !enabled()) throw new StripeBillingError('BILLING_UNAVAILABLE', 503)
    if (organizationFingerprint(org) !== lease.operation.organizationFingerprint) throw new StripeBillingError('ADMINISTRATIVE_CHANGE')
    const params = JSON.parse(lease.operation.paramsJson) as OperationParams
    if (params.actor) await authorizeStripeBilling(params.actor, tx)
    await tx.stripeBillingOperation.update({ where: { id: lease.operation.id }, data: {
      postStartedAt: lease.operation.postStartedAt || new Date(), phase: 'post_started',
    } })
  })
}

export async function failBillingOperation(db: PrismaClient, lease: Lease, error: unknown) {
  const code = error instanceof StripeBillingError ? error.code : 'BILLING_RETRY'
  const manual = ['MANUAL_REVIEW_REQUIRED', 'IDEMPOTENCY_WINDOW_EXPIRED', 'CACHED_PROVIDER_FAILURE', 'OPERATION_INTEGRITY_FAILURE'].includes(code)
  const safeFailure = ['PORTAL_CONFIGURATION_INVALID', 'PRICE_CONFIGURATION_INVALID', 'SUBSCRIPTION_EXISTS', 'CUSTOMER_MISMATCH', 'CHECKOUT_MISMATCH'].includes(code)
  await shortBillingTransaction(db, async tx => {
    await lockedOrganization(tx, lease.organization.id)
    const coordinator = await tx.stripeBillingCoordinator.findUniqueOrThrow({ where: { organizationId: lease.organization.id } })
    if (!fenced(coordinator, lease)) return // Never release/overwrite a newer worker.
    await tx.stripeBillingOperation.update({ where: { id: lease.operation.id }, data: { phase: manual ? 'manual_review' : safeFailure ? 'failed' : 'uncertain', errorCode: code } })
    await tx.stripeBillingCoordinator.update({ where: { organizationId: lease.organization.id }, data: {
      leaseToken: null, leaseUntil: null, ...(safeFailure ? { operationId: null } : {}),
    } })
  })
}

export async function finalizeBillingOperation<T>(args: {
  db: PrismaClient; lease: Lease; providerId?: string; result: unknown; enabled?: () => boolean
  financialRefs?: { invoiceId?: string; paymentIntentId?: string; chargeId?: string }
  event?: { id: string; type: string; created: number }
  apply: (tx: Tx, org: Organization, coordinator: StripeBillingCoordinator) => Promise<T>
}): Promise<T | { ignored: true }> {
  const outcome = await shortBillingTransaction(args.db, async tx => {
    const org = await lockedOrganization(tx, args.lease.organization.id)
    const coordinator = await tx.stripeBillingCoordinator.findUniqueOrThrow({ where: { organizationId: org.id } })
    if (!fenced(coordinator, args.lease)) throw new StripeBillingError('BILLING_STALE_LEASE', 503)
    let rejected: StripeBillingError | null = null
    if (args.enabled && !args.enabled()) rejected = new StripeBillingError('BILLING_UNAVAILABLE', 503)
    else if (organizationFingerprint(org) !== args.lease.operation.organizationFingerprint) rejected = new StripeBillingError('ADMINISTRATIVE_CHANGE')
    const params = JSON.parse(args.lease.operation.paramsJson) as OperationParams
    if (params.actor && !rejected) {
      try { await authorizeStripeBilling(params.actor, tx) } catch (error) { rejected = error as StripeBillingError }
    }
    // Persist the provider identifier even when an override/revocation wins.
    // A DB failure rolls this back too; immutable key replay remains bounded.
    // A rejected projection is not a completed event. Retain verified financial
    // references and a durable manual-review operation for genuine overrides.
    const result = !rejected ? await args.apply(tx, org, coordinator) : { ignored: true as const }
    if (args.event && !rejected) await tx.stripeBillingEvent.create({ data: {
      id: args.event.id, organizationId: org.id, type: args.event.type, stripeCreated: args.event.created,
    } })
    await tx.stripeBillingOperation.update({ where: { id: args.lease.operation.id }, data: {
      ...args.financialRefs, ...(args.providerId ? { providerId: args.providerId } : {}), resultJson: JSON.stringify(args.result),
      phase: !rejected ? 'complete' : rejected.code === 'BILLING_UNAVAILABLE' ? 'uncertain' : 'manual_review',
      errorCode: rejected?.code || null,
    } })
    await tx.stripeBillingCoordinator.update({ where: { organizationId: org.id }, data: {
      leaseToken: null, leaseUntil: null, ...(!rejected ? { operationId: null } : {}),
    } })
    return { result, rejected }
  })
  if (outcome.rejected) throw outcome.rejected
  return outcome.result
}
