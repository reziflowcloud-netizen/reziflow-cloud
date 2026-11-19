import { StripeBillingError, requireStripeBillingConfig } from './stripeBillingConfig.ts'
import { createStripeCheckout, createStripePortal, stripeRuntime, verifyStripeEvent, processStripeEvent } from './stripeBilling.ts'

const headers = { 'Cache-Control': 'no-store' }
export function stripeBillingFailure(error: unknown) {
  if (error instanceof StripeBillingError) return Response.json({ error: error.code, code: error.code }, { status: error.status, headers })
  // Never serialize/log Stripe errors: they may contain request data or PII.
  return Response.json({ error: 'BILLING_RETRY', code: 'BILLING_RETRY' }, { status: 503, headers })
}

export async function stripeBillingAction(request: Request, actor: Parameters<typeof createStripeCheckout>[0], action: 'checkout' | 'portal', runtime?: ReturnType<typeof stripeRuntime>) {
  try {
    if (!actor) throw new StripeBillingError('UNAUTHORIZED', 401)
    const config = runtime?.config || requireStripeBillingConfig()
    if (request.headers.get('origin') !== config.appUrl) throw new StripeBillingError('ORIGIN_MISMATCH', 403)
    if (Number(request.headers.get('content-length') || 0) > 1024) throw new StripeBillingError('INVALID_REQUEST', 400)
    const raw = await request.text()
    if (raw.length > 1024) throw new StripeBillingError('INVALID_REQUEST', 400)
    const body: unknown = JSON.parse(raw || '{}')
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StripeBillingError('INVALID_REQUEST', 400)
    const keys = Object.keys(body)
    if (action === 'checkout') {
      const plan = (body as { plan?: unknown }).plan
      if (keys.length !== 1 || keys[0] !== 'plan' || (plan !== 'starter' && plan !== 'pro')) throw new StripeBillingError('INVALID_PLAN', 400)
      return Response.json(await createStripeCheckout(actor, plan, runtime), { headers })
    }
    if (keys.length) throw new StripeBillingError('INVALID_REQUEST', 400)
    return Response.json(await createStripePortal(actor, runtime), { headers })
  } catch (error) {
    if (error instanceof SyntaxError) return stripeBillingFailure(new StripeBillingError('INVALID_REQUEST', 400))
    return stripeBillingFailure(error)
  }
}

export async function stripeBillingWebhook(request: Request, runtime?: ReturnType<typeof stripeRuntime>) {
  try {
    const context = runtime || stripeRuntime()
    const signature = request.headers.get('stripe-signature')
    if (!signature) throw new StripeBillingError('INVALID_SIGNATURE', 400)
    if (Number(request.headers.get('content-length') || 0) > 1048576) throw new StripeBillingError('PAYLOAD_TOO_LARGE', 413)
    const event = verifyStripeEvent(await request.text(), signature, context)
    return Response.json(await processStripeEvent(event, context), { headers })
  } catch (error) { return stripeBillingFailure(error) }
}
