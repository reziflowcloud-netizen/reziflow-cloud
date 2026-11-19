import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { createStripeCheckout, createStripePortal, processStripeEvent } from '../src/lib/stripeBilling.ts'
import { effectiveStripePlan } from '../src/lib/stripeBillingPolicy.ts'
import { stripeFixture } from './fixtures/stripe-billing-provider.mjs'
import { legacyHttpFixture } from './fixtures/stripe-billing-legacy.mjs'
const require = createRequire(import.meta.url)
const { takeNextChannelAssignment } = require('../src/lib/channelRoundRobin.js')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(condition, timeout = 5000) { const end = Date.now() + timeout; while (!condition()) { assert.ok(Date.now() < end, 'Fixture barrier timeout'); await pause(10) } }

test('F4: known cancellation has exact finite boundaries and verified reversal restores only bounded renewal grace', () => {
  const end = new Date('2026-11-20T12:00:00Z'), stamp = end.getTime()
  const org = { plan: 'starter', status: 'active', billingProvider: 'stripe_test', billingStatus: 'active',
    billingCustomerId: 'cus_synthetic', billingSubscriptionId: 'sub_synthetic', settings: {}, trialEndsAt: null,
    cancelAtPeriodEnd: true, currentPeriodEndsAt: end, graceEndsAt: null }
  for (const offset of [-86400000, -1, 0, 1, 86400000, 7 * 86400000]) {
    assert.equal(effectiveStripePlan(org, true, 7, new Date(stamp + offset)), offset < 0 ? 'starter' : 'free')
  }
  assert.equal(effectiveStripePlan({ ...org, cancelAtPeriodEnd: false }, true, 7, new Date(stamp + 1)), 'starter')
  assert.equal(effectiveStripePlan({ ...org, cancelAtPeriodEnd: false }, true, 7, new Date(stamp + 7 * 86400000)), 'free')
  for (const currentPeriodEndsAt of [null, new Date(NaN)]) assert.equal(effectiveStripePlan({ ...org, cancelAtPeriodEnd: false, currentPeriodEndsAt }, true, 7), 'free')
  assert.equal(effectiveStripePlan({ ...org, cancelAtPeriodEnd: false, billingStatus: 'past_due', graceEndsAt: new Date(stamp + 86400000) }, true, 7, new Date(stamp)), 'starter')
  assert.equal(effectiveStripePlan({ ...org, billingStatus: 'past_due', graceEndsAt: new Date(stamp + 86400000) }, true, 7, end), 'free')
  assert.equal(effectiveStripePlan({ ...org, billingStatus: 'incomplete', plan: 'free' }, true, 7), 'free')
})

const databaseUrl = process.env.STRIPE_BILLING_TEST_DATABASE_URL
test('F1/F2/F5: actual leased operations, constrained PostgreSQL and real SDK HTTP', { skip: !databaseUrl }, async t => {
  const target = new URL(databaseUrl)
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55439'); assert.equal(target.pathname, '/legalhub_billing_qa')
  target.searchParams.set('connection_limit', '2'); target.searchParams.set('pool_timeout', '2'); target.searchParams.set('application_name', 'billing-f1-qa')
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] })
  const observer = new PrismaClient({ datasources: { db: { url: databaseUrl + '?connection_limit=1' } }, log: [] })
  const fixture = await stripeFixture({ timeout: 35000 }), ids = [], evidence = { checks: [], slowNetwork: null }
  const als = new AsyncLocalStorage(); let networkCalls = 0
  const dbProxy = new Proxy(db, { get(object, key) {
    if (key === '$transaction') return (work, options) => object.$transaction(tx => als.run(true, () => work(tx)), options)
    const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value
  } })
  function networkProxy(object) { return new Proxy(object, { get(target, key) {
    const value = Reflect.get(target, key)
    if (typeof value === 'function') return (...args) => { assert.ok(!als.getStore(), 'Stripe called while interactive transaction active'); networkCalls++; return value.apply(target, args) }
    return value && typeof value === 'object' ? networkProxy(value) : value
  } }) }
  const runtime = { db: dbProxy, stripe: networkProxy(fixture.stripe), config: fixture.config }
  const setup = async (data = {}) => {
    const org = await db.organization.create({ data: { name: 'Synthetic Findings QA', slug: `findings-${randomUUID()}`, plan: 'free', ...data } }); ids.push(org.id)
    const user = await db.user.create({ data: { organizationId: org.id, role: 'owner', name: 'Synthetic Owner', email: `${randomUUID()}@example.test`, password: 'not-a-login' } })
    return { org, user, actor: { id: user.id, organizationId: org.id, sessionVersion: 0 } }
  }
  const stored = entry => db.organization.findUniqueOrThrow({ where: { id: entry.org.id } })
  const state = entry => db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: entry.org.id } })
  const makeSubscription = async (entry, plan = 'starter') => { await createStripeCheckout(entry.actor, plan, runtime); return fixture.complete((await state(entry)).checkoutSessionId) }
  const op = (entry, kind) => db.stripeBillingOperation.findFirstOrThrow({ where: { organizationId: entry.org.id, kind }, orderBy: { createdAt: 'desc' } })
  const run = (name, work) => t.test(name, async () => { await work(); evidence.checks.push({ name, result: 'PASS' }) })
  t.after(async () => {
    await fixture.close()
    await db.stripeBillingCoordinator.deleteMany({ where: { organizationId: { in: ids } } })
    await db.stripeBillingOperation.deleteMany({ where: { organizationId: { in: ids } } })
    await db.stripeBillingEvent.deleteMany({ where: { organizationId: { in: ids } } })
    await db.stripeBillingState.deleteMany({ where: { organizationId: { in: ids } } })
    await db.notification.deleteMany({ where: { organizationId: { in: ids } } })
    await db.leadWebhookLog.deleteMany({ where: { organizationId: { in: ids } } })
    await db.lead.deleteMany({ where: { organizationId: { in: ids } } })
    await db.leadChannelRouteMember.deleteMany({ where: { organizationId: { in: ids } } })
    await db.leadChannelRoute.deleteMany({ where: { organizationId: { in: ids } } })
    await db.employee.deleteMany({ where: { organizationId: { in: ids } } })
    await db.user.deleteMany({ where: { organizationId: { in: ids } } })
    await db.organization.deleteMany({ where: { id: { in: ids } } })
    await db.$disconnect(); await observer.$disconnect()
    evidence.networkCallsOutsideTransactions = networkCalls
    await mkdir('.qa/stripe-findings', { recursive: true }); await writeFile('.qa/stripe-findings/report.json', JSON.stringify(evidence, null, 2) + '\n')
  })

  await run('F1: 15s Stripe delay, ten Checkouts, same-tenant real Google Sheets HTTP ingestion/routing, other tenant, two DB connections', async () => {
    const entry = await setup({ settings: { leadWebhookEnabled: true, leadWebhookKey: 'synthetic-webhook-key' } }), other = await setup()
    const employee = await db.employee.create({ data: { organizationId: entry.org.id, userId: entry.user.id, name: 'Synthetic Router' } })
    await db.leadChannelRoute.create({ data: { organizationId: entry.org.id, sourceKey: 'website', employeeId: employee.id } })
    const legacy = await legacyHttpFixture(db, entry.org.slug)
    t.after(() => legacy.close())
    const before = fixture.requests.length
    fixture.control('POST', '/v1/checkout/sessions', { delayMs: 15000 })
    const competing = Promise.allSettled(Array.from({ length: 10 }, () => createStripeCheckout(entry.actor, 'starter', runtime)))
    await until(() => fixture.requests.slice(before).some(r => r.path === '/v1/checkout/sessions' && r.method === 'POST'))
    const began = Date.now()
    const ingestion = await Promise.all(Array.from({ length: 6 }, (_, index) => fetch(legacy.url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: `sheet-${index}-${entry.org.id}`, source: 'website', fullName: `Synthetic Sheet ${index}`, rawSheetRow: { source: 'Google Sheets' } }) })))
    assert.ok(ingestion.every(r => r.status === 201)); const legacyMs = Date.now() - began
    assert.ok(legacyMs < 3000, `Legacy ingestion waited ${legacyMs}ms`)
    await Promise.all(Array.from({ length: 5 }, () => takeNextChannelAssignment(db, entry.org.id, 'website')))
    await createStripeCheckout(other.actor, 'pro', runtime)
    const activity = await observer.$queryRaw`SELECT count(*)::int AS total, count(*) FILTER (WHERE state='idle in transaction')::int AS idle FROM pg_stat_activity WHERE application_name='billing-f1-qa'`
    assert.ok(activity[0].total <= 2); assert.equal(activity[0].idle, 0)
    const held = await observer.$queryRaw`SELECT count(*)::int AS count FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE a.application_name='billing-f1-qa' AND l.relation='"Organization"'::regclass`
    assert.equal(held[0].count, 0)
    for (let sample = 0; sample < 6; sample++) {
      const rows = await observer.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name='billing-f1-qa' AND state='idle in transaction'`
      assert.equal(rows[0].count, 0)
      await pause(200)
    }
    const results = await competing
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'BILLING_BUSY'))
    await createStripeCheckout(entry.actor, 'pro', runtime)
    const customer = (await stored(entry)).billingCustomerId
    assert.equal([...fixture.sessions.values()].filter(s => s.customer === customer).length, 1)
    assert.equal(await db.lead.count({ where: { organizationId: entry.org.id } }), 6)
    assert.equal(await db.lead.count({ where: { organizationId: other.org.id } }), 0)
    evidence.slowNetwork = { providerDelayMs: 15000, concurrentCheckouts: 10, legacyHttpRequests: 6, legacyMs, poolConnections: activity[0].total, idleTransactions: 0, organizationLocksDuringDelay: 0, idleTransactionSamples: 7 }
  })

  await run('F2: Starter success/DB crash then Pro + changed Price/return URL recovers exact original request', async () => {
    const entry = await setup(); let crash = true
    const crashingDb = db.$extends({ query: { stripeBillingState: { async update({ args, query }) {
      if (crash && args.data.checkoutSessionId) { crash = false; throw new Error('Synthetic checkout commit crash') } return query(args)
    } } } })
    const before = fixture.requests.length
    await assert.rejects(createStripeCheckout(entry.actor, 'starter', { ...runtime, db: crashingDb }), /Synthetic checkout commit crash/)
    const changed = { ...runtime, config: { ...fixture.config, appUrl: 'http://127.0.0.1:3999', prices: { starter: 'price_starterV2', pro: 'price_proV2' } } }
    await createStripeCheckout(entry.actor, 'pro', changed)
    await createStripeCheckout(entry.actor, 'pro', changed)
    const calls = fixture.requests.slice(before).filter(r => r.method === 'POST' && r.path === '/v1/checkout/sessions')
    assert.equal(calls.length, 1)
    const saved = JSON.parse((await op(entry, 'checkout')).paramsJson).request.body
    assert.equal(saved.line_items[0].price, calls[0].form['line_items[0][price]'])
    assert.equal(saved.success_url, calls[0].form.success_url)
    assert.equal(fixture.sessions.get((await state(entry)).checkoutSessionId).price, 'price_starter')
    const sub = fixture.complete((await state(entry)).checkoutSessionId)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid'), changed)
    assert.equal((await stored(entry)).plan, 'starter', 'the original paid Price remains verifiable after config changes')
  })

  await run('F2: completed Checkout after lost DB commit is mapped without a new session; only the verified webhook grants access', async () => {
    const entry = await setup(); let crash = true
    const crashingDb = db.$extends({ query: { stripeBillingState: { async update({ args, query }) {
      if (crash && args.data.checkoutSessionId) { crash = false; throw new Error('Synthetic lost completed checkout') } return query(args)
    } } } })
    await assert.rejects(createStripeCheckout(entry.actor, 'starter', { ...runtime, db: crashingDb }), /Synthetic lost completed checkout/)
    const customer = (await stored(entry)).billingCustomerId
    const session = [...fixture.sessions.values()].find(session => session.customer === customer)
    const sub = fixture.complete(session.id)
    await assert.rejects(createStripeCheckout(entry.actor, 'pro', runtime), /PAYMENT_CONFIRMATION_PENDING/)
    assert.equal((await state(entry)).checkoutSessionId, session.id); assert.equal((await stored(entry)).plan, 'free')
    await processStripeEvent(fixture.event(session, 'checkout.session.completed'), runtime)
    assert.equal((await stored(entry)).plan, 'starter')
    assert.equal([...fixture.sessions.values()].filter(s => s.customer === customer).length, 1)
    assert.equal([...fixture.subscriptions.values()].filter(s => s.customer === customer).length, 1)
    assert.equal((await stored(entry)).billingSubscriptionId, sub.id)
  })
  await run('F2: expired uncertain Checkout and cached Checkout 500 require manual reconciliation, without new objects', async () => {
    for (const mode of ['expired', 'cached500']) {
      const entry = await setup(); let crash = true
      const crashingDb = db.$extends({ query: { stripeBillingState: { async update({ args, query }) {
        if (crash && args.data.checkoutSessionId) { crash = false; throw new Error('Synthetic lost checkout') } return query(args)
      } } } })
      if (mode === 'cached500') fixture.control('POST', '/v1/checkout/sessions', { status: 500, cached: true })
      await assert.rejects(createStripeCheckout(entry.actor, 'starter', { ...runtime, db: crashingDb }))
      const before = fixture.requests.length, size = fixture.sessions.size
      if (mode === 'expired') {
        await db.stripeBillingOperation.update({ where: { id: (await op(entry, 'checkout')).id }, data: { idempotencyExpiresAt: new Date(0) } })
        fixture.control('GET', '/v1/checkout/sessions', { response: { object: 'list', has_more: false, data: [] } })
      }
      await assert.rejects(createStripeCheckout(entry.actor, 'pro', runtime), /IDEMPOTENCY_WINDOW_EXPIRED|MANUAL_REVIEW_REQUIRED/)
      assert.equal((await op(entry, 'checkout')).phase, 'manual_review')
      assert.equal(fixture.sessions.size, size)
      assert.equal(fixture.requests.slice(before).filter(r => r.path === '/v1/checkout/sessions' && r.method === 'POST').length, 0)
    }
  })

  await run('F2: Customer success/mapping crash retries same immutable Customer and rejects expired uncertain key', async () => {
    for (const expired of [false, true]) {
      const entry = await setup(); let crash = true
      const crashingDb = db.$extends({ query: { organization: { async update({ args, query }) {
        if (crash && args.data.billingCustomerId) { crash = false; throw new Error('Synthetic customer commit crash') } return query(args)
      } } } })
      const before = fixture.customers.size
      await assert.rejects(createStripeCheckout(entry.actor, 'starter', { ...runtime, db: crashingDb }), /Synthetic customer commit crash/)
      assert.equal(fixture.customers.size, before + 1); assert.equal((await stored(entry)).billingCustomerId, null)
      if (expired) {
        await db.stripeBillingOperation.update({ where: { id: (await op(entry, 'customer')).id }, data: { idempotencyExpiresAt: new Date(0) } })
        const results = await Promise.allSettled(Array.from({ length: 5 }, () => createStripeCheckout(entry.actor, 'pro', runtime)))
        assert.ok(results.every(r => r.status === 'rejected'))
        assert.equal((await op(entry, 'customer')).phase, 'manual_review')
      } else await createStripeCheckout(entry.actor, 'pro', runtime)
      assert.equal(fixture.customers.size, before + 1)
    }
  })

  await run('F1/F2: Stripe 429, cached 500, disconnect and network timeout fail safely without duplicate Customers', async () => {
    for (const mode of ['429', '500', 'disconnect', 'timeout']) {
      const entry = await setup(), before = fixture.customers.size
      fixture.control('POST', '/v1/customers', mode === '429' ? { status: 429 } : mode === '500' ? { status: 500, cached: true }
        : mode === 'disconnect' ? { disconnectAfterCreate: true } : { delayMs: 250 })
      const timeoutFixture = mode === 'timeout' ? fixture.stripe._api.timeout : null
      if (mode === 'timeout') fixture.stripe._api.timeout = 60
      const outcome = await createStripeCheckout(entry.actor, 'starter', runtime).then(value => ({ value }), error => ({ error }))
      if (mode !== 'disconnect') assert.ok(outcome.error, `Expected failure: ${mode}`)
      // The official SDK may transparently retry one ECONNRESET even with maxNetworkRetries=0.
      if (mode === 'timeout') { fixture.stripe._api.timeout = timeoutFixture; await pause(300) }
      if (mode === '500') {
        assert.equal((await op(entry, 'customer')).phase, 'manual_review')
        await assert.rejects(createStripeCheckout(entry.actor, 'starter', runtime), /MANUAL_REVIEW_REQUIRED/)
        assert.equal(fixture.customers.size, before)
      } else {
        await createStripeCheckout(entry.actor, 'starter', runtime)
        assert.equal(fixture.customers.size, before + 1)
      }
    }
  })

  await run('F1: Manual/Agency/trial/custom settings and authorization/flag changes during I/O win finalization', async () => {
    for (const change of ['manual', 'agency', 'trial', 'custom', 'role', 'flag']) {
      const entry = await setup(); let enabled = true
      fixture.control('POST', '/v1/checkout/sessions', { delayMs: 200 })
      const before = fixture.requests.length
      const work = createStripeCheckout(entry.actor, 'starter', { ...runtime, isEnabled: () => enabled })
      const settled = work.then(v => ({ value: v }), error => ({ error }))
      await until(() => fixture.requests.slice(before).some(r => r.path === '/v1/checkout/sessions' && r.method === 'POST'))
      const patch = change === 'manual' ? { plan: 'manual', billingStatus: 'manual' } : change === 'agency' ? { plan: 'agency' }
        : change === 'trial' ? { status: 'trial', trialEndsAt: new Date(Date.now() + 86400000), billingStatus: 'trialing' }
        : change === 'custom' ? { settings: { billingLimits: { clients: 777 }, retained: true } } : {}
      if (Object.keys(patch).length) await db.organization.update({ where: { id: entry.org.id }, data: patch })
      if (change === 'role') await db.user.update({ where: { id: entry.user.id }, data: { role: 'employee' } })
      if (change === 'flag') enabled = false
      const result = await settled; assert.ok(result.error)
      const org = await stored(entry)
      for (const [key, value] of Object.entries(patch)) assert.deepEqual(org[key], value)
      assert.ok((await op(entry, 'checkout')).providerId, 'remote result retained for reconciliation')
      assert.notEqual(org.plan, 'starter')
      if (change === 'flag') {
        enabled = true
        const count = fixture.sessions.size
        await createStripeCheckout(entry.actor, 'starter', { ...runtime, isEnabled: () => enabled })
        assert.equal(fixture.sessions.size, count)
      }
    }
  })

  await run('F1: expired reconciliation lease fences the stale response and atomically completes only current event', async () => {
    const entry = await setup(), sub = await makeSubscription(entry), old = fixture.event(sub)
    fixture.control('GET', `/v1/subscriptions/${sub.id}`, { delayMs: 350, response: structuredClone(sub) })
    const before = fixture.requests.length
    const stale = processStripeEvent(old, runtime).then(value => ({ value }), error => ({ error }))
    await until(() => fixture.requests.slice(before).some(r => r.path === `/v1/subscriptions/${sub.id}`))
    await db.stripeBillingCoordinator.update({ where: { organizationId: entry.org.id }, data: { leaseUntil: new Date(0) } })
    sub.status = 'canceled'
    const current = fixture.event(sub, 'customer.subscription.deleted')
    await processStripeEvent(current, runtime)
    const result = await stale
    assert.equal(result.error?.code, 'BILLING_STALE_LEASE'); assert.equal((await stored(entry)).billingStatus, 'canceled')
    assert.equal(await db.stripeBillingEvent.count({ where: { id: old.id } }), 0)
    assert.equal(await db.stripeBillingEvent.count({ where: { id: current.id } }), 1)
    await processStripeEvent(old, runtime); assert.equal((await stored(entry)).billingStatus, 'canceled')
  })

  await run('F1/F2: expired mutating lease keeps the same key; in-flight provider conflict cannot make a duplicate session', async () => {
    const entry = await setup(), before = fixture.requests.length
    fixture.control('POST', '/v1/checkout/sessions', { delayMs: 350 })
    const stale = createStripeCheckout(entry.actor, 'starter', runtime).then(value => ({ value }), error => ({ error }))
    await until(() => fixture.requests.slice(before).some(r => r.path === '/v1/checkout/sessions' && r.method === 'POST'))
    await db.stripeBillingCoordinator.update({ where: { organizationId: entry.org.id }, data: { leaseUntil: new Date(0) } })
    await assert.rejects(createStripeCheckout(entry.actor, 'pro', runtime), /BILLING_BUSY/)
    assert.equal((await stale).error?.code, 'BILLING_STALE_LEASE')
    await createStripeCheckout(entry.actor, 'pro', runtime)
    const calls = fixture.requests.slice(before).filter(r => r.path === '/v1/checkout/sessions' && r.method === 'POST')
    assert.equal(new Set(calls.map(c => c.key)).size, 1)
    assert.equal([...fixture.sessions.values()].filter(s => s.customer === (calls[0].form.customer)).length, 1)
  })

  await run('F1: bounded Organization lock wait returns controlled BILLING_BUSY before provider I/O', async () => {
    const entry = await setup()
    let release, ready
    const gate = new Promise(resolve => { release = resolve }), started = new Promise(resolve => { ready = resolve })
    const held = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${entry.org.id} FOR UPDATE`
      ready(); await gate
    }, { timeout: 5000 })
    await started
    const before = networkCalls, stamp = Date.now()
    try { await assert.rejects(createStripeCheckout(entry.actor, 'starter', runtime), error => error.code === 'BILLING_BUSY') }
    finally { release(); await held }
    assert.ok(Date.now() - stamp < 1800); assert.equal(networkCalls, before)
    await createStripeCheckout(entry.actor, 'starter', runtime)
  })

  for (const plan of ['starter', 'pro']) await run(`F5: standard settled ${plan} proves InvoicePayment → PaymentIntent → captured card Charge`, async () => {
    const entry = await setup(), sub = await makeSubscription(entry, plan)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid'), runtime)
    assert.equal((await stored(entry)).plan, plan); assert.equal((await stored(entry)).billingStatus, 'active')
    await createStripePortal(entry.actor, runtime)
  })
  await run('F4: failed renewal plus known cancellation uses the last actually paid boundary; verified reversal restores renewal grace', async () => {
    const entry = await setup(), sub = await makeSubscription(entry)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid'), runtime)
    const paidEnd = (await stored(entry)).currentPeriodEndsAt.getTime()
    sub.items.data[0].current_period_start = sub.items.data[0].current_period_end
    sub.items.data[0].current_period_end += 30 * 86400
    sub.status = 'past_due'; sub.cancel_at_period_end = true; sub.latest_invoice = fixture.invoice(sub, false)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.payment_failed'), runtime)
    assert.equal((await stored(entry)).currentPeriodEndsAt.getTime(), paidEnd)
    assert.equal(effectiveStripePlan(await stored(entry), true, 7, new Date(paidEnd + 1)), 'free')
    sub.cancel_at_period_end = false
    await processStripeEvent(fixture.event(sub), runtime)
    assert.equal(effectiveStripePlan(await stored(entry), true, 7, new Date(paidEnd + 1)), 'starter')
  })
  const financialCases = {
    zero_total: invoice => { invoice.total = 0; invoice.amount_due = 0; invoice.amount_paid = 0 },
    zero_paid: invoice => { invoice.amount_paid = 0 }, discount: invoice => { invoice.total_discount_amounts = [{ amount: 100, discount: 'di_synthetic' }] },
    balance_credit: invoice => { invoice.starting_balance = -24900; invoice.amount_due = 0; invoice.amount_paid = 0 },
    partial: invoice => { invoice.amount_paid = 100; invoice.amount_remaining = 24800 },
    out_of_band: invoice => { invoice.amount_paid_off_stripe = 24900 }, credit_note: invoice => { invoice.post_payment_credit_notes_amount = 100 },
    full_refund: (_invoice, charge) => { charge.amount_refunded = 24900; charge.refunded = true },
    partial_refund: (_invoice, charge) => { charge.amount_refunded = 100 }, dispute: (_invoice, charge) => { charge.disputed = true },
    uncaptured: (_invoice, charge) => { charge.captured = false },
  }
  for (const [name, mutate] of Object.entries(financialCases)) await run(`F5: unsupported ${name} never grants new paid access or creates another subscription`, async () => {
    const entry = await setup(), sub = await makeSubscription(entry), invoice = sub.latest_invoice
    const payment = [...fixture.payments.values()].find(p => p.invoice === invoice.id), intent = fixture.intents.get(payment.payment.payment_intent), charge = fixture.charges.get(intent.latest_charge)
    mutate(invoice, charge)
    const before = { customers: fixture.customers.size, sessions: fixture.sessions.size, subs: fixture.subscriptions.size }
    await processStripeEvent(fixture.event(invoice, 'invoice.paid'), runtime)
    const org = await stored(entry)
    assert.equal(org.plan, 'free'); assert.equal(org.billingStatus, 'manual_review_required')
    assert.equal(effectiveStripePlan(org, true, 7), 'free')
    await processStripeEvent(fixture.event(sub, 'customer.subscription.updated', 1), runtime)
    await assert.rejects(createStripeCheckout(entry.actor, 'pro', runtime))
    assert.deepEqual({ customers: fixture.customers.size, sessions: fixture.sessions.size, subs: fixture.subscriptions.size }, before)
  })

  for (const kind of ['refund', 'credit_note', 'dispute']) await run(`F5: ${kind} event resolves verified tenant relationship, latches review and cannot extend prior paid period`, async () => {
    const entry = await setup(), sub = await makeSubscription(entry)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid'), runtime)
    const end = (await stored(entry)).currentPeriodEndsAt.getTime(), invoice = sub.latest_invoice
    const payment = [...fixture.payments.values()].find(p => p.invoice === invoice.id), charge = fixture.charges.get(fixture.intents.get(payment.payment.payment_intent).latest_charge)
    const object = kind === 'refund' ? { id: 're_synthetic', object: 'refund', charge: charge.id, payment_intent: charge.payment_intent }
      : kind === 'credit_note' ? { id: 'cn_synthetic', object: 'credit_note', invoice: invoice.id } : { id: 'dp_synthetic', object: 'dispute', charge: charge.id }
    const type = kind === 'refund' ? 'refund.created' : kind === 'credit_note' ? 'credit_note.created' : 'charge.dispute.created'
    await processStripeEvent(fixture.event(object, type), runtime)
    assert.equal((await stored(entry)).billingStatus, 'manual_review_required')
    sub.items.data[0].current_period_start = sub.items.data[0].current_period_end; sub.items.data[0].current_period_end += 30 * 86400
    sub.latest_invoice = fixture.invoice(sub)
    await processStripeEvent(fixture.event(sub.latest_invoice, 'invoice.paid', 1), runtime)
    const org = await stored(entry)
    assert.equal(org.currentPeriodEndsAt.getTime(), end); assert.equal(effectiveStripePlan(org, true, 7, new Date(end)), 'free')
  })

  await run('tenant operation FK rejects cross-organization lease binding; missing financial mapping retries without provider I/O', async () => {
    const a = await setup(), b = await setup()
    await createStripeCheckout(a.actor, 'starter', runtime); await createStripeCheckout(b.actor, 'starter', runtime)
    await assert.rejects(db.stripeBillingCoordinator.update({ where: { organizationId: a.org.id }, data: { operationId: (await op(b, 'checkout')).id } }), error => error.code === 'P2003')
    const before = networkCalls
    await assert.rejects(processStripeEvent(fixture.event({ id: 're_unknown', object: 'refund', charge: 'ch_unmapped' }, 'refund.created'), runtime), /FINANCIAL_MAPPING_PENDING/)
    assert.equal(networkCalls, before)
  })
})
