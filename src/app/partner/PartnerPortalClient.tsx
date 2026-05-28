'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type PartnerData = {
  name: string
  code: string
  commissionType: string
  commissionValue: number
  commissionMonths: number
  totals: { total: number, open: number, paid: number }
  attributions: Array<{
    id: string
    createdAt: string
    organization: {
      name: string
      status: string
      plan: string
      billingStatus?: string
      trialEndsAt?: string | null
      createdAt: string
    }
  }>
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} zł`
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    trial: 'Trial',
    trialing: 'Trial',
    active: 'Активна',
    manual: 'Ручная оплата',
    past_due: 'Ожидает оплаты',
    canceled: 'Отменена',
    expired: 'Trial истек',
  }
  return labels[status || ''] || status || '—'
}

export default function PartnerPortalClient({ code, token }: { code?: string, token?: string }) {
  const [partner, setPartner] = useState<PartnerData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(code && token))

  useEffect(() => {
    if (!code || !token) return
    fetch(`/api/partner/referrals?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Не удалось открыть кабинет партнера')
        return data
      })
      .then(data => setPartner(data.partner))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [code, token])

  return (
    <main className="register-page">
      <section className="register-panel">
        <Link href="/" className="register-logo">
          <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
        </Link>
        <p className="marketing-kicker">Партнерский кабинет</p>
        <h1>{partner ? partner.name : 'Реферальная статистика'}</h1>
        <p className="register-lead">
          Здесь партнер видит только свои приглашенные организации и начисления. CRM-данные клиентов не отображаются.
        </p>

        {!code || !token ? (
          <div className="error-msg">Откройте кабинет по персональной ссылке партнера.</div>
        ) : loading ? (
          <div className="card" style={{ maxWidth: 720 }}>Загрузка...</div>
        ) : error ? (
          <div className="error-msg">{error}</div>
        ) : partner ? (
          <div className="table-container" style={{ maxWidth: 900 }}>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Организация</th>
                    <th>Статус</th>
                    <th>Тариф</th>
                    <th>Дата регистрации</th>
                  </tr>
                </thead>
                <tbody>
                  {partner.attributions.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Приглашенных организаций пока нет</td></tr>
                  )}
                  {partner.attributions.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 800 }}>{item.organization.name}</td>
                      <td>{statusLabel(item.organization.billingStatus || item.organization.status)}</td>
                      <td>{item.organization.plan}</td>
                      <td>{new Date(item.organization.createdAt).toLocaleDateString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="register-aside" aria-label="Партнерские итоги">
        <div>
          <strong>Начислено</strong>
          <ul>
            <li>Всего: {money(partner?.totals.total || 0)}</li>
            <li>К выплате: {money(partner?.totals.open || 0)}</li>
            <li>Выплачено: {money(partner?.totals.paid || 0)}</li>
          </ul>
        </div>
        <div>
          <strong>Условия</strong>
          <ul>
            <li>{partner?.commissionType === 'fixed' ? money(partner?.commissionValue || 0) : `${partner?.commissionValue || 0}%`} от оплаченных счетов</li>
            <li>Период: {partner?.commissionMonths || 0} месяцев</li>
            <li>Начисления появляются после успешной оплаты организации</li>
          </ul>
        </div>
      </aside>
    </main>
  )
}
