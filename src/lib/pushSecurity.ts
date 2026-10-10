import { createCipheriv, createDecipheriv, createECDH, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
      url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com') ||
      url.hostname.endsWith('.notify.windows.com')
    )
  } catch { return false }
}
export function validatePushSubscription(raw: any) {
  if (!validPushEndpoint(raw?.endpoint)) throw new Error('Invalid push endpoint')
  const p256dh = raw.keys?.p256dh
  const auth = raw.keys?.auth
  if (typeof p256dh !== 'string' || !/^[\w-]+={0,2}$/.test(p256dh) || Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(p256dh, 'base64url')[0] !== 4) throw new Error('Invalid push key')
  if (typeof auth !== 'string' || !/^[\w-]+={0,2}$/.test(auth) || Buffer.from(auth, 'base64url').length !== 16) throw new Error('Invalid push auth')
  return { endpoint: raw.endpoint, keys: { p256dh, auth } }
}
export function endpointHash(endpoint: string) { return createHash('sha256').update(endpoint).digest('hex') }
function encryptionKey() {
  const raw = process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY || ''
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Push encryption not configured')
  return Buffer.from(raw, 'hex')
}
export function encryptSubscription(subscription: unknown, aad: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(aad))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(subscription)), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}
export function decryptSubscription(encrypted: string, aad: string) {
  const [version, iv, tag, ciphertext] = encrypted.split('.')
  if (version !== 'v1') throw new Error('Invalid encrypted subscription')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return validatePushSubscription(JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString()))
}
export function subscriptionAAD(subscription: { organizationId: string; userId: number; endpointHash: string }) {
  return `${subscription.organizationId}:${subscription.userId}:${subscription.endpointHash}`
}
export function cronAuthorized(header: string | null, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32 || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export function pushConfigured() {
  const environment = process.env.VERCEL_ENV || 'development'
  let validKeys = false
  try {
    const publicKey = Buffer.from(process.env.VAPID_PUBLIC_KEY || '', 'base64url')
    const privateKey = Buffer.from(process.env.VAPID_PRIVATE_KEY || '', 'base64url')
    const pair = createECDH('prime256v1')
    if (publicKey.length === 65 && privateKey.length === 32) { pair.setPrivateKey(privateKey); validKeys = pair.getPublicKey().equals(publicKey) }
  } catch { /* invalid env values fail closed */ }
  return process.env.WEB_PUSH_ENABLED === 'true' && process.env.PUSH_ENVIRONMENT === environment && validKeys &&
    /^(mailto:|https:\/\/)/.test(process.env.VAPID_SUBJECT || '') &&
    /^[a-fA-F0-9]{64}$/.test(process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY || '')
}
export function pushPilotUserIds(): number[] {
  const raw = process.env.WEB_PUSH_PILOT_USER_IDS ?? process.env.PUSH_TEST_USER_ID ?? ''
  if (!raw || raw.length > 1000) return []
  const values = raw.split(',').map(value => value.trim())
  if (values.length > 50 || values.some(value => !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) return []
  return Array.from(new Set(values.map(Number)))
}
export function pushUserAllowed(userId: number) { return pushPilotUserIds().includes(userId) }
