import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOrganizationId, getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import BillingContactButton from '@/components/BillingContactButton'
import {
  BillingDate,
  BillingFeature,
  BillingLimit,
  BillingMetricLabel,
  BillingPlanPrice,
  BillingPlanSubtitle,
  BillingStatusLabel,
  BillingText,
  BillingUsageNote,
} from '@/components/BillingI18n'
import {
  BillingMetricKey,
  canManageBilling,
  getBillingSnapshot,
  getTrialDaysLeft,
  isSoftLimitWarning,
  planDisplayName,
  usagePercent,
} from '@/lib/billing'

export const dynamic = 'force-dynamic'

function statusClass(used: number, limit: number | null) {
  if (!limit) return 'is-unlimited'
  if (used >= limit) return 'is-over'
  if (isSoftLimitWarning(used, limit)) return 'is-warning'
  return ''
}

export default async function BillingSettingsPage() {
  const user = await getUser()
  if (!user) redirect('/')

  if (!canManageBilling(user)) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div>
            <div className="page-title"><BillingText id="title" /></div>
            <div className="page-subtitle"><BillingText id="restrictedSubtitle" /></div>
          </div>
          <Link href="/settings" className="btn btn-secondary"><BillingText id="back" /></Link>
        </div>
        <div className="page-body">
          <div className="card" style={{ maxWidth: 680 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}><BillingText id="noAccessTitle" /></div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              <BillingText id="noAccessBody" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const snapshot = await getBillingSnapshot(getOrganizationId(user))
  const displayName = planDisplayName(snapshot.organization.plan, snapshot.organization.billingStatus)
  const trialDaysLeft = getTrialDaysLeft(snapshot.organization.trialEndsAt)
  const metrics = Object.keys(snapshot.usage) as BillingMetricKey[]
  const hasWarnings = snapshot.softLimitWarnings.length > 0
  const showInternalBillingTools = isSystemAdmin(user)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title"><BillingText id="title" /></div>
          <div className="page-subtitle"><BillingText id="subtitle" /></div>
        </div>
        <Link href="/settings" className="btn btn-secondary"><BillingText id="back" /></Link>
      </div>

      <div className="page-body">
        <section className="billing-hero">
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}><BillingText id="currentPlan" /></div>
            <div className="billing-plan-title">
              {displayName}
              <span className={`billing-status-badge ${snapshot.organization.billingStatus}`}>
                <BillingStatusLabel status={snapshot.organization.billingStatus} />
              </span>
            </div>
            <p>
              <BillingPlanSubtitle planKey={snapshot.plan.key} fallback={snapshot.plan.subtitle} />. <BillingText id="softLimitsCopy" />
            </p>
          </div>
          <div className="billing-hero-side">
            <div className="billing-price"><BillingPlanPrice planKey={snapshot.plan.key} fallback={snapshot.plan.price} /></div>
            {snapshot.organization.billingStatus === 'trialing' && (
              <div className="billing-date">
                <BillingText id="trialUntil" values={{ date: <BillingDate value={snapshot.organization.trialEndsAt} /> }} />
                {trialDaysLeft !== null && <strong><BillingText id="daysLeft" values={{ days: trialDaysLeft }} /></strong>}
              </div>
            )}
            {snapshot.organization.currentPeriodEndsAt && (
              <div className="billing-date">
                <BillingText id="periodUntil" values={{ date: <BillingDate value={snapshot.organization.currentPeriodEndsAt} /> }} />
              </div>
            )}
            <div className="billing-actions">
              <a href="/pricing" className="btn btn-primary"><BillingText id="viewPlans" /></a>
              <BillingContactButton
                initialName={String(user.name || '')}
                initialContact={String(user.email || '')}
                initialCompany={snapshot.organization.name}
              />
            </div>
          </div>
        </section>

        {hasWarnings && (
          <div className="billing-warning">
            <strong><BillingText id="warningTitle" /></strong>
            <span><BillingText id="warningBody" /></span>
          </div>
        )}

        <section className="billing-section">
          <div className="billing-section-head">
            <div>
              <h2><BillingText id="usageTitle" /></h2>
              <p><BillingText id="usageBody" /></p>
            </div>
          </div>

          <div className="billing-usage-grid">
            {metrics.map(key => {
              const used = snapshot.usage[key]
              const limit = snapshot.plan.limits[key]
              const percent = usagePercent(used, limit)
              const customLimit = snapshot.customLimitKeys.includes(key)
              return (
                <div key={key} className={`billing-usage-card ${statusClass(used, limit)}`}>
                  <div className="billing-usage-label"><BillingMetricLabel metric={key} /></div>
                  <div className="billing-usage-value">
                    <strong>{used}</strong>
                    <span>/ <BillingLimit limit={limit} /></span>
                  </div>
                  <div className="billing-meter" aria-hidden="true">
                    <span style={{ width: `${percent ?? 100}%` }} />
                  </div>
                  <div className="billing-usage-note">
                    <BillingUsageNote limit={limit} percent={percent} customLimit={customLimit} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="billing-section">
          <div className="billing-section-head">
            <div>
              <h2><BillingText id="includedTitle" /></h2>
              <p><BillingText id="includedBody" /></p>
            </div>
          </div>
          <div className="billing-feature-grid">
            {snapshot.plan.features.map((feature, index) => (
              <div key={feature} className="billing-feature-item">
                <span aria-hidden="true">✓</span>
                <div><BillingFeature planKey={snapshot.plan.key} index={index} fallback={feature} /></div>
              </div>
            ))}
          </div>
        </section>

        {showInternalBillingTools && (
          <section className="billing-next-step">
            <div>
              <h2><BillingText id="nextStepTitle" /></h2>
              <p><BillingText id="nextStepBody" /></p>
            </div>
            <Link href="/settings/organizations" className="btn btn-secondary"><BillingText id="organizations" /></Link>
          </section>
        )}
      </div>
    </div>
  )
}
