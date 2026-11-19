import Stripe from 'stripe'
import { randomUUID } from 'node:crypto'
import type { Organization, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma.ts'
import { requireStripeBillingConfig, stripeBillingConfig, STRIPE_API_VERSION, STRIPE_BILLING_PROVIDER,
  StripeBillingError, type StripeBillingConfig, type StripePlan } from './stripeBillingConfig.ts'
import { authorizeStripeBilling, type Actor } from './stripeBillingAccess.ts'
import { canStartStripeCheckout, stripeManaged } from './stripeBillingPolicy.ts'
import { fingerprint, reserveBillingOperation, finalizeBillingOperation, failBillingOperation,
  markProviderAttempt, type Lease, type OperationParams } from './stripeBillingOperations.ts'
import { stripeObjectId as objectId, verifyStripeSettlement, type Settlement } from './stripeBillingSettlement.ts'
export { authorizeStripeBilling } from './stripeBillingAccess.ts'

const INTEGRATION = 'legalhub-billing-test-v1'
const TERMINAL = new Set(['canceled', 'incomplete_expired'])
const WEBHOOK_TYPES = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.updated', 'invoice.voided', 'invoice.marked_uncollectible', 'invoice_payment.paid',
  'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired',
  'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
  'credit_note.created', 'credit_note.updated', 'credit_note.voided',
  'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.dispute.funds_withdrawn', 'charge.dispute.funds_reinstated',
])
export type StripeBillingRuntime = { db: PrismaClient; stripe: Stripe; config: StripeBillingConfig; isEnabled?: () => boolean }
export function stripeRuntime(): StripeBillingRuntime {
  const config = requireStripeBillingConfig()
  return { db: prisma, config, isEnabled: () => Boolean(stripeBillingConfig()),
    stripe: new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 0, timeout: 8000 }) }
}
export function stripePlanForPrice(price: Stripe.Price, config: StripeBillingConfig, requireActive = false): StripePlan {
  const plan = (Object.keys(config.prices) as StripePlan[]).find(key => config.prices[key] === price.id)
  if (!plan || price.livemode !== false || (requireActive && !price.active) || price.currency !== 'pln' ||
      price.unit_amount !== (plan === 'starter' ? 24900 : 49900) || price.type !== 'recurring' ||
      price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit') {
    throw new StripeBillingError('PRICE_CONFIGURATION_INVALID', 503)
  }
  return plan
}


async function verifyCustomer(stripe: Stripe, customerId: string, organizationId: string) {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted || customer.livemode !== false || customer.metadata.organizationId !== organizationId ||
      customer.metadata.integration !== INTEGRATION) throw new StripeBillingError('CUSTOMER_MISMATCH')
}
async function nonterminalSubscriptions(stripe: Stripe, customer: string) {
  let starting_after: string | undefined
  const active: Stripe.Subscription[] = []
  for (let page = 0; page < 10; page++) {
    const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, ...(starting_after ? { starting_after } : {}) })
    active.push(...list.data.filter(sub => !TERMINAL.has(sub.status)))
    if (!list.has_more) return active
    starting_after = list.data.at(-1)?.id
    if (!starting_after) break
  }
  throw new StripeBillingError('SUBSCRIPTION_HISTORY_REQUIRES_REVIEW')
}
function parameters<T>(lease: Lease, runtime: StripeBillingRuntime): T {
  const saved = JSON.parse(lease.operation.paramsJson) as OperationParams
  if (saved.credentialFingerprint !== fingerprint(runtime.config.secretKey)) throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
  return saved.request as T
}
async function mutation<T>(runtime: StripeBillingRuntime, lease: Lease, work: (key: string) => Promise<T>): Promise<T> {
  if (!lease.operation.idempotencyExpiresAt || lease.operation.idempotencyExpiresAt <= new Date()) {
    throw new StripeBillingError('IDEMPOTENCY_WINDOW_EXPIRED')
  }
  await markProviderAttempt(runtime.db, lease, runtime.isEnabled)
  try { return await work(lease.operation.idempotencyKey) }
  catch (error: any) {
    // Stripe caches executed errors, including 500. No blind new key or object.
    if (error?.code === 'idempotency_key_in_use') throw new StripeBillingError('BILLING_BUSY', 503)
    if ((error?.statusCode >= 500) || error?.type === 'StripeIdempotencyError') throw new StripeBillingError('CACHED_PROVIDER_FAILURE')
    throw error
  }
}
async function drive<T>(runtime: StripeBillingRuntime, lease: Lease, work: () => Promise<T>): Promise<T> {
  try { return await work() }
  catch (error) {
    try { await failBillingOperation(runtime.db, lease, error) } catch { /* Lease expiry also releases ownership; never log provider data. */ }
    throw error
  }
}

export async function createStripeCheckout(actor: Actor | null, plan: StripePlan, runtime = stripeRuntime()): Promise<{ url: string }> {
  if (plan !== 'starter' && plan !== 'pro') throw new StripeBillingError('INVALID_PLAN', 400)
  const { db, stripe, config } = runtime
  const organizationId = await authorizeStripeBilling(actor, db)
  const current = await db.organization.findUniqueOrThrow({ where: { id: organizationId } })
  if (!current.billingCustomerId) {
    const lease = (await reserveBillingOperation({ db, organizationId, kind: 'customer', actor: actor!,
      credentialFingerprint: fingerprint(config.secretKey), eligible: canStartStripeCheckout,
      request: (_org, _state, id) => ({ metadata: { organizationId, integration: INTEGRATION, operationId: id } }),
    }))!
    await drive(runtime, lease, async () => {
      const params = parameters<Stripe.CustomerCreateParams>(lease, runtime)
      // No interactive transaction or checked-out DB connection spans this I/O.
      const customer = lease.operation.providerId ? await stripe.customers.retrieve(lease.operation.providerId)
        : await mutation(runtime, lease, key => stripe.customers.create(params, { idempotencyKey: key }))
      if (customer.deleted || customer.livemode !== false || customer.metadata.organizationId !== organizationId ||
          customer.metadata.operationId !== lease.operation.id) throw new StripeBillingError('CUSTOMER_MISMATCH')
      await finalizeBillingOperation({ db, lease, enabled: runtime.isEnabled, providerId: customer.id, result: { id: customer.id },
        apply: async (tx, org) => tx.organization.update({ where: { id: org.id }, data: {
          billingCustomerId: customer.id, billingProvider: STRIPE_BILLING_PROVIDER, billingStatus: 'incomplete',
        } }),
      })
    })
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const lease = (await reserveBillingOperation({ db, organizationId, kind: 'checkout', actor: actor!,
      credentialFingerprint: fingerprint(config.secretKey), eligible: canStartStripeCheckout,
      request: (org, _state, id) => ({ plan, priceId: config.prices[plan], body: {
        mode: 'subscription', customer: org.billingCustomerId!, allowed_payment_method_types: ['card'],
        line_items: [{ price: config.prices[plan], quantity: 1 }],
        subscription_data: { metadata: { organizationId, integration: INTEGRATION, operationId: id } },
        metadata: { organizationId, integration: INTEGRATION, operationId: id }, client_reference_id: organizationId,
        success_url: `${config.appUrl}/settings/billing?checkout=returned`, cancel_url: `${config.appUrl}/settings/billing?checkout=canceled`,
      } }),
    }))!
    const result = await drive(runtime, lease, async () => {
      const params = parameters<{ plan: StripePlan; priceId: string; body: Stripe.Checkout.SessionCreateParams }>(lease, runtime)
      const customer = String(params.body.customer)
      if (!customer || customer !== lease.organization.billingCustomerId) throw new StripeBillingError('CUSTOMER_MISMATCH')
      await verifyCustomer(stripe, customer, organizationId)
      const active = await nonterminalSubscriptions(stripe, customer)
      const recovering = Boolean(lease.operation.postStartedAt && !lease.operation.providerId)
      if (active.length && (!recovering || active.length !== 1 || active[0].metadata.operationId !== lease.operation.id)) throw new StripeBillingError('SUBSCRIPTION_EXISTS')
      let recoveredId: string | null = null
      if (recovering) {
        const sessions = await stripe.checkout.sessions.list({ customer, limit: 100 })
        const matching = sessions.data.filter(session => session.metadata?.operationId === lease.operation.id && objectId(session.customer) === customer)
        if (sessions.has_more || matching.length > 1) throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
        recoveredId = matching[0]?.id || null
        if (active.length && !recoveredId) throw new StripeBillingError('MANUAL_REVIEW_REQUIRED')
      }
      let session: Stripe.Checkout.Session
      const knownId = lease.operation.providerId || recoveredId
      if (knownId) session = await stripe.checkout.sessions.retrieve(knownId)
      else {
        const price = await stripe.prices.retrieve(params.priceId)
        stripePlanForPrice(price, { ...config, prices: { ...config.prices, [params.plan]: params.priceId } }, true)
        session = await mutation(runtime, lease, key => stripe.checkout.sessions.create(params.body, { idempotencyKey: key }))
      }
      if (session.livemode !== false || objectId(session.customer) !== customer) throw new StripeBillingError('CHECKOUT_MISMATCH')
      let terminal = session.status === 'expired', pending = false
      if (session.status === 'complete') {
        const subId = objectId(session.subscription)
        if (!subId) throw new StripeBillingError('CHECKOUT_MISMATCH')
        terminal = TERMINAL.has((await stripe.subscriptions.retrieve(subId)).status)
        pending = !terminal
      }
      if (!terminal && !pending && (session.status !== 'open' || !session.url)) throw new StripeBillingError('CHECKOUT_UNAVAILABLE', 503)
      await finalizeBillingOperation({ db, lease, enabled: runtime.isEnabled, providerId: session.id,
        result: { id: session.id, terminal, pending }, apply: async (tx, org) => {
          if (terminal) return tx.stripeBillingState.update({ where: { organizationId }, data: {
            checkoutKey: randomUUID(), checkoutSessionId: null, checkoutExpiresAt: null,
          } })
          await tx.stripeBillingState.update({ where: { organizationId }, data: {
            checkoutSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000),
          } })
          return tx.organization.update({ where: { id: org.id }, data: {
            plan: 'free', billingStatus: 'incomplete', billingSubscriptionId: null, billingPriceId: null,
            currentPeriodEndsAt: null, cancelAtPeriodEnd: false, graceEndsAt: null,
          } })
        },
      })
      if (pending) throw new StripeBillingError('PAYMENT_CONFIRMATION_PENDING')
      return terminal ? null : { url: session.url! }
    })
    if (result) return result
  }
  throw new StripeBillingError('BILLING_RETRY', 503)
}

export async function createStripePortal(actor: Actor | null, runtime = stripeRuntime()): Promise<{ url: string }> {
  const { db, stripe, config } = runtime
  const organizationId = await authorizeStripeBilling(actor, db)
  const lease = (await reserveBillingOperation({ db, organizationId, kind: 'portal', actor: actor!,
    credentialFingerprint: fingerprint(config.secretKey), eligible: org => stripeManaged(org) && Boolean(org.billingCustomerId),
    request: org => ({ customer: org.billingCustomerId!, configuration: config.portalConfiguration, return_url: `${config.appUrl}/settings/billing` }),
  }))!
  return drive(runtime, lease, async () => {
    const params = parameters<Stripe.BillingPortal.SessionCreateParams>(lease, runtime)
    await verifyCustomer(stripe, params.customer!, organizationId)
    const portal = await stripe.billingPortal.configurations.retrieve(params.configuration!)
    if (!portal.active || portal.livemode !== false || portal.features.subscription_update.enabled ||
        !portal.features.payment_method_update.enabled || !portal.features.subscription_cancel.enabled ||
        portal.features.subscription_cancel.mode !== 'at_period_end') throw new StripeBillingError('PORTAL_CONFIGURATION_INVALID', 503)
    const session = await mutation(runtime, lease, key => stripe.billingPortal.sessions.create(params, { idempotencyKey: key }))
    await finalizeBillingOperation({ db, lease, enabled: runtime.isEnabled, providerId: session.id, result: { id: session.id }, apply: async () => ({ url: session.url }) })
    return { url: session.url }
  })
}

type References = { customer: string | null; subscription: string | null; adjustment?: string }
async function eventReferences(event: Stripe.Event, db: PrismaClient): Promise<References> {
  const object = event.data.object
  if (object.object === 'subscription') return { customer: objectId(object.customer), subscription: object.id }
  if (object.object === 'checkout.session') return { customer: objectId(object.customer), subscription: objectId(object.subscription) }
  if (object.object === 'invoice') return { customer: objectId(object.customer), subscription: objectId(object.parent?.subscription_details?.subscription) }
  let invoiceId: string | null = null, chargeId: string | null = null, intentId: string | null = null, adjustment: string | undefined
  if (object.object === 'invoice_payment') invoiceId = objectId(object.invoice)
  else if (object.object === 'credit_note') { invoiceId = objectId(object.invoice); adjustment = 'CREDIT_NOTE' }
  else if (object.object === 'charge') { chargeId = object.id; adjustment = 'REFUND' }
  else if (object.object === 'refund') { chargeId = objectId(object.charge); intentId = objectId(object.payment_intent); adjustment = 'REFUND' }
  else if (object.object === 'dispute') { chargeId = objectId(object.charge); adjustment = 'DISPUTE' }
  const filters = [invoiceId ? { invoiceId } : null, chargeId ? { chargeId } : null, intentId ? { paymentIntentId: intentId } : null].filter((v): v is NonNullable<typeof v> => Boolean(v))
  if (!filters.length) return { customer: null, subscription: null }
  // Only previously verified provider relationships may resolve adjustment
  // ownership. If delivery precedes the first invoice proof, ask Stripe to retry.
  // No network request happens before durable tenant reservation/generation.
  const mapping = await db.stripeBillingOperation.findFirst({ where: { OR: filters }, orderBy: { createdAt: 'desc' } })
  const subscription = mapping?.resultJson ? JSON.parse(mapping.resultJson).subscriptionId : null
  if (!mapping || !subscription) throw new StripeBillingError('FINANCIAL_MAPPING_PENDING', 503)
  const org = await db.organization.findUniqueOrThrow({ where: { id: mapping.organizationId } })
  return { customer: org.billingCustomerId, subscription, adjustment }
}

async function projectSubscription(tx: Prisma.TransactionClient, org: Organization, coordinator: Lease['coordinator'], subscription: Stripe.Subscription,
  plan: StripePlan, settlement: Settlement, adjustment: string | undefined, graceDays: number) {
  const item = subscription.items.data[0]
  const reason = adjustment || (coordinator.financialHoldSubscriptionId === subscription.id ? coordinator.reviewReason || 'MANUAL_REVIEW_REQUIRED'
    : settlement.state === 'manual_review' ? settlement.reason : null)
  const manualReview = Boolean(reason)
  const paid = settlement.state === 'paid' && !manualReview && subscription.status === 'active'
  const status = TERMINAL.has(subscription.status) ? subscription.status : manualReview ? 'manual_review_required'
    : subscription.status === 'active' && !paid ? 'past_due' : subscription.status
  const graceEndsAt = status === 'past_due' && org.plan !== 'free'
    ? new Date(Math.min(org.graceEndsAt?.getTime() ?? Infinity, (item.current_period_start + graceDays * 86400) * 1000)) : null
  const paidThrough = paid ? settlement.paidThrough! : coordinator.paidThrough
  await tx.stripeBillingCoordinator.update({ where: { organizationId: org.id }, data: {
    ...(paid ? { paidThrough: settlement.paidThrough! } : {}),
    ...(manualReview ? { financialHoldSubscriptionId: subscription.id, reviewReason: reason } : {}),
  } })
  await tx.organization.update({ where: { id: org.id }, data: {
    billingSubscriptionId: subscription.id, billingPriceId: item.price.id, billingStatus: status,
    currentPeriodEndsAt: manualReview || subscription.cancel_at_period_end ? paidThrough : new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end, graceEndsAt, ...(paid ? { plan } : {}),
  } })
  return { processed: true, ...(manualReview ? { manualReview: true, reason } : {}) }
}

export async function processStripeEvent(event: Stripe.Event, runtime = stripeRuntime()) {
  const { db, stripe, config } = runtime
  if (event.livemode !== false || event.account) throw new StripeBillingError('TEST_MODE_REQUIRED', 400)
  if (!WEBHOOK_TYPES.has(event.type)) return { ignored: true }
  if (await db.stripeBillingEvent.findUnique({ where: { id: event.id } })) return { duplicate: true }
  // Resolve signed identifiers through previously verified, tenant-bound proof.
  const refs = await eventReferences(event, db)
  if (!refs.customer) return { ignored: true }
  const mapped = await db.organization.findUnique({ where: { billingCustomerId: refs.customer }, select: { id: true } })
  if (!mapped) {
    const metadata = 'metadata' in event.data.object ? event.data.object.metadata : null
    if (metadata?.integration === INTEGRATION) throw new StripeBillingError('MAPPING_PENDING', 503)
    return { ignored: true }
  }
  const lease = await reserveBillingOperation({ db, organizationId: mapped.id, kind: 'reconcile', event,
    credentialFingerprint: fingerprint(config.secretKey), eligible: org => org.billingCustomerId === refs.customer,
    request: () => ({ event: { id: event.id, type: event.type, created: event.created }, refs, prices: config.prices, graceDays: config.graceDays }),
  })
  if (!lease) return { duplicate: true }
  return drive(runtime, lease, async () => {
    const params = parameters<{ event: { id: string; type: string; created: number }; refs: References; prices: StripeBillingConfig['prices']; graceDays: number }>(lease, runtime)
    let subscription: Stripe.Subscription | null = null, settlement: Settlement | null = null, plan: StripePlan | null = null
    const org = lease.organization
    if (stripeManaged(org) && params.refs.subscription) {
      await verifyCustomer(stripe, org.billingCustomerId!, org.id)
      subscription = await stripe.subscriptions.retrieve(params.refs.subscription)
      if (subscription.livemode !== false || objectId(subscription.customer) !== org.billingCustomerId ||
          subscription.metadata.organizationId !== org.id || subscription.metadata.integration !== INTEGRATION) throw new StripeBillingError('SUBSCRIPTION_MISMATCH')
      if (org.billingSubscriptionId !== subscription.id) {
        if (!lease.state.checkoutSessionId) throw new StripeBillingError('CHECKOUT_MAPPING_PENDING', 503)
        const session = await stripe.checkout.sessions.retrieve(lease.state.checkoutSessionId)
        if (session.livemode !== false || session.status !== 'complete' || objectId(session.customer) !== org.billingCustomerId || objectId(session.subscription) !== subscription.id) {
          if (!org.billingSubscriptionId) throw new StripeBillingError('CHECKOUT_MAPPING_PENDING', 503)
          subscription = null // Late event for an old subscription.
        }
      }
      if (subscription) {
        const item = subscription.items.data[0]
        if (subscription.status === 'trialing' || subscription.items.has_more || subscription.items.data.length !== 1 || item?.quantity !== 1 ||
            !Number.isFinite(item.current_period_start) || !Number.isFinite(item.current_period_end) || item.current_period_end <= item.current_period_start) throw new StripeBillingError('SUBSCRIPTION_ITEMS_INVALID')
        // A recovered Checkout still charges its original immutable Price even
        // if the configured prices changed while the first response was lost.
        // Honor that server-persisted intent, never a client supplied Price.
        let prices = params.prices
        if (lease.state.checkoutSessionId) {
          const checkout = await db.stripeBillingOperation.findFirst({ where: {
            organizationId: org.id, kind: 'checkout', providerId: lease.state.checkoutSessionId,
          } })
          if (checkout) {
            const saved = JSON.parse(checkout.paramsJson) as OperationParams
            if (fingerprint(saved) !== checkout.requestFingerprint) throw new StripeBillingError('OPERATION_INTEGRITY_FAILURE', 503)
            const intent = saved.request as { plan: StripePlan; priceId: string }
            if (['starter', 'pro'].includes(intent.plan) && item.price.id === intent.priceId) prices = { ...prices, [intent.plan]: intent.priceId }
          }
        }
        plan = stripePlanForPrice(item.price, { ...config, prices })
        settlement = await verifyStripeSettlement(stripe, subscription, org.billingCustomerId!, plan === 'starter' ? 24900 : 49900)
      }
    }
    const verifiedSubscription = subscription, verifiedSettlement = settlement, verifiedPlan = plan
    return finalizeBillingOperation({ db, lease, enabled: runtime.isEnabled, event: params.event,
      financialRefs: settlement ? { invoiceId: settlement.invoiceId, paymentIntentId: settlement.paymentIntentId, chargeId: settlement.chargeId } : {},
      result: { subscriptionId: subscription?.id, settlement: settlement?.state, reason: settlement?.reason, adjustment: params.refs.adjustment },
      apply: async (tx, currentOrg, coordinator) => verifiedSubscription && verifiedSettlement && verifiedPlan
        ? projectSubscription(tx, currentOrg, coordinator, verifiedSubscription, verifiedPlan, verifiedSettlement, params.refs.adjustment, params.graceDays)
        : { ignored: true },
    })
  })
}

export function verifyStripeEvent(rawBody: string, signature: string, runtime = stripeRuntime()) {
  if (Buffer.byteLength(rawBody, 'utf8') > 1048576) throw new StripeBillingError('PAYLOAD_TOO_LARGE', 413)
  try { return runtime.stripe.webhooks.constructEvent(rawBody, signature, runtime.config.webhookSecret) }
  catch { throw new StripeBillingError('INVALID_SIGNATURE', 400) }
}
