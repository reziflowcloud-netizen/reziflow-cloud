import Stripe from 'stripe'
import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from './prisma.ts'
import {
  requireStripeBillingConfig, STRIPE_API_VERSION, STRIPE_BILLING_PROVIDER,
  StripeBillingError, type StripeBillingConfig, type StripePlan,
} from './stripeBillingConfig.ts'
import { canStartStripeCheckout, stripeManaged } from './stripeBillingPolicy.ts'

const INTEGRATION = 'legalhub-billing-test-v1'
const TERMINAL = new Set(['canceled', 'incomplete_expired'])
const WEBHOOK_TYPES = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed',
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'checkout.session.expired',
])
type Actor = { [key: string]: unknown; id?: unknown; organizationId?: unknown; sessionVersion?: unknown }
type Runtime = { db: PrismaClient; stripe: Stripe; config: StripeBillingConfig }
type Tx = Prisma.TransactionClient

export function stripeRuntime(): Runtime {
  const config = requireStripeBillingConfig()
  return { db: prisma, config, stripe: new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 1, timeout: 8000,
  }) }
}

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  return value && typeof value === 'object' && 'id' in value ? String(value.id) : null
}

// Re-read privileges from the database. A stale signed role or tenant supplied
// in JSON never authorizes billing, including for system administrators.
export async function authorizeStripeBilling(actor: Actor | null, db: Pick<Tx, 'user'> = prisma) {
  const id = Number(actor?.id), organizationId = String(actor?.organizationId || '')
  if (!Number.isInteger(id) || id <= 0 || !organizationId) throw new StripeBillingError('UNAUTHORIZED', 401)
  const user = await db.user.findFirst({
    where: { id, organizationId }, select: { id: true, role: true, restrictedAccess: true, sessionVersion: true },
  })
  if (!user || user.sessionVersion !== Number(actor?.sessionVersion ?? 0)) throw new StripeBillingError('UNAUTHORIZED', 401)
  if (!['owner', 'admin'].includes(user.role) || user.restrictedAccess) throw new StripeBillingError('FORBIDDEN', 403)
  return organizationId
}

async function lockOrganization(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Organization" WHERE id = ${id} FOR UPDATE`
  if (!rows.length) throw new StripeBillingError('ORGANIZATION_NOT_FOUND', 404)
  return tx.organization.findUniqueOrThrow({ where: { id } })
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

async function hasNonterminalSubscription(stripe: Stripe, customer: string) {
  let starting_after: string | undefined
  // Fail closed if a customer has an unexpectedly large subscription history.
  for (let page = 0; page < 10; page++) {
    const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, ...(starting_after ? { starting_after } : {}) })
    if (list.data.some(sub => !TERMINAL.has(sub.status))) return true
    if (!list.has_more) return false
    starting_after = list.data.at(-1)?.id
    if (!starting_after) break
  }
  throw new StripeBillingError('SUBSCRIPTION_HISTORY_REQUIRES_REVIEW')
}

export async function createStripeCheckout(actor: Actor | null, plan: StripePlan, runtime = stripeRuntime()) {
  const { db, stripe, config } = runtime
  if (plan !== 'starter' && plan !== 'pro') throw new StripeBillingError('INVALID_PLAN', 400)
  const organizationId = await authorizeStripeBilling(actor, db)
  // Commit idempotency keys BEFORE contacting Stripe. A crash/rollback after
  // an external success must recover the same customer/session on retry.
  await db.$transaction(async tx => {
    const org = await lockOrganization(tx, organizationId)
    await authorizeStripeBilling(actor, tx)
    if (!canStartStripeCheckout(org)) throw new StripeBillingError('MANUAL_BILLING_REQUIRED')
    await tx.stripeBillingState.upsert({ where: { organizationId }, update: {},
      create: { organizationId, customerKey: randomUUID(), checkoutKey: randomUUID() } })
  })
  // Persist the Customer mapping in its own transaction. No Checkout can be
  // created for a Customer whose durable mapping has not committed.
  await db.$transaction(async tx => {
    const org = await lockOrganization(tx, organizationId)
    await authorizeStripeBilling(actor, tx)
    if (!canStartStripeCheckout(org)) throw new StripeBillingError('MANUAL_BILLING_REQUIRED')
    if (org.billingCustomerId) return
    const state = await tx.stripeBillingState.findUniqueOrThrow({ where: { organizationId } })
    const created = await stripe.customers.create({ metadata: { organizationId, integration: INTEGRATION } },
      { idempotencyKey: `lh-customer-${state.customerKey}` })
    if (created.livemode !== false) throw new StripeBillingError('TEST_MODE_REQUIRED', 503)
    await tx.organization.update({ where: { id: organizationId }, data: {
      billingCustomerId: created.id, billingProvider: STRIPE_BILLING_PROVIDER, billingStatus: 'incomplete',
    } })
  }, { maxWait: 10000, timeout: 45000 })
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await db.$transaction(async tx => {
      const org = await lockOrganization(tx, organizationId)
      await authorizeStripeBilling(actor, tx)
      if (!canStartStripeCheckout(org)) throw new StripeBillingError('MANUAL_BILLING_REQUIRED')
      const state = await tx.stripeBillingState.findUniqueOrThrow({ where: { organizationId } })
      const customer = org.billingCustomerId
      if (!customer) throw new StripeBillingError('MAPPING_PENDING', 503)
      await verifyCustomer(stripe, customer, organizationId)
      if (await hasNonterminalSubscription(stripe, customer)) throw new StripeBillingError('SUBSCRIPTION_EXISTS')
      // Repeating or concurrently selecting another plan resumes the same
      // open Checkout. Plan changes require expiration before a fresh attempt.
      if (state.checkoutSessionId) {
        const session = await stripe.checkout.sessions.retrieve(state.checkoutSessionId)
        if (session.livemode !== false || objectId(session.customer) !== customer) throw new StripeBillingError('CHECKOUT_MISMATCH')
        if (session.status === 'open' && session.url) return { url: session.url }
        if (session.status !== 'expired') {
          const subscriptionId = objectId(session.subscription)
          if (!subscriptionId || !TERMINAL.has((await stripe.subscriptions.retrieve(subscriptionId)).status)) {
            throw new StripeBillingError('PAYMENT_CONFIRMATION_PENDING')
          }
        }
        await tx.stripeBillingState.update({ where: { organizationId }, data: {
          checkoutKey: randomUUID(), checkoutSessionId: null, checkoutExpiresAt: null,
        } })
        return null // Commit the rotated key, then create in a new transaction.
      }
      const price = await stripe.prices.retrieve(config.prices[plan])
      stripePlanForPrice(price, config, true)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', customer, allowed_payment_method_types: ['card'],
        line_items: [{ price: config.prices[plan], quantity: 1 }],
        subscription_data: { metadata: { organizationId, integration: INTEGRATION } },
        metadata: { organizationId, integration: INTEGRATION }, client_reference_id: organizationId,
        success_url: `${config.appUrl}/settings/billing?checkout=returned`,
        cancel_url: `${config.appUrl}/settings/billing?checkout=canceled`,
      }, { idempotencyKey: `lh-checkout-${state.checkoutKey}` })
      if (session.livemode !== false || !session.url) throw new StripeBillingError('CHECKOUT_UNAVAILABLE', 503)
      await tx.stripeBillingState.update({ where: { organizationId }, data: {
        checkoutSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000),
      } })
      // A replacement after cancellation starts unpaid. Retaining the old paid
      // plan here would incorrectly give a new, unpaid subscription grace.
      await tx.organization.update({ where: { id: organizationId }, data: {
        plan: 'free', billingStatus: 'incomplete', billingSubscriptionId: null, billingPriceId: null,
        currentPeriodEndsAt: null, cancelAtPeriodEnd: false, graceEndsAt: null,
      } })
      return { url: session.url }
    }, { maxWait: 10000, timeout: 60000 })
    if (result) return result
  }
  throw new StripeBillingError('CHECKOUT_RETRY', 503)
}

export async function createStripePortal(actor: Actor | null, runtime = stripeRuntime()) {
  const { db, stripe, config } = runtime
  const organizationId = await authorizeStripeBilling(actor, db)
  return db.$transaction(async tx => {
    const org = await lockOrganization(tx, organizationId)
    await authorizeStripeBilling(actor, tx)
    if (!stripeManaged(org) || !org.billingCustomerId) throw new StripeBillingError('MANUAL_BILLING_REQUIRED')
    await verifyCustomer(stripe, org.billingCustomerId, organizationId)
    const portal = await stripe.billingPortal.configurations.retrieve(config.portalConfiguration)
    // No self-service upgrades/downgrades or immediate cancel in this MVP.
    // This guard prevents dashboard changes from silently enabling proration.
    if (!portal.active || portal.livemode !== false || portal.features.subscription_update.enabled ||
        !portal.features.payment_method_update.enabled || !portal.features.subscription_cancel.enabled ||
        portal.features.subscription_cancel.mode !== 'at_period_end') throw new StripeBillingError('PORTAL_CONFIGURATION_INVALID', 503)
    const session = await stripe.billingPortal.sessions.create({
      customer: org.billingCustomerId, configuration: config.portalConfiguration,
      return_url: `${config.appUrl}/settings/billing`,
    })
    return { url: session.url }
  }, { maxWait: 10000, timeout: 45000 })
}

function eventReferences(event: Stripe.Event) {
  const object = event.data.object
  if (object.object === 'subscription') return { customer: objectId(object.customer), subscription: object.id }
  if (object.object === 'invoice') return {
    customer: objectId(object.customer), subscription: objectId(object.parent?.subscription_details?.subscription),
  }
  if (object.object === 'checkout.session') return { customer: objectId(object.customer), subscription: objectId(object.subscription) }
  return { customer: null, subscription: null }
}

async function projectSubscription(tx: Tx, org: Awaited<ReturnType<typeof lockOrganization>>, subscription: Stripe.Subscription, config: StripeBillingConfig) {
  if (!stripeManaged(org)) return // Explicit manual/trial/Agency overrides win.
  if (subscription.livemode !== false || objectId(subscription.customer) !== org.billingCustomerId ||
      subscription.metadata.organizationId !== org.id || subscription.metadata.integration !== INTEGRATION) {
    throw new StripeBillingError('SUBSCRIPTION_MISMATCH')
  }
  if (org.billingSubscriptionId && org.billingSubscriptionId !== subscription.id) return
  if (subscription.status === 'trialing') throw new StripeBillingError('UNEXPECTED_STRIPE_TRIAL')
  const item = subscription.items.data[0]
  if (subscription.items.data.length !== 1 || subscription.items.has_more || item?.quantity !== 1) throw new StripeBillingError('SUBSCRIPTION_ITEMS_INVALID')
  const plan = stripePlanForPrice(item.price, config)
  const invoice = subscription.latest_invoice
  const paid = typeof invoice === 'object' && invoice !== null && invoice.livemode === false && invoice.status === 'paid' &&
    objectId(invoice.customer) === org.billingCustomerId && invoice.currency === 'pln' &&
    objectId(invoice.parent?.subscription_details?.subscription) === subscription.id &&
    invoice.lines.data.some(line => line.pricing?.price_details?.price === item.price.id &&
      line.period.start <= item.current_period_start && line.period.end >= item.current_period_end &&
      line.quantity === 1 && line.amount >= (plan === 'starter' ? 24900 : 49900))
  const status = subscription.status === 'active' && !paid ? 'past_due' : subscription.status
  // No grace for a first unpaid subscription and no entitlement from a trial.
  const graceEndsAt = status === 'past_due' && org.plan !== 'free'
    ? new Date(Math.min(org.graceEndsAt?.getTime() ?? Infinity, (item.current_period_start + config.graceDays * 86400) * 1000)) : null
  await tx.organization.update({ where: { id: org.id }, data: {
    billingSubscriptionId: subscription.id, billingPriceId: item.price.id,
    billingStatus: status, currentPeriodEndsAt: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end, graceEndsAt,
    // Only an active, verified paid period can grant/update a paid plan.
    ...(subscription.status === 'active' && paid ? { plan } : {}),
  } })
}

export async function processStripeEvent(event: Stripe.Event, runtime = stripeRuntime()) {
  const { db, stripe, config } = runtime
  if (event.livemode !== false || event.account) throw new StripeBillingError('TEST_MODE_REQUIRED', 400)
  if (!WEBHOOK_TYPES.has(event.type)) return { ignored: true }
  const refs = eventReferences(event)
  if (!refs.customer) return { ignored: true }
  const mapped = await db.organization.findUnique({ where: { billingCustomerId: refs.customer }, select: { id: true } })
  if (!mapped) {
    // A managed customer's first webhook can race the mapping commit. Retry
    // instead of acknowledging it permanently; unrelated account events ignore.
    const metadata = 'metadata' in event.data.object ? event.data.object.metadata : null
    if (metadata?.integration === INTEGRATION) throw new StripeBillingError('MAPPING_PENDING', 503)
    return { ignored: true }
  }
  return db.$transaction(async tx => {
    const org = await lockOrganization(tx, mapped.id)
    if (org.billingCustomerId !== refs.customer) throw new StripeBillingError('CUSTOMER_MISMATCH')
    if (await tx.stripeBillingEvent.findUnique({ where: { id: event.id } })) return { duplicate: true }
    if (stripeManaged(org) && refs.subscription) {
      await verifyCustomer(stripe, org.billingCustomerId!, org.id)
      // Always fetch current state AFTER acquiring the organization lock.
      // Event timestamps/payloads (including equal-second events) are never a
      // subscription snapshot. An old delivery reconciles today's Stripe state.
      const subscription = await stripe.subscriptions.retrieve(refs.subscription, { expand: ['latest_invoice'] })
      if (org.billingSubscriptionId !== subscription.id) {
        const state = await tx.stripeBillingState.findUnique({ where: { organizationId: org.id } })
        if (!state?.checkoutSessionId) throw new StripeBillingError('CHECKOUT_MAPPING_PENDING', 503)
        const session = await stripe.checkout.sessions.retrieve(state.checkoutSessionId)
        if (session.livemode === false && session.status === 'complete' && objectId(session.customer) === org.billingCustomerId &&
            objectId(session.subscription) === subscription.id) {
          // Only the server-created Checkout may bind a new subscription.
          org.billingSubscriptionId = subscription.id
        } else {
          await tx.stripeBillingEvent.create({ data: { id: event.id, organizationId: org.id, type: event.type, stripeCreated: event.created } })
          return { ignored: true }
        }
      }
      await projectSubscription(tx, org, subscription, config)
    }
    // Projection and ledger commit atomically. Concurrent retries serialize on
    // the tenant row, and a failed Stripe/DB operation leaves no completed event.
    await tx.stripeBillingEvent.create({ data: { id: event.id, organizationId: org.id, type: event.type, stripeCreated: event.created } })
    return { processed: true }
  }, { maxWait: 10000, timeout: 60000 })
}

export function verifyStripeEvent(rawBody: string, signature: string, runtime = stripeRuntime()) {
  if (Buffer.byteLength(rawBody, 'utf8') > 1048576) throw new StripeBillingError('PAYLOAD_TOO_LARGE', 413)
  try { return runtime.stripe.webhooks.constructEvent(rawBody, signature, runtime.config.webhookSecret) }
  catch { throw new StripeBillingError('INVALID_SIGNATURE', 400) }
}
