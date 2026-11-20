export const STRIPE_BILLING_PROVIDER = 'stripe_test'
export const STRIPE_API_VERSION = '2026-11-18.endive' as const
export type StripePlan = 'starter' | 'pro'
export type StripeBillingConfig = {
  secretKey: string
  webhookSecret: string
  appUrl: string
  portalConfiguration: string
  prices: Record<StripePlan, string>
  graceDays: number
}

export class StripeBillingError extends Error {
  code: string
  status: number
  constructor(code: string, status = 409) { super(code); this.code = code; this.status = status }
}

// Test-only even if somebody accidentally supplies a live key or enables the
// flag in a production environment. No public/NEXT_PUBLIC configuration.
export function stripeBillingConfig(env = process.env): StripeBillingConfig | null {
  if (env.STRIPE_BILLING_ENABLED !== 'true' || env.VERCEL_ENV === 'production') return null
  const secretKey = env.STRIPE_SECRET_KEY || ''
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || ''
  const starter = env.STRIPE_STARTER_PRICE_ID || ''
  const pro = env.STRIPE_PRO_PRICE_ID || ''
  const portalConfiguration = env.STRIPE_PORTAL_CONFIGURATION_ID || ''
  const graceDays = Number(env.STRIPE_BILLING_GRACE_DAYS)
  if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secretKey) || !webhookSecret.startsWith('whsec_') ||
      !/^price_[A-Za-z0-9]+$/.test(starter) || !/^price_[A-Za-z0-9]+$/.test(pro) || starter === pro ||
      !/^bpc_[A-Za-z0-9]+$/.test(portalConfiguration) || !Number.isInteger(graceDays) || graceDays < 1 || graceDays > 14) return null
  try {
    const url = new URL(env.STRIPE_BILLING_APP_URL || '')
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        (!local && url.protocol !== 'https:') || (local && !['http:', 'https:'].includes(url.protocol)) ||
        /(^|\.)legalhubcrm\.com$/i.test(url.hostname)) return null
    return { secretKey, webhookSecret, appUrl: url.origin, portalConfiguration, prices: { starter, pro }, graceDays }
  } catch { return null }
}

export function requireStripeBillingConfig() {
  const config = stripeBillingConfig()
  if (!config) throw new StripeBillingError('BILLING_UNAVAILABLE', 503)
  return config
}
