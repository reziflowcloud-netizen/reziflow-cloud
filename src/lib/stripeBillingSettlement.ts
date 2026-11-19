import type Stripe from 'stripe'

export function stripeObjectId(value: unknown): string | null {
  return typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null
}
export type Settlement = { state: 'paid' | 'unpaid' | 'manual_review'; reason: string; paidThrough?: Date; invoiceId?: string; paymentIntentId?: string; chargeId?: string }

// Conservative MVP scope, not an assertion that credits/discounts are invalid.
// All calls are READS and run between durable reservation and short finalization.
export async function verifyStripeSettlement(stripe: Stripe, subscription: Stripe.Subscription, customerId: string, expected: number): Promise<Settlement> {
  const refs: { invoiceId?: string; paymentIntentId?: string; chargeId?: string } = {}
  const review = (reason: string): Settlement => ({ state: 'manual_review', reason, ...refs })
  const invoiceId = stripeObjectId(subscription.latest_invoice), item = subscription.items.data[0]
  if (!invoiceId) return review('INVOICE_UNAVAILABLE')
  const invoice = await stripe.invoices.retrieve(invoiceId)
  if (invoice.livemode !== false || stripeObjectId(invoice.customer) !== customerId ||
      stripeObjectId(invoice.parent?.subscription_details?.subscription) !== subscription.id || invoice.currency !== 'pln') return review('INVOICE_RELATIONSHIP')
  refs.invoiceId = invoice.id
  if (invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0) return review('CREDIT_NOTE')
  if (invoice.discounts?.length || invoice.total_discount_amounts?.length || invoice.total_pretax_credit_amounts?.length) return review('DISCOUNT_OR_CREDIT')
  if (invoice.starting_balance !== 0 || invoice.ending_balance !== 0) return review('CUSTOMER_BALANCE')
  if ((invoice.amount_paid_off_stripe ?? 0) !== 0) return review('OUT_OF_BAND')
  if (invoice.total_taxes?.some(tax => tax.amount !== 0) || invoice.collection_method !== 'charge_automatically' ||
      !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason || '')) return review('UNSUPPORTED_INVOICE')
  const line = invoice.lines.data[0]
  if (invoice.lines.has_more || invoice.lines.data.length !== 1 || !line || line.quantity !== 1 || line.amount !== expected ||
      line.pricing?.price_details?.price !== item.price.id || line.period.start !== item.current_period_start ||
      line.period.end !== item.current_period_end || line.discount_amounts?.length || line.pretax_credit_amounts?.length) return review('UNSUPPORTED_LINES')
  if (invoice.total !== expected || invoice.subtotal !== expected || invoice.amount_due !== expected) return review('NONSTANDARD_TOTAL')
  if (invoice.status === 'open' && invoice.amount_paid === 0 && invoice.amount_remaining === expected) return { state: 'unpaid', reason: 'PAYMENT_PENDING', ...refs }
  if (invoice.status !== 'paid' || invoice.amount_paid !== expected || invoice.amount_remaining !== 0) return review('PARTIAL_OR_UNSETTLED')
  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })
  const paid = payments.data.filter(payment => payment.status === 'paid')
  if (payments.has_more || paid.length !== 1) return review('UNSUPPORTED_PAYMENT_SOURCES')
  const payment = paid[0], intentId = stripeObjectId(payment.payment.payment_intent)
  if (payment.livemode !== false || stripeObjectId(payment.invoice) !== invoice.id || payment.currency !== 'pln' ||
      payment.amount_paid !== expected || payment.amount_requested !== expected || payment.payment.type !== 'payment_intent' || !intentId) return review('UNSUPPORTED_PAYMENT_SOURCE')
  const intent = await stripe.paymentIntents.retrieve(intentId)
  if (intent.livemode !== false || intent.status !== 'succeeded' || intent.amount !== expected || intent.amount_received !== expected ||
      intent.currency !== 'pln' || stripeObjectId(intent.customer) !== customerId) return review('PAYMENT_INTENT_UNSETTLED')
  refs.paymentIntentId = intent.id
  const chargeId = stripeObjectId(intent.latest_charge)
  if (!chargeId) return review('CHARGE_UNAVAILABLE')
  const charge = await stripe.charges.retrieve(chargeId)
  if (charge.livemode !== false || charge.status !== 'succeeded' || !charge.paid || !charge.captured ||
      charge.amount !== expected || charge.amount_captured !== expected || charge.currency !== 'pln' ||
      stripeObjectId(charge.customer) !== customerId || stripeObjectId(charge.payment_intent) !== intent.id ||
      charge.payment_method_details?.type !== 'card') return review('UNSUPPORTED_CHARGE')
  refs.chargeId = charge.id
  if (charge.amount_refunded !== 0 || charge.refunded) return review('REFUND')
  if (charge.disputed) return review('DISPUTE')
  return { state: 'paid', reason: 'STANDARD_CARD_PAYMENT', ...refs, paidThrough: new Date(item.current_period_end * 1000) }
}
