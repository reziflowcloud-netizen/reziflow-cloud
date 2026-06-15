import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOrganizationId, getUser } from '@/lib/auth'
import {
  BILLING_METRIC_LABELS,
  BillingMetricKey,
  billingStatusLabel,
  canManageBilling,
  getBillingSnapshot,
  getTrialDaysLeft,
  isSoftLimitWarning,
  planDisplayName,
  usagePercent,
} from '@/lib/billing'

export const dynamic = 'force-dynamic'

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU')
}

function limitText(limit: number | null) {
  return limit ? String(limit) : 'Без лимита'
}

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
            <div className="page-title">Тариф и оплата</div>
            <div className="page-subtitle">Информация доступна администратору организации</div>
          </div>
          <Link href="/settings" className="btn btn-secondary">Назад</Link>
        </div>
        <div className="page-body">
          <div className="card" style={{ maxWidth: 680 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Недостаточно прав</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              Тариф, оплату и лимиты может смотреть администратор организации.
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Тариф и оплата</div>
          <div className="page-subtitle">План, пробный период и мягкие лимиты организации</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">Назад</Link>
      </div>

      <div className="page-body">
        <section className="billing-hero">
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Текущий тариф</div>
            <div className="billing-plan-title">
              {displayName}
              <span className={`billing-status-badge ${snapshot.organization.billingStatus}`}>
                {billingStatusLabel(snapshot.organization.billingStatus)}
              </span>
            </div>
            <p>
              {snapshot.plan.subtitle}. Сейчас лимиты работают как подсказки: система предупреждает,
              но не блокирует рабочие данные.
            </p>
          </div>
          <div className="billing-hero-side">
            <div className="billing-price">{snapshot.plan.price}</div>
            {snapshot.organization.billingStatus === 'trialing' && (
              <div className="billing-date">
                Пробный период до {formatDate(snapshot.organization.trialEndsAt)}
                {trialDaysLeft !== null && <strong>{trialDaysLeft} дн. осталось</strong>}
              </div>
            )}
            {snapshot.organization.currentPeriodEndsAt && (
              <div className="billing-date">
                Период до {formatDate(snapshot.organization.currentPeriodEndsAt)}
              </div>
            )}
            <div className="billing-actions">
              <a href="/#pricing" className="btn btn-primary">Посмотреть тарифы</a>
              <a href="mailto:reziflowcloud@gmail.com?subject=LegalHub%20CRM%20upgrade" className="btn btn-secondary">Связаться</a>
            </div>
          </div>
        </section>

        {hasWarnings && (
          <div className="billing-warning">
            <strong>Организация приближается к лимиту Free.</strong>
            <span>Данные не блокируются, но лучше заранее перейти на Pro или обсудить ручной тариф.</span>
          </div>
        )}

        <section className="billing-section">
          <div className="billing-section-head">
            <div>
              <h2>Использование</h2>
              <p>Эти счетчики помогают понять, когда пора расширять тариф.</p>
            </div>
          </div>

          <div className="billing-usage-grid">
            {metrics.map(key => {
              const used = snapshot.usage[key]
              const limit = snapshot.plan.limits[key]
              const percent = usagePercent(used, limit)
              return (
                <div key={key} className={`billing-usage-card ${statusClass(used, limit)}`}>
                  <div className="billing-usage-label">{BILLING_METRIC_LABELS[key]}</div>
                  <div className="billing-usage-value">
                    <strong>{used}</strong>
                    <span>/ {limitText(limit)}</span>
                  </div>
                  <div className="billing-meter" aria-hidden="true">
                    <span style={{ width: `${percent ?? 100}%` }} />
                  </div>
                  <div className="billing-usage-note">
                    {limit ? `${percent}% лимита` : 'Лимит не применяется'}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="billing-section">
          <div className="billing-section-head">
            <div>
              <h2>Что входит</h2>
              <p>Сейчас это продуктовый контур тарифов. Автоматическую оплату подключим отдельным этапом.</p>
            </div>
          </div>
          <div className="billing-feature-grid">
            {snapshot.plan.features.map(feature => (
              <div key={feature} className="billing-feature-item">
                <span aria-hidden="true">✓</span>
                <div>{feature}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="billing-next-step">
          <div>
            <h2>Следующий шаг</h2>
            <p>
              После проверки интерфейса можно добавить реальные правила: мягкие предупреждения в формах,
              затем Stripe или ручную оплату через администратора.
            </p>
          </div>
          <Link href="/settings/organizations" className="btn btn-secondary">Организации</Link>
        </section>
      </div>
    </div>
  )
}
