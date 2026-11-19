import { STRIPE_BILLING_PROVIDER } from './stripeBillingConfig.ts'

export type BillingOrganization = {
  plan: string; status: string; billingProvider: string; billingStatus: string
  billingSubscriptionId: string | null; billingCustomerId: string | null
  currentPeriodEndsAt: Date | null; graceEndsAt: Date | null; trialEndsAt: Date | null
  settings: unknown
}

export function hasCustomBillingLimits(settings: unknown) {
  const limits = (settings as { billingLimits?: unknown } | null)?.billingLimits
  return Boolean(limits && typeof limits === 'object' && Object.keys(limits).length)
}

export function stripeManaged(org: BillingOrganization) {
  return org.billingProvider === STRIPE_BILLING_PROVIDER &&
    ['free', 'starter', 'pro'].includes(org.plan) && org.billingStatus !== 'manual' &&
    org.billingStatus !== 'trialing' && org.status === 'active' && !org.trialEndsAt
}

export function canStartStripeCheckout(org: BillingOrganization) {
  if (org.status !== 'active' || org.trialEndsAt || org.billingStatus === 'trialing' || hasCustomBillingLimits(org.settings)) return false
  if (stripeManaged(org)) return true
  // Existing manually administered paid customers never migrate implicitly.
  return org.plan === 'free' && org.billingProvider === 'manual' &&
    ['manual', 'unconfigured'].includes(org.billingStatus) && !org.billingCustomerId && !org.billingSubscriptionId
}

export function effectiveStripePlan(org: BillingOrganization, enabled: boolean, graceDays: number, now = new Date()) {
  if (!enabled || !stripeManaged(org)) return org.plan
  if (['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(org.billingStatus)) return 'free'
  if (org.billingStatus === 'past_due') return org.graceEndsAt && org.graceEndsAt > now ? org.plan : 'free'
  // A missed webhook cannot grant an indefinitely paid plan. The same agreed
  // grace applies while renewals are delayed. Nothing deletes existing data.
  if (org.billingStatus === 'active' && org.currentPeriodEndsAt &&
      org.currentPeriodEndsAt.getTime() + graceDays * 86400000 <= now.getTime()) return 'free'
  return org.billingStatus === 'active' ? org.plan : 'free'
}
