import { STRIPE_BILLING_PROVIDER } from './stripeBillingConfig.ts'

export type BillingOrganization = {
  plan: string; status: string; billingProvider: string; billingStatus: string
  billingSubscriptionId: string | null; billingCustomerId: string | null
  cancelAtPeriodEnd: boolean; currentPeriodEndsAt: Date | null; graceEndsAt: Date | null; trialEndsAt: Date | null
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
  if (org.billingStatus === 'manual_review_required') return false
  if (stripeManaged(org)) return true
  // Existing manually administered paid customers never migrate implicitly.
  return org.plan === 'free' && org.billingProvider === 'manual' &&
    ['manual', 'unconfigured'].includes(org.billingStatus) && !org.billingCustomerId && !org.billingSubscriptionId
}

export function effectiveStripePlan(org: BillingOrganization, enabled: boolean, graceDays: number, now = new Date()) {
  if (!enabled || !stripeManaged(org)) return org.plan
  const end = org.currentPeriodEndsAt?.getTime()
  if (!end || !Number.isFinite(end)) return 'free'
  // A known cancellation has no renewal to grace, even if the final event is lost.
  if (org.cancelAtPeriodEnd && now.getTime() >= end) return 'free'
  if (['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(org.billingStatus)) return 'free'
  if (org.billingStatus === 'manual_review_required') return now.getTime() < end ? org.plan : 'free'
  if (org.billingStatus === 'past_due') return org.graceEndsAt && Number.isFinite(org.graceEndsAt.getTime()) &&
    now < org.graceEndsAt && now.getTime() < end + graceDays * 86400000 ? org.plan : 'free'
  if (org.billingStatus === 'active' && now.getTime() < end + (org.cancelAtPeriodEnd ? 0 : graceDays * 86400000)) return org.plan
  return 'free'
}
