import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { JWTPayload } from 'jose'
import { tokenSessionVersion } from './authToken.ts'

export const PASSWORD_RESET_EXPIRY_MS = 30 * 60 * 1000
export const PASSWORD_RESET_WINDOW_MS = 30 * 60 * 1000
export const PASSWORD_RESET_EMAIL_LIMIT = 3
export const PASSWORD_RESET_IP_LIMIT = 10
export const PASSWORD_MIN_LENGTH = 6

export function createPasswordResetToken() {
  return randomBytes(32).toString('base64url')
}

export function hashPasswordResetToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function hashRateLimitIdentifier(kind: 'email' | 'ip', value: string) {
  const secret = process.env.PASSWORD_RESET_RATE_LIMIT_SECRET?.trim() || process.env.JWT_SECRET?.trim()
  if (!secret) throw new Error('Password reset rate-limit secret is not configured')
  return createHmac('sha256', secret).update(`${kind}:${value}`, 'utf8').digest('hex')
}

export function passwordResetExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MS)
}

export function rateLimitWindowStart(now = new Date()) {
  return new Date(Math.floor(now.getTime() / PASSWORD_RESET_WINDOW_MS) * PASSWORD_RESET_WINDOW_MS)
}

export function isResetTokenUsable(token: { usedAt: Date | null, expiresAt: Date }, now = new Date()) {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime()
}

export function sessionTokenMatches(payload: JWTPayload | Record<string, unknown>, currentVersion: number) {
  return tokenSessionVersion(payload) === currentVersion
}
