import { createHmac, timingSafeEqual } from 'crypto'

export type MetaWebhookSignatureReason =
  | 'missing_app_secret'
  | 'missing_signature_header'
  | 'malformed_signature_header'
  | 'digest_mismatch'
  | 'body_unavailable'
  | 'verified'

export type MetaWebhookSignatureResult = {
  verified: boolean
  reason: MetaWebhookSignatureReason
}

export function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string | undefined,
): MetaWebhookSignatureResult {
  const secret = String(appSecret || '').trim()
  if (!secret) return { verified: false, reason: 'missing_app_secret' }

  const signature = String(signatureHeader || '').trim()
  if (!signature) return { verified: false, reason: 'missing_signature_header' }

  const match = signature.match(/^sha256=([a-f0-9]{64})$/i)
  if (!match) return { verified: false, reason: 'malformed_signature_header' }

  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const received = Buffer.from(match[1], 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { verified: false, reason: 'digest_mismatch' }
  }

  return { verified: true, reason: 'verified' }
}

export async function verifyMetaWebhookRequestSignature(request: Request): Promise<MetaWebhookSignatureResult> {
  let result: MetaWebhookSignatureResult
  try {
    const rawBody = new Uint8Array(await request.clone().arrayBuffer())
    result = verifyMetaWebhookSignature(
      rawBody,
      request.headers.get('x-hub-signature-256'),
      process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
    )
  } catch {
    result = { verified: false, reason: 'body_unavailable' }
  }

  if (result.verified) {
    console.info('Meta webhook signature validation', { reason: result.reason })
  } else {
    console.warn('Meta webhook signature validation', { reason: result.reason })
  }
  return result
}
