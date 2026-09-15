import { createHmac, timingSafeEqual } from 'crypto'

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string | undefined) {
  const secret = String(appSecret || '').trim()
  const match = String(signatureHeader || '').trim().match(/^sha256=([a-f0-9]{64})$/i)
  if (!secret || !match) return false

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  const received = Buffer.from(match[1], 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function hasValidMetaWebhookSignature(request: Request) {
  const rawBody = await request.clone().text()
  return verifyMetaWebhookSignature(
    rawBody,
    request.headers.get('x-hub-signature-256'),
    process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
  )
}
