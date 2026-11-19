// Synthetic loopback provider. Uses the real Stripe SDK/HTTP serialization;
// never contacts Stripe and never creates a real Test or Live subscription.
import { createServer } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { STRIPE_API_VERSION } from '../../src/lib/stripeBillingConfig.ts'

export const syntheticConfig = {
  secretKey: 'sk_test_synthetic', webhookSecret: 'whsec_synthetic', appUrl: 'http://127.0.0.1:3129',
  portalConfiguration: 'bpc_synthetic', prices: { starter: 'price_starter', pro: 'price_pro' }, graceDays: 7,
}

export async function stripeFixture({ timeout = 2000 } = {}) {
  const prefix = randomUUID().replaceAll('-', '').slice(0, 12)
  const customers = new Map(), sessions = new Map(), subscriptions = new Map(), idempotency = new Map()
  const requests = [], controls = [], pendingKeys = new Set()
  const invoices = new Map(), payments = new Map(), intents = new Map(), charges = new Map()
  let serial = 0, failNextSubscriptionRead = false
  const price = plan => ({ id: syntheticConfig.prices[plan], object: 'price', active: true, livemode: false,
    type: 'recurring', currency: 'pln', unit_amount: plan === 'starter' ? 24900 : 49900,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, billing_scheme: 'per_unit' })
  const portal = { id: syntheticConfig.portalConfiguration, active: true, livemode: false,
    features: { subscription_update: { enabled: false }, payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' } } }
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const form = Object.fromEntries(new URLSearchParams(body))
    const url = new URL(req.url, 'http://127.0.0.1')
    const method = req.method, path = url.pathname
    requests.push({ method, path, form, key: req.headers['idempotency-key'], version: req.headers['stripe-version'], at: Date.now() })
    const index = controls.findIndex(c => c.method === method && c.path === path)
    const control = index < 0 ? {} : controls.splice(index, 1)[0]
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    const key = req.headers['idempotency-key']
    if (method === 'POST' && key && idempotency.has(key)) {
      const saved = idempotency.get(key)
      if (saved.body !== body) return send({ error: { type: 'idempotency_error', message: 'Synthetic key conflict' } }, 400)
      return send(saved.data, saved.status || 200)
    }
    if (key && pendingKeys.has(key)) return send({ error: { type: 'idempotency_error', code: 'idempotency_key_in_use', message: 'Synthetic in-flight request' } }, 409)
    if (key) pendingKeys.add(key)
    try {
    if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs))
    if (control.status) {
      const data = { error: { type: control.status === 429 ? 'rate_limit_error' : 'api_error', message: 'Synthetic provider failure' } }
      if (key && control.cached) idempotency.set(key, { body, data, status: control.status })
      return send(data, control.status)
    }
    let data
    if (method === 'POST' && path === '/v1/customers') {
      data = { id: `cus_synthetic${prefix}${++serial}`, object: 'customer', livemode: false,
        metadata: { organizationId: form['metadata[organizationId]'], integration: form['metadata[integration]'], operationId: form['metadata[operationId]'] } }
      customers.set(data.id, data)
    } else if (method === 'GET' && path.startsWith('/v1/customers/')) data = customers.get(path.split('/').at(-1))
    else if (method === 'GET' && path.startsWith('/v1/prices/')) data = { ...price(path.includes('pro') ? 'pro' : 'starter'), id: path.split('/').at(-1) }
    else if (method === 'GET' && path === '/v1/subscriptions') data = {
      object: 'list', data: [...subscriptions.values()].filter(s => s.customer === url.searchParams.get('customer')), has_more: false,
    }
    else if (method === 'GET' && path.startsWith('/v1/subscriptions/')) {
      if (failNextSubscriptionRead) { failNextSubscriptionRead = false; return send({ error: { type: 'api_error', message: 'Synthetic outage' } }, 500) }
      data = subscriptions.get(path.split('/').at(-1))
    } else if (method === 'POST' && path === '/v1/checkout/sessions') {
      if (form['allowed_payment_method_types[0]'] !== 'card' || form.mode !== 'subscription' || form['line_items[0][quantity]'] !== '1') {
        return send({ error: { type: 'invalid_request_error', message: 'Invalid synthetic contract' } }, 400)
      }
      data = { id: `cs_test_synthetic${prefix}${++serial}`, object: 'checkout.session', status: 'open', livemode: false,
        customer: form.customer, subscription: null, url: 'https://checkout.stripe.com/c/pay/synthetic',
        expires_at: Math.floor(Date.now() / 1000) + 86400, price: form['line_items[0][price]'],
        metadata: { organizationId: form['metadata[organizationId]'], integration: form['metadata[integration]'], operationId: form['metadata[operationId]'] } }
      sessions.set(data.id, data)
    } else if (method === 'GET' && path === '/v1/checkout/sessions') data = { object: 'list', has_more: false, data: [...sessions.values()].filter(s => s.customer === url.searchParams.get('customer')) }
    else if (method === 'GET' && path.startsWith('/v1/checkout/sessions/')) data = sessions.get(path.split('/').at(-1))
    else if (method === 'GET' && path.startsWith('/v1/billing_portal/configurations/')) data = portal
    else if (method === 'POST' && path === '/v1/billing_portal/sessions') data = { id: 'bps_synthetic', object: 'billing_portal.session', url: 'https://billing.stripe.com/p/session/synthetic' }
    else if (method === 'GET' && path.startsWith('/v1/invoices/')) data = invoices.get(path.split('/').at(-1))
    else if (method === 'GET' && path === '/v1/invoice_payments') data = { object: 'list', has_more: false,
      data: [...payments.values()].filter(p => url.searchParams.has('invoice') ? p.invoice === url.searchParams.get('invoice') : p.payment.payment_intent === url.searchParams.get('payment[payment_intent]')) }
    else if (method === 'GET' && path.startsWith('/v1/payment_intents/')) data = intents.get(path.split('/').at(-1))
    else if (method === 'GET' && path.startsWith('/v1/charges/')) data = charges.get(path.split('/').at(-1))
    if (control.response) data = control.response
    if (!data) return send({ error: { type: 'invalid_request_error', message: 'Unknown synthetic resource' } }, 404)
    if (method === 'POST' && key) idempotency.set(key, { body, data: structuredClone(data) })
    if (control.disconnectAfterCreate) { req.socket.destroy(); return }
    return send(data)
    } finally { if (key) pendingKeys.delete(key) }
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const stripe = new Stripe(syntheticConfig.secretKey, {
    host: '127.0.0.1', port: server.address().port, protocol: 'http', apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0, timeout,
  })
  function complete(sessionId, { paid = true, status = paid ? 'active' : 'incomplete', start = Math.floor(Date.now() / 1000) } = {}) {
    const session = sessions.get(sessionId), plan = session.price === 'price_pro' ? 'pro' : 'starter'
    const subscription = { id: `sub_synthetic${prefix}${++serial}`, object: 'subscription', customer: session.customer,
      livemode: false, status, metadata: session.metadata, cancel_at_period_end: false,
      items: { object: 'list', has_more: false, data: [{ id: `si_synthetic${prefix}${serial}`, quantity: 1,
        current_period_start: start, current_period_end: start + 30 * 86400, price: price(plan) }] } }
    subscription.latest_invoice = invoice(subscription, paid)
    subscriptions.set(subscription.id, subscription)
    Object.assign(session, { status: 'complete', subscription: subscription.id, url: null })
    return subscription
  }
  function invoice(subscription, paid = true) {
    const item = subscription.items.data[0], id = `in_synthetic${prefix}${++serial}`, amount = item.price.unit_amount
    const invoice = { id, object: 'invoice', livemode: false, status: paid ? 'paid' : 'open',
      currency: 'pln', customer: subscription.customer, amount_due: amount, amount_paid: paid ? amount : 0,
      amount_paid_off_stripe: 0, amount_remaining: paid ? 0 : amount, total: amount, subtotal: amount,
      starting_balance: 0, ending_balance: 0, pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0,
      total_discount_amounts: [], total_pretax_credit_amounts: [], total_taxes: [], discounts: [], collection_method: 'charge_automatically', billing_reason: 'subscription_cycle',
      parent: { type: 'subscription_details', subscription_details: { subscription: subscription.id } },
      lines: { object: 'list', has_more: false, data: [{ id: `il_synthetic${prefix}${serial}`, object: 'line_item',
        pricing: { type: 'price_details', price_details: { price: item.price.id } }, discount_amounts: [], pretax_credit_amounts: [],
        quantity: 1, amount, period: { start: item.current_period_start, end: item.current_period_end } }] } }
    invoices.set(id, invoice)
    if (paid) {
      const intentId = `pi_synthetic${prefix}${serial}`, chargeId = `ch_synthetic${prefix}${serial}`, paymentId = `inpay_synthetic${prefix}${serial}`
      intents.set(intentId, { id: intentId, object: 'payment_intent', livemode: false, status: 'succeeded', amount, amount_received: amount, currency: 'pln', customer: subscription.customer, latest_charge: chargeId })
      charges.set(chargeId, { id: chargeId, object: 'charge', livemode: false, status: 'succeeded', paid: true, captured: true, amount, amount_captured: amount,
        amount_refunded: 0, refunded: false, disputed: false, currency: 'pln', customer: subscription.customer, payment_intent: intentId, payment_method_details: { type: 'card' } })
      payments.set(paymentId, { id: paymentId, object: 'invoice_payment', livemode: false, invoice: id, currency: 'pln', amount_requested: amount, amount_paid: amount,
        status: 'paid', is_default: true, payment: { type: 'payment_intent', payment_intent: intentId } })
    }
    return invoice
  }
  function event(object, type = 'customer.subscription.updated', created = Math.floor(Date.now() / 1000), id = `evt_synthetic${prefix}${++serial}`) {
    return { id, object: 'event', api_version: STRIPE_API_VERSION, livemode: false, created, type,
      data: { object: structuredClone(object) } }
  }
  return { stripe, config: syntheticConfig, customers, sessions, subscriptions, requests, complete, invoice, event, portal, invoices, payments, intents, charges,
    control: (method, path, options) => controls.push({ method, path, ...options }),
    failNextRead: () => { failNextSubscriptionRead = true },
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
}
