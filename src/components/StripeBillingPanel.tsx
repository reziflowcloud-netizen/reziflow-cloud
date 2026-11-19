'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { BillingDate, BillingStatusLabel } from '@/components/BillingI18n'
import { stripeBillingText } from '@/lib/stripeBillingI18n'
import type { BillingSnapshot } from '@/lib/billing'

export default function StripeBillingPanel({ billing, organization, effectivePlan }: {
  billing: BillingSnapshot['stripe']; organization: BillingSnapshot['organization']; effectivePlan: string
}) {
  const { lang } = useLanguage()
  const text = stripeBillingText[lang] || stripeBillingText.ru
  const router = useRouter()
  const params = useSearchParams()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const returned = params.get('checkout') === 'returned'
  useEffect(() => {
    if (!returned || !billing.enabled || organization.billingStatus === 'active') return
    let remaining = 6
    const timer = window.setInterval(() => {
      router.refresh()
      if (--remaining === 0) window.clearInterval(timer)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [returned, billing.enabled, organization.billingStatus, router])

  if (!billing.enabled) return null
  const ended = ['canceled', 'incomplete_expired'].includes(organization.billingStatus)
  const attention = ['past_due', 'unpaid', 'paused', 'incomplete'].includes(organization.billingStatus)
  const selectable = billing.eligible && (!billing.managed || ended || organization.billingStatus === 'incomplete')
  const errorText = error === 'SUBSCRIPTION_EXISTS' || error === 'PAYMENT_CONFIRMATION_PENDING' ? text.exists
    : error === 'FORBIDDEN' || error === 'UNAUTHORIZED' ? text.forbidden
    : error === 'MANUAL_BILLING_REQUIRED' ? text.manual
    : error === 'BILLING_UNAVAILABLE' || error === 'PORTAL_CONFIGURATION_INVALID' ? text.unavailable : text.error

  async function openStripe(action: 'checkout' | 'portal', plan?: 'starter' | 'pro') {
    if (pending) return
    setPending(plan || action); setError(null)
    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan ? { plan } : {}),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.code || 'BILLING_RETRY'); return }
      const url = new URL(data.url)
      if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('Invalid redirect')
      window.location.assign(url.href)
    } catch { setError('BILLING_RETRY') }
    finally { setPending(null) }
  }

  return <section className="billing-section stripe-billing" aria-labelledby="stripe-billing-title" aria-busy={Boolean(pending) || refreshing}>
    <div className="billing-section-head">
      <div><h2 id="stripe-billing-title">{text.title}</h2><p>{text.description}</p></div>
      <span className="stripe-test-label">{text.test}</span>
    </div>
    {returned && organization.billingStatus !== 'active' && <div className="billing-warning" role="status">{text.returned}</div>}
    {params.get('checkout') === 'canceled' && <p role="status">{text.canceledCheckout}</p>}
    {billing.managed && <div className="stripe-subscription card">
      <div><span className="billing-usage-label">{text.status}</span><strong><BillingStatusLabel status={organization.billingStatus} /></strong></div>
      {organization.currentPeriodEndsAt && <div><span className="billing-usage-label">{organization.cancelAtPeriodEnd || ended ? text.until : text.next}</span><strong><BillingDate value={organization.currentPeriodEndsAt} /></strong></div>}
      <div className="billing-actions">
        <button type="button" className="btn btn-primary" disabled={Boolean(pending)} onClick={() => openStripe('portal')}>{pending === 'portal' ? text.loading : text.manage}</button>
        <button type="button" className="btn btn-secondary" disabled={Boolean(pending) || refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? text.loading : text.refresh}</button>
      </div>
    </div>}
    {billing.managed && organization.cancelAtPeriodEnd && !ended && <div className="billing-warning" role="status">{text.ending}</div>}
    {billing.managed && ended && <div className="billing-warning" role="status">{text.ended}</div>}
    {billing.managed && attention && <div className="billing-warning stripe-payment-notice" role="alert">
      <strong>{text.attention}</strong>
      <span>{effectivePlan !== 'free' && billing.graceEndsAt ? <>{text.grace} <BillingDate value={billing.graceEndsAt} />.</> : text.limited}</span>
    </div>}
    {error && <div className="billing-warning" role="alert">{errorText}</div>}
    <div className="stripe-plan-grid">
      {(['starter', 'pro'] as const).map(plan => <article key={plan} className={`stripe-plan-card ${plan === 'pro' ? 'stripe-plan-pro' : ''}`}>
        <div className="stripe-plan-heading"><h3>{plan === 'starter' ? 'Starter' : 'Pro'}</h3>
          {effectivePlan === plan && <span className="billing-status-badge active">{text.current}</span>}
        </div>
        <p>{plan === 'starter' ? text.starter : text.pro}</p>
        <div className="stripe-plan-price">{plan === 'starter' ? '249' : '499'} <span>{text.monthly}</span></div>
        <ul>
          <li>{plan === 'starter' ? `3 ${text.users}` : `10 ${text.usersPro}`}</li>
          <li>{plan === 'starter' ? '100' : '200'} {text.clients}</li>
          <li>{plan === 'starter' ? '100' : '200'} {text.cases}</li>
          <li>{plan === 'starter' ? '100' : '300'} {text.leads}</li>
        </ul>
        {selectable && <button type="button" className={`btn ${plan === 'pro' ? 'btn-primary' : 'btn-secondary'}`} disabled={Boolean(pending)} onClick={() => openStripe('checkout', plan)}>
          {pending === plan ? text.loading : `${organization.billingStatus === 'incomplete' ? text.resume : text.choose} ${plan === 'starter' ? 'Starter' : 'Pro'}`}
        </button>}
      </article>)}
    </div>
    <p>{billing.eligible || billing.managed ? text.rules : text.manual}</p>
  </section>
}
