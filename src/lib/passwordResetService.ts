import bcrypt from 'bcryptjs'
import { prisma } from './prisma.ts'
import { normalizeEmail } from './identity.ts'
import { sendPasswordResetEmail } from './emailNotifications.ts'
import { recordPasswordResetAuditEvent } from './passwordResetAudit.ts'
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  createPasswordResetToken,
  hashPasswordResetToken,
  hashRateLimitIdentifier,
  isResetTokenUsable,
  passwordResetExpiry,
  rateLimitWindowStart,
} from './passwordResetSecurity.ts'
import { normalizeMarketingLang, type MarketingLang } from './marketingI18n.ts'

export const FORGOT_PASSWORD_PUBLIC_RESULT = { success: true } as const
export const RESET_PASSWORD_INVALID_RESULT = 'invalid_or_expired' as const

type ResetDependencies = {
  db: any
  now: () => Date
  createToken: () => string
  hashPassword: (password: string) => Promise<string>
  sendEmail: typeof sendPasswordResetEmail
  audit: typeof recordPasswordResetAuditEvent
  hashIdentifier: typeof hashRateLimitIdentifier
}

const defaultDependencies: ResetDependencies = {
  db: prisma,
  now: () => new Date(),
  createToken: createPasswordResetToken,
  hashPassword: password => bcrypt.hash(password, 10),
  sendEmail: sendPasswordResetEmail,
  audit: recordPasswordResetAuditEvent,
  hashIdentifier: hashRateLimitIdentifier,
}

async function consumeRateLimit(
  db: any,
  keyHash: string,
  limit: number,
  now: Date,
) {
  const bucket = await db.passwordResetRateLimit.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart: rateLimitWindowStart(now) } },
    create: { keyHash, windowStart: rateLimitWindowStart(now), requestCount: 1 },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  })
  return bucket.requestCount <= limit
}

export function createPasswordResetService(overrides: Partial<ResetDependencies> = {}) {
  const deps = { ...defaultDependencies, ...overrides }

  return {
    async request(input: {
      email: unknown
      language: unknown
      origin: string
      sourceIp?: string | null
    }) {
      const now = deps.now()
      const email = normalizeEmail(input.email)
      if (!email || email.length > 320) return FORGOT_PASSWORD_PUBLIC_RESULT

      const emailAllowed = await consumeRateLimit(
        deps.db,
        deps.hashIdentifier('email', email),
        PASSWORD_RESET_EMAIL_LIMIT,
        now,
      )
      const ipAllowed = input.sourceIp
        ? await consumeRateLimit(
            deps.db,
            deps.hashIdentifier('ip', input.sourceIp),
            PASSWORD_RESET_IP_LIMIT,
            now,
          )
        : true

      deps.db.passwordResetRateLimit.deleteMany({
        where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }).catch(() => undefined)

      if (!emailAllowed || !ipAllowed) return FORGOT_PASSWORD_PUBLIC_RESULT

      const user = await deps.db.user.findUnique({
        where: { email },
        select: { id: true, email: true, organizationId: true },
      })
      if (!user) return FORGOT_PASSWORD_PUBLIC_RESULT

      const rawToken = deps.createToken()
      const tokenHash = hashPasswordResetToken(rawToken)
      const created = await deps.db.$transaction(async (tx: any) => {
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        })
        return tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt: passwordResetExpiry(now) },
          select: { id: true },
        })
      })

      deps.audit({ event: 'password_reset_requested', userId: user.id, organizationId: user.organizationId })
      const language = normalizeMarketingLang(String(input.language || '')) as MarketingLang
      const resetUrl = `${input.origin.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`
      const delivery = await deps.sendEmail({ to: user.email, resetUrl, language })
      if (!delivery.sent) {
        await deps.db.passwordResetToken.updateMany({
          where: { id: created.id, usedAt: null },
          data: { usedAt: deps.now() },
        })
        deps.audit({ event: 'password_reset_delivery_failed', userId: user.id, organizationId: user.organizationId })
      }

      return FORGOT_PASSWORD_PUBLIC_RESULT
    },

    async reset(input: { token: unknown, password: unknown }) {
      const rawToken = String(input.token || '')
      const password = String(input.password || '')
      if (!rawToken || rawToken.length > 512 || password.length < PASSWORD_MIN_LENGTH) {
        return { success: false, reason: RESET_PASSWORD_INVALID_RESULT }
      }

      const tokenHash = hashPasswordResetToken(rawToken)
      const now = deps.now()
      const result = await deps.db.$transaction(async (tx: any) => {
        const token = await tx.passwordResetToken.findUnique({
          where: { tokenHash },
          include: { user: { select: { id: true, organizationId: true } } },
        })
        if (!token?.user || !isResetTokenUsable(token, now)) return null

        const claimed = await tx.passwordResetToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        })
        if (claimed.count !== 1) return null

        const passwordHash = await deps.hashPassword(password)
        await tx.user.update({
          where: { id: token.user.id },
          data: { password: passwordHash, sessionVersion: { increment: 1 } },
        })
        await tx.passwordResetToken.updateMany({
          where: { userId: token.user.id, usedAt: null },
          data: { usedAt: now },
        })
        return token.user
      }, { isolationLevel: 'Serializable' })

      if (!result) return { success: false, reason: RESET_PASSWORD_INVALID_RESULT }
      deps.audit({ event: 'password_reset_completed', userId: result.id, organizationId: result.organizationId })
      return { success: true as const }
    },
  }
}

export const passwordResetService = createPasswordResetService()
