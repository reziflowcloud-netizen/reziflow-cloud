import { createHmac, timingSafeEqual } from 'crypto'

export type MetaWebhookSignatureReason =
  | 'missing_app_secret'
  | 'missing_signature_header'
  | 'malformed_signature_header'
  | 'digest_mismatch'
  | 'ambiguous_secret_match'
  | 'body_unavailable'
  | 'verified'

export type MetaWebhookSignatureSource = 'meta' | 'instagram'

export type MetaWebhookSignatureResult = {
  verified: boolean
  reason: MetaWebhookSignatureReason
  source?: MetaWebhookSignatureSource
}

type MetaWebhookSecretCandidate = {
  source: MetaWebhookSignatureSource
  secret: string | undefined
}

export type MetaWebhookSecretPolicy = 'meta' | 'messages'

export function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string | undefined,
): MetaWebhookSignatureResult {
  return verifyMetaWebhookSignatureWithSecrets(rawBody, signatureHeader, [
    { source: 'meta', secret: appSecret },
  ])
}

export function verifyMetaWebhookSignatureWithSecrets(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  secretCandidates: MetaWebhookSecretCandidate[],
): MetaWebhookSignatureResult {
  const configuredSecrets = secretCandidates.flatMap(candidate => {
    const secret = String(candidate.secret || '').trim()
    return secret ? [{ source: candidate.source, secret }] : []
  })
  if (!configuredSecrets.length) return { verified: false, reason: 'missing_app_secret' }

  const signature = String(signatureHeader || '').trim()
  if (!signature) return { verified: false, reason: 'missing_signature_header' }

  const match = signature.match(/^sha256=([a-f0-9]{64})$/i)
  if (!match) return { verified: false, reason: 'malformed_signature_header' }

  const received = Buffer.from(match[1], 'hex')
  const matchingSources = configuredSecrets
    .filter(candidate => {
      const expected = createHmac('sha256', candidate.secret).update(rawBody).digest()
      return received.length === expected.length && timingSafeEqual(received, expected)
    })
    .map(candidate => candidate.source)

  if (!matchingSources.length) return { verified: false, reason: 'digest_mismatch' }
  if (matchingSources.length > 1) {
    return { verified: false, reason: 'ambiguous_secret_match' }
  }

  return { verified: true, reason: 'verified', source: matchingSources[0] }
}

export async function verifyMetaWebhookRequestSignature(
  request: Request,
  policy: MetaWebhookSecretPolicy,
): Promise<MetaWebhookSignatureResult> {
  let result: MetaWebhookSignatureResult
  try {
    const rawBody = new Uint8Array(await request.clone().arrayBuffer())
    const secretCandidates: MetaWebhookSecretCandidate[] = [{
      source: 'meta',
      secret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
    }]
    if (policy === 'messages') {
      secretCandidates.push({ source: 'instagram', secret: process.env.INSTAGRAM_APP_SECRET })
    }
    result = verifyMetaWebhookSignatureWithSecrets(
      rawBody,
      request.headers.get('x-hub-signature-256'),
      secretCandidates,
    )
  } catch {
    result = { verified: false, reason: 'body_unavailable' }
  }

  if (result.verified) {
    console.info('Meta webhook signature validation', { reason: result.reason, source: result.source })
  } else {
    console.warn('Meta webhook signature validation', { reason: result.reason })
  }
  return result
}
