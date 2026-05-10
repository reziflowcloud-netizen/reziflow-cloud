import { randomBytes, timingSafeEqual } from 'crypto'

export type LeadWebhookSettings = {
  leadWebhookEnabled?: boolean
  leadWebhookKey?: string
}

export function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function getLeadWebhookSettings(value: unknown): LeadWebhookSettings {
  const raw = settingsObject(value)
  return {
    leadWebhookEnabled: raw.leadWebhookEnabled !== false,
    leadWebhookKey: typeof raw.leadWebhookKey === 'string' ? raw.leadWebhookKey : '',
  }
}

export function generateLeadWebhookKey() {
  return `rzf_${randomBytes(24).toString('hex')}`
}

export function keyMatches(expected: string, received: string) {
  if (!expected || !received) return false
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function sanitizeLeadWebhookPayload(value: unknown) {
  const raw = settingsObject(value)
  const blocked = new Set(['key', 'apiKey', 'token', 'password', 'secret', 'authorization'])
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => !blocked.has(key))
      .map(([key, item]) => [key, typeof item === 'string' && item.length > 1000 ? `${item.slice(0, 1000)}...` : item])
  )
}
