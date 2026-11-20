import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { stripeBillingConfig, STRIPE_API_VERSION } from '../src/lib/stripeBillingConfig.ts'
import { effectiveStripePlan, canStartStripeCheckout } from '../src/lib/stripeBillingPolicy.ts'
import { createStripeCheckout as checkoutOnce, createStripePortal, authorizeStripeBilling, processStripeEvent as eventOnce, verifyStripeEvent } from '../src/lib/stripeBilling.ts'
import { stripeBillingAction, stripeBillingWebhook } from '../src/lib/stripeBillingHttp.ts'
import { getBillingSnapshot, assertBillingLimit, canManageBilling } from '../src/lib/billing.ts'
import { stripeFixture, syntheticConfig } from './fixtures/stripe-billing-provider.mjs'

async function retryBusy(work) {
  const until = Date.now() + 5000
  while (true) {
    try { return await work() } catch (error) {
      if (error.code !== 'BILLING_BUSY' || Date.now() >= until) throw error
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
}
const createStripeCheckout = (...args) => retryBusy(() => checkoutOnce(...args))
const processStripeEvent = (...args) => retryBusy(() => eventOnce(...args))

const configEnv = {
  STRIPE_BILLING_ENABLED: 'true', STRIPE_SECRET_KEY: syntheticConfig.secretKey,
  STRIPE_WEBHOOK_SECRET: syntheticConfig.webhookSecret, STRIPE_BILLING_APP_URL: syntheticConfig.appUrl,
  STRIPE_STARTER_PRICE_ID: syntheticConfig.prices.starter, STRIPE_PRO_PRICE_ID: syntheticConfig.prices.pro,
  STRIPE_PORTAL_CONFIGURATION_ID: syntheticConfig.portalConfiguration, STRIPE_BILLING_GRACE_DAYS: '7',
}

test('flag defaults OFF; live/production/missing/unapproved grace config fails closed', () => {
  assert.equal(stripeBillingConfig({}), null)
  assert.equal(stripeBillingConfig(configEnv)?.graceDays, 7)
  for (const patch of [
    { STRIPE_BILLING_ENABLED: 'false' }, { STRIPE_SECRET_KEY: 'sk_live_synthetic' }, { STRIPE_SECRET_KEY: 'rk_live_synthetic' },
    { VERCEL_ENV: 'production' }, { STRIPE_BILLING_APP_URL: 'https://legalhubcrm.com' },
    { STRIPE_BILLING_APP_URL: 'https://legalhubcrm.com.evil.test/path' }, { STRIPE_BILLING_APP_URL: 'http://preview.example.test' },
    { STRIPE_BILLING_GRACE_DAYS: '' }, { STRIPE_BILLING_GRACE_DAYS: '0' }, { STRIPE_BILLING_GRACE_DAYS: '15' },
    { STRIPE_PRO_PRICE_ID: syntheticConfig.prices.starter }, { STRIPE_WEBHOOK_SECRET: '' },
  ]) assert.equal(stripeBillingConfig({ ...configEnv, ...patch }), null, JSON.stringify(Object.keys(patch)))
  assert.equal(canManageBilling({ role: 'admin', restrictedAccess: true }), false)
})

test('Stripe SDK verifies exact raw bytes, timestamp tolerance and signature', () => {
  const stripe = new Stripe(syntheticConfig.secretKey, { apiVersion: STRIPE_API_VERSION })
  const runtime = { stripe, config: syntheticConfig }
  const raw = JSON.stringify({ id: 'evt_signature', object: 'event', livemode: false, data: { object: {} } })
  const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: syntheticConfig.webhookSecret })
  assert.equal(verifyStripeEvent(raw, signature, runtime).id, 'evt_signature')
  assert.throws(() => verifyStripeEvent(raw + ' ', signature, runtime), /INVALID_SIGNATURE/)
  assert.throws(() => verifyStripeEvent(raw, 't=1,v1=wrong', runtime), /INVALID_SIGNATURE/)
  const old = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: syntheticConfig.webhookSecret, timestamp: Math.floor(Date.now() / 1000) - 600 })
  assert.throws(() => verifyStripeEvent(raw, old, runtime), /INVALID_SIGNATURE/)
})

const databaseUrl = process.env.STRIPE_BILLING_TEST_DATABASE_URL
test('billing lifecycle with real PostgreSQL locks/transactions and local SDK HTTP fixture', { skip: !databaseUrl }, async t => {
  const target = new URL(databaseUrl)
  assert.ok(target.hostname === '127.0.0.1' && target.pathname === '/legalhub_billing_qa' && target.port === '55439', 'Disposable loopback DB only')
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] })
  const fixture = await stripeFixture(), runtime = { db, stripe: fixture.stripe, config: fixture.config }
  const orgIds = []
  t.after(async () => {
    await fixture.close()
    await db.stripeBillingCoordinator.deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.stripeBillingOperation.deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.stripeBillingEvent.deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.stripeBillingState.deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.user.deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await db.$disconnect()
  })
  const setup = async (data = {}, userData = {}) => {
    const org = await db.organization.create({ data: { name: 'Synthetic Billing QA', slug: `stripe-qa-${randomUUID()}`, plan: 'free', billingStatus: 'manual', ...data } })
    orgIds.push(org.id)
    const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic Owner', email: `${randomUUID()}@example.test`, password: 'not-a-login', role: 'owner', ...userData } })
    return { org, actor: { id: user.id, organizationId: org.id, sessionVersion: user.sessionVersion } }
  }
  const checkout = async (entry, plan = 'starter', rt = runtime) => {
    await createStripeCheckout(entry.actor, plan, rt)
    return db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: entry.org.id } })
  }
  const stored = entry => db.organization.findUniqueOrThrow({ where: { id: entry.org.id } })
  const effective = (org, now = new Date()) => effectiveStripePlan(org, true, 7, now)
  const a = await setup(), b = await setup()
  let sub

  await t.test('concurrent repeated Checkout creates one Customer and one open session', async () => {
    await Promise.all(Array.from({ length: 5 }, () => createStripeCheckout(a.actor, 'starter', runtime)))
    assert.equal(fixture.customers.size, 1); assert.equal(fixture.sessions.size, 1)
    assert.equal((await stored(a)).plan, 'free')
    assert.equal(fixture.requests.filter(r => r.path === '/v1/checkout/sessions' && r.method === 'POST').length, 1)
    await createStripeCheckout(a.actor, 'pro', runtime)
    assert.equal(fixture.sessions.size, 1, 'second selection resumes existing Checkout')
  })
  await t.test('first confirmed paid invoice grants Starter; redirect alone grants nothing', async () => {
    const state = await db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: a.org.id } })
    assert.equal((await stored(a)).plan, 'free')
    sub = fixture.complete(state.checkoutSessionId)
    await processStripeEvent(fixture.event(fixture.sessions.get(state.checkoutSessionId), 'checkout.session.completed'), runtime)
    assert.equal((await stored(a)).plan, 'starter'); assert.equal((await stored(a)).billingStatus, 'active')
    await assert.rejects(createStripeCheckout(a.actor, 'pro', runtime), /SUBSCRIPTION_EXISTS/)
    assert.equal(fixture.sessions.size, 1)
  })
  await t.test('duplicate and concurrent events atomically project once', async () => {
    const event = fixture.event(sub), before = fixture.requests.length
    const results = await Promise.all(Array.from({ length: 8 }, () => processStripeEvent(event, runtime)))
    assert.equal(results.filter(r => r.processed).length, 1)
    assert.equal(await db.stripeBillingEvent.count({ where: { id: event.id } }), 1)
    assert.equal(fixture.requests.slice(before).filter(r => r.path === `/v1/subscriptions/${sub.id}`).length, 1)
  })
  await t.test('out-of-order and equal-second payloads reconcile current remote state', async () => {
    await processStripeEvent(fixture.event({ ...sub, status: 'canceled' }, 'customer.subscription.deleted', 1), runtime)
    await processStripeEvent(fixture.event({ ...sub, status: 'past_due' }, 'customer.subscription.updated', 1), runtime)
    assert.equal((await stored(a)).billingStatus, 'active')
    const event = fixture.event(sub)
    fixture.failNextRead()
    await assert.rejects(processStripeEvent(event, runtime))
    assert.equal(await db.stripeBillingEvent.count({ where: { id: event.id } }), 0, 'outage rolls back ledger')
    await processStripeEvent(event, runtime)
  })
  await t.test('monthly renewal and custom limits persist without deleting tenant data', async () => {
    const item = sub.items.data[0]
    item.current_period_start = item.current_period_end; item.current_period_end += 30 * 86400
    sub.latest_invoice = fixture.invoice(sub)
    const settings = { billingLimits: { clients: 900, leads: null }, unrelated: { retained: true } }
    await db.organization.update({ where: { id: a.org.id }, data: { settings } })
    await db.client.create({ data: { organizationId: a.org.id, firstName: 'Synthetic', lastName: 'Retained' } })
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid'), runtime)
    const org = await stored(a)
    assert.equal(org.currentPeriodEndsAt.getTime(), item.current_period_end * 1000)
    assert.deepEqual(org.settings, settings)
    Object.assign(process.env, configEnv)
    const snapshot = await getBillingSnapshot(a.org.id, db)
    assert.equal(snapshot.plan.limits.clients, 900); assert.equal(snapshot.plan.limits.leads, null)
  })
  await t.test('failed renewal has bounded grace, repeats never extend it, recovery restores status', async () => {
    sub.status = 'past_due'; sub.latest_invoice = fixture.invoice(sub, false)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.payment_failed'), runtime)
    let org = await stored(a)
    const start = sub.items.data[0].current_period_start * 1000
    assert.equal(org.billingStatus, 'past_due'); assert.equal(org.graceEndsAt.getTime(), start + 7 * 86400000)
    assert.equal(effective(org, new Date(start + 6 * 86400000)), 'starter')
    assert.equal(effective(org, new Date(start + 7 * 86400000)), 'free')
    const original = org.graceEndsAt.getTime()
    await processStripeEvent(fixture.event(sub), runtime)
    org = await stored(a); assert.equal(org.graceEndsAt.getTime(), original)
    assert.equal(await db.client.count({ where: { organizationId: a.org.id } }), 1)
    sub.status = 'active'; sub.latest_invoice = fixture.invoice(sub)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.payment_succeeded'), runtime)
    assert.equal((await stored(a)).graceEndsAt, null)
  })
  await t.test('cancel at period end, undo, immediate cancel and fresh reactivation', async () => {
    sub.cancel_at_period_end = true
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal((await stored(a)).cancelAtPeriodEnd, true); assert.equal(effective(await stored(a)), 'starter')
    sub.cancel_at_period_end = false
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal((await stored(a)).cancelAtPeriodEnd, false)
    sub.status = 'canceled'
    await processStripeEvent(fixture.event(sub, 'customer.subscription.deleted'), runtime)
    assert.equal(effective(await stored(a)), 'free')
    await db.organization.update({ where: { id: a.org.id }, data: { settings: {} } })
    const state = await checkout(a, 'pro'), old = sub
    assert.equal((await stored(a)).plan, 'free', 'replacement starts without the canceled plan entitlement')
    sub = fixture.complete(state.checkoutSessionId, { paid: false, status: 'active' })
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal((await stored(a)).plan, 'free'); assert.equal((await stored(a)).graceEndsAt, null)
    sub.latest_invoice = fixture.invoice(sub)
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal((await stored(a)).plan, 'pro')
    await processStripeEvent(fixture.event(old, 'customer.subscription.deleted', 1), runtime)
    assert.equal((await stored(a)).billingSubscriptionId, sub.id); assert.equal((await stored(a)).billingStatus, 'active')
  })
  await t.test('failed first payment and unpaid active status cannot grant a paid tier', async () => {
    const state = await checkout(b)
    const unpaid = fixture.complete(state.checkoutSessionId, { paid: false })
    await processStripeEvent(fixture.event(unpaid.latest_invoice, 'invoice.payment_failed'), runtime)
    assert.equal((await stored(b)).plan, 'free'); assert.equal((await stored(b)).graceEndsAt, null)
    unpaid.status = 'active'
    await processStripeEvent(fixture.event(unpaid), runtime)
    assert.equal((await stored(b)).plan, 'free'); assert.equal((await stored(b)).billingStatus, 'past_due')
    await assert.rejects(createStripeCheckout(b.actor, 'pro', runtime), /SUBSCRIPTION_EXISTS/)
  })
  await t.test('expired Checkout rotates committed idempotency key; rollback recovers external success', async () => {
    const c = await setup(), state = await checkout(c)
    fixture.sessions.get(state.checkoutSessionId).status = 'expired'
    const next = await checkout(c)
    assert.notEqual(next.checkoutKey, state.checkoutKey)
    const d = await setup(); let fail = true
    const crashingDb = db.$extends({ query: { stripeBillingState: { async update({ args, query }) {
      if (fail && args.data.checkoutSessionId) { fail = false; throw new Error('Synthetic crash after provider success') }
      return query(args)
    } } } })
    const before = fixture.sessions.size
    await assert.rejects(checkout(d, 'starter', { ...runtime, db: crashingDb }), /Synthetic crash/)
    assert.ok((await stored(d)).billingCustomerId, 'customer mapping committed before Checkout')
    await checkout(d)
    assert.equal(fixture.sessions.size, before + 1, 'provider idempotency recovers same external session')
  })
  await t.test('Owner/Admin only, current DB role/session, restricted users and tenant isolation', async () => {
    const e = await setup({}, { role: 'employee' }), restricted = await setup({}, { role: 'admin', restrictedAccess: true })
    for (const actor of [e.actor, restricted.actor, { ...a.actor, organizationId: b.org.id }, { ...a.actor, sessionVersion: 99 }]) {
      await assert.rejects(authorizeStripeBilling({ ...actor, role: 'owner' }, db), /FORBIDDEN|UNAUTHORIZED/)
    }
    const request = body => new Request(`${syntheticConfig.appUrl}/api/billing/checkout`, { method: 'POST', headers: { origin: syntheticConfig.appUrl }, body: JSON.stringify(body) })
    for (const body of [{ plan: 'starter', organizationId: b.org.id }, { plan: 'pro', priceId: 'price_evil' }, { plan: 'agency' }, { plan: 'starter', customerId: 'cus_foreign' }]) {
      assert.equal((await stripeBillingAction(request(body), a.actor, 'checkout', runtime)).status, 400)
    }
    assert.equal((await stripeBillingAction(request({ plan: 'starter' }), e.actor, 'checkout', runtime)).status, 403)
    assert.equal((await stripeBillingAction(request({ plan: 'starter' }), null, 'checkout', runtime)).status, 401)
    const cross = new Request(`${syntheticConfig.appUrl}/api/billing/portal`, { method: 'POST', headers: { origin: 'https://evil.example.test' }, body: '{}' })
    assert.equal((await stripeBillingAction(cross, a.actor, 'portal', runtime)).status, 403)
  })
  await t.test('Manual/Agency/trial/custom-limit customers remain unchanged', async () => {
    for (const data of [{ plan: 'manual' }, { plan: 'agency' }, { plan: 'starter', billingStatus: 'manual' },
      { plan: 'pro', billingStatus: 'manual' }, { plan: 'starter', status: 'trial', billingStatus: 'trialing', trialEndsAt: new Date('2027-01-01') },
      { settings: { billingLimits: { clients: 800 } } }]) {
      const entry = await setup(data), before = await stored(entry)
      assert.equal(canStartStripeCheckout(before), false)
      await assert.rejects(createStripeCheckout(entry.actor, 'starter', runtime), /MANUAL_BILLING_REQUIRED/)
      assert.deepEqual(await stored(entry), before)
    }
    const before = await stored(a)
    await db.organization.update({ where: { id: a.org.id }, data: { plan: 'manual', billingStatus: 'manual' } })
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal((await stored(a)).plan, 'manual'); assert.equal((await stored(a)).billingStatus, 'manual')
    await db.organization.update({ where: { id: a.org.id }, data: { plan: before.plan, billingStatus: before.billingStatus } })
  })
  await t.test('Customer Portal configuration rejects automatic upgrades and immediate cancellation', async () => {
    assert.match((await createStripePortal(a.actor, runtime)).url, /^https:\/\/billing\.stripe\.com/)
    fixture.portal.features.subscription_update.enabled = true
    await assert.rejects(createStripePortal(a.actor, runtime), /PORTAL_CONFIGURATION_INVALID/)
    fixture.portal.features.subscription_update.enabled = false
    fixture.portal.features.subscription_cancel.mode = 'immediately'
    await assert.rejects(createStripePortal(a.actor, runtime), /PORTAL_CONFIGURATION_INVALID/)
    fixture.portal.features.subscription_cancel.mode = 'at_period_end'
    const customer = fixture.customers.get(sub.customer), original = customer.metadata.organizationId
    customer.metadata.organizationId = b.org.id
    await assert.rejects(createStripePortal(a.actor, runtime), /CUSTOMER_MISMATCH/)
    customer.metadata.organizationId = original
  })
  await t.test('signed raw webhook HTTP boundary and no unsafe errors', async () => {
    const event = fixture.event(sub), payload = JSON.stringify(event)
    const signature = fixture.stripe.webhooks.generateTestHeaderString({ payload, secret: syntheticConfig.webhookSecret })
    const req = (body = payload, sig = signature) => new Request('http://127.0.0.1/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': sig }, body })
    assert.equal((await stripeBillingWebhook(req(), runtime)).status, 200)
    assert.equal((await stripeBillingWebhook(req(payload + ' '), runtime)).status, 400)
    const live = JSON.stringify({ ...event, id: 'evt_live_rejected', livemode: true })
    const liveSignature = fixture.stripe.webhooks.generateTestHeaderString({ payload: live, secret: syntheticConfig.webhookSecret })
    assert.equal((await stripeBillingWebhook(req(live, liveSignature), runtime)).status, 400)
    assert.ok(fixture.requests.every(r => r.version === STRIPE_API_VERSION))
    const snapshot = await getBillingSnapshot(a.org.id, db)
    assert.ok(!JSON.stringify(snapshot).includes('cus_synthetic'))
    assert.equal(snapshot.stripe.managed, true)
  })
  await t.test('limits preserve edits/data, disabled flag preserves legacy behavior', async () => {
    await db.organization.update({ where: { id: a.org.id }, data: { billingStatus: 'canceled' } })
    assert.equal((await getBillingSnapshot(a.org.id, db)).plan.key, 'free')
    await assert.rejects(assertBillingLimit(a.org.id, 'clients', 50, db), /Достигнут лимит/)
    process.env.STRIPE_BILLING_ENABLED = 'false'
    assert.equal((await getBillingSnapshot(a.org.id, db)).plan.key, 'pro')
    assert.equal((await getBillingSnapshot(a.org.id, db)).stripe.enabled, false)
    assert.equal(await db.client.count({ where: { organizationId: a.org.id } }), 1)
  })
})
