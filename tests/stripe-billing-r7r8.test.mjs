import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { createStripeCheckout } from '../src/lib/stripeBilling.ts'
import { stripeBillingWebhook } from '../src/lib/stripeBillingHttp.ts'
import { effectiveStripePlan } from '../src/lib/stripeBillingPolicy.ts'
import { stripeFixture } from './fixtures/stripe-billing-provider.mjs'

const databaseUrl = process.env.STRIPE_BILLING_TEST_DATABASE_URL
async function scenario(t) {
  const target = new URL(databaseUrl)
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55439'); assert.equal(target.pathname, '/legalhub_billing_qa')
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] })
  const provider = await stripeFixture()
  const org = await db.organization.create({ data: { name: 'Synthetic R7 R8', slug: `r7r8-${randomUUID()}`, plan: 'free' } })
  const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic Owner', email: `${randomUUID()}@example.test`, password: 'not-a-login', role: 'owner' } })
  const runtime = { db, stripe: provider.stripe, config: provider.config }
  t.after(async () => {
    await provider.close()
    for (const model of ['stripeBillingCoordinator', 'stripeBillingOperation', 'stripeBillingEvent', 'stripeBillingState', 'user']) await db[model].deleteMany({ where: { organizationId: org.id } })
    await db.organization.delete({ where: { id: org.id } }); await db.$disconnect()
  })
  const send = async event => {
    const body = JSON.stringify(event)
    const response = await stripeBillingWebhook(new Request('http://127.0.0.1:3129/api/webhooks/stripe', { method: 'POST', body,
      headers: { 'stripe-signature': provider.stripe.webhooks.generateTestHeaderString({ payload: body, secret: provider.config.webhookSecret }) } }), runtime)
    assert.equal(response.status, 200)
    return response.json()
  }
  await createStripeCheckout({ id: user.id, organizationId: org.id, sessionVersion: 0 }, 'starter', runtime)
  const state = await db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: org.id } })
  const sub = provider.complete(state.checkoutSessionId)
  await send(provider.event(sub.latest_invoice, 'invoice.paid'))
  return { db, provider, org, sub, send, stored: () => db.organization.findUniqueOrThrow({ where: { id: org.id } }), coordinator: () => db.stripeBillingCoordinator.findUniqueOrThrow({ where: { organizationId: org.id } }) }
}

test('R7: genuine draft ending_balance=null must not hold a legitimate paid renewal', { skip: !databaseUrl }, async t => {
  const s = await scenario(t), paidEnd = (await s.stored()).currentPeriodEndsAt
  const originalSubscription = structuredClone(s.sub)
  const item = s.sub.items.data[0]
  item.current_period_start = item.current_period_end; item.current_period_end += 30 * 86400
  const draft = s.provider.invoice(s.sub, false)
  Object.assign(draft, { status: 'draft', ending_balance: null })
  s.sub.latest_invoice = draft
  const delayed = s.provider.event(s.sub, 'customer.subscription.updated')
  await s.send(delayed)
  assert.equal((await s.coordinator()).financialHoldSubscriptionId, null, 'ordinary draft must not latch a credit hold')
  assert.equal((await s.stored()).currentPeriodEndsAt.getTime(), paidEnd.getTime(), 'unpaid new period is not a paid entitlement')
  assert.equal((await s.coordinator()).paidThrough.getTime(), paidEnd.getTime())
  Object.assign(draft, { status: 'open', ending_balance: 0 })
  await s.send(s.provider.event(draft, 'invoice.updated'))
  assert.equal((await s.coordinator()).financialHoldSubscriptionId, null)
  s.sub.latest_invoice = s.provider.invoice(s.sub, true)
  const paid = s.provider.event(s.sub.latest_invoice, 'invoice.paid')
  await s.send(paid)
  assert.equal((await s.stored()).billingStatus, 'active')
  assert.equal((await s.stored()).currentPeriodEndsAt.getTime(), item.current_period_end * 1000)
  await s.send(delayed); await s.send(paid)
  assert.equal((await s.stored()).billingStatus, 'active')
  assert.equal(await s.db.stripeBillingEvent.count({ where: { id: paid.id } }), 1)
  s.provider.control('GET', `/v1/subscriptions/${s.sub.id}`, { response: originalSubscription })
  await s.send(s.provider.event(originalSubscription))
  assert.equal((await s.stored()).currentPeriodEndsAt.getTime(), item.current_period_end * 1000, 'an older verified paid snapshot cannot regress the paid boundary')
})

test('R8: actual Portal cancel_at with false boolean persists and ends access without grace', { skip: !databaseUrl }, async t => {
  const s = await scenario(t), end = s.sub.items.data[0].current_period_end
  Object.assign(s.sub, { cancel_at: end, cancel_at_period_end: false })
  await s.send(s.provider.event(s.sub))
  const org = await s.stored()
  assert.equal(org.cancelAtPeriodEnd, true, 'Portal timestamp is a known cancellation')
  assert.equal((await s.coordinator()).scheduledCancelAt.getTime(), end * 1000)
  assert.equal(effectiveStripePlan(org, true, 7, new Date(end * 1000)), 'free')
  assert.equal(effectiveStripePlan(org, true, 7, new Date((end + 86400) * 1000)), 'free')
  Object.assign(s.sub, { cancel_at: null, cancel_at_period_end: false })
  await s.send(s.provider.event(s.sub))
  const reversed = await s.stored()
  assert.equal(reversed.cancelAtPeriodEnd, false)
  assert.equal((await s.coordinator()).scheduledCancelAt, null)
  assert.equal(effectiveStripePlan(reversed, true, 7, new Date((end + 1) * 1000)), 'starter')
})

test('R7: pending renewal preserves paid proof and bounded grace; a first draft gives no paid access', { skip: !databaseUrl }, async t => {
  const s = await scenario(t), paidEnd = (await s.stored()).currentPeriodEndsAt.getTime(), item = s.sub.items.data[0]
  item.current_period_start = item.current_period_end; item.current_period_end += 30 * 86400
  s.sub.latest_invoice = s.provider.invoice(s.sub, false)
  Object.assign(s.sub.latest_invoice, { status: 'draft', ending_balance: null })
  await s.send(s.provider.event(s.sub))
  const first = await s.stored()
  assert.equal(first.currentPeriodEndsAt.getTime(), paidEnd)
  assert.equal(first.graceEndsAt.getTime(), paidEnd + 7 * 86400000)
  assert.equal(effectiveStripePlan(first, true, 7, new Date(paidEnd + 1)), 'starter')
  assert.equal(effectiveStripePlan(first, true, 7, first.graceEndsAt), 'free')
  for (let n = 0; n < 3; n++) await s.send(s.provider.event(s.sub))
  assert.equal((await s.stored()).graceEndsAt.getTime(), first.graceEndsAt.getTime())
  // A new, genuine Customer/Checkout has no inherited verified paid boundary.
  s.sub.status = 'canceled'; await s.send(s.provider.event(s.sub, 'customer.subscription.deleted'))
  await createStripeCheckout({ id: (await s.db.user.findFirstOrThrow({ where: { organizationId: s.org.id } })).id, organizationId: s.org.id, sessionVersion: 0 }, 'starter', { db: s.db, stripe: s.provider.stripe, config: s.provider.config })
  const checkout = await s.db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: s.org.id } })
  const replacement = s.provider.complete(checkout.checkoutSessionId, { paid: false })
  Object.assign(replacement.latest_invoice, { status: 'draft', ending_balance: null })
  await s.send(s.provider.event(replacement))
  const fresh = await s.stored()
  assert.equal(fresh.plan, 'free'); assert.equal(fresh.currentPeriodEndsAt, null); assert.equal(fresh.graceEndsAt, null)
  assert.equal((await s.coordinator()).financialHoldSubscriptionId, null)
})

for (const kind of ['discount', 'credit', 'refund']) test(`R7: explicit ${kind} still latches review during a draft`, { skip: !databaseUrl }, async t => {
  const s = await scenario(t), paidEnd = (await s.stored()).currentPeriodEndsAt.getTime()
  const invoice = s.provider.invoice(s.sub, false); s.sub.latest_invoice = invoice
  Object.assign(invoice, { status: 'draft', ending_balance: null })
  if (kind === 'discount') invoice.discounts = ['di_synthetic']
  if (kind === 'credit') invoice.starting_balance = -100
  if (kind === 'refund') {
    const refs = await s.db.stripeBillingOperation.findFirstOrThrow({ where: { organizationId: s.org.id, chargeId: { not: null } } })
    await s.send(s.provider.event({ object: 'refund', id: 're_synthetic', charge: refs.chargeId }, 'refund.created'))
  } else await s.send(s.provider.event(invoice, 'invoice.updated'))
  assert.equal((await s.stored()).billingStatus, 'manual_review_required')
  assert.equal((await s.coordinator()).financialHoldSubscriptionId, s.sub.id)
  assert.equal((await s.stored()).currentPeriodEndsAt.getTime(), paidEnd)
})

test('R8: absolute schedules preserve paid time, distinguish future renewals and honor the original period-end instruction', { skip: !databaseUrl }, async t => {
  const s = await scenario(t), paidEnd = (await s.stored()).currentPeriodEndsAt.getTime()
  const policy = async stamp => effectiveStripePlan({ ...await s.stored(), scheduledCancelAt: (await s.coordinator()).scheduledCancelAt, cancelAtPaidThrough: (await s.coordinator()).cancelAtPaidThrough }, true, 7, new Date(stamp))
  for (const offset of [-86400, 2 * 86400, 40 * 86400]) {
    const scheduled = paidEnd + offset * 1000
    Object.assign(s.sub, { cancel_at: scheduled / 1000, cancel_at_period_end: false })
    await s.send(s.provider.event(s.sub))
    assert.equal((await s.coordinator()).scheduledCancelAt.getTime(), scheduled)
    assert.equal((await s.stored()).currentPeriodEndsAt.getTime(), paidEnd)
    assert.equal(await policy(paidEnd - 1), 'starter', 'scheduling alone never removes already paid time')
    assert.equal(await policy(Math.min(paidEnd + 7 * 86400000, Math.max(paidEnd, scheduled))), 'free')
    if (offset > 0) assert.equal(await policy(paidEnd + 1), 'starter', 'a later absolute schedule still has intervening renewals')
  }
  s.sub.items.data[0].current_period_start = paidEnd / 1000
  s.sub.items.data[0].current_period_end += 30 * 86400
  s.sub.latest_invoice = s.provider.invoice(s.sub, false); s.sub.status = 'past_due'
  Object.assign(s.sub, { cancel_at: null, cancel_at_period_end: true })
  await s.send(s.provider.event(s.sub))
  assert.equal(await policy(paidEnd), 'free', 'known period-end cancellation during unpaid renewal has no grace')
  s.sub.cancel_at_period_end = false
  await s.send(s.provider.event(s.sub))
  assert.equal(await policy(paidEnd + 1), 'starter', 'verified reversal removes the cancellation cap')
  assert.equal(await policy(paidEnd + 7 * 86400000), 'free', 'reversal cannot renew the seven-day grace window')
})
