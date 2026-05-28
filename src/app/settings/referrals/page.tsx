'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Partner = {
  id: string
  name: string
  code: string
  status: string
  contactEmail?: string | null
  commissionType: string
  commissionValue: number
  commissionMonths: number
  signupUrl: string
  portalUrl?: string | null
  totals: { total: number, open: number, paid: number, canceled: number }
  attributions: Array<{
    id: string
    createdAt: string
    organization: {
      id: string
      name: string
      slug: string
      status: string
      plan: string
      billingStatus?: string
      trialEndsAt?: string | null
      createdAt: string
    }
  }>
}

function money(value: number) {
  return `${value.toFixed(2)} zł`
}

function statusBadge(status?: string) {
  const label: Record<string, string> = {
    trial: 'Trial',
    active: 'Активна',
    paused: 'Пауза',
    trialing: 'Trial',
    manual: 'Ручной',
    past_due: 'Просрочка',
    canceled: 'Отменена',
    expired: 'Истек trial',
  }
  return label[status || ''] || status || '—'
}

export default function ReferralsPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    code: '',
    contactEmail: '',
    commissionType: 'percentage',
    commissionValue: '10',
    commissionMonths: '12',
    notes: '',
    payoutDetails: '',
  })

  useEffect(() => {
    loadPartners()
  }, [])

  async function loadPartners() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/referrals')
    const data = await res.json().catch(() => ({}))
    if (res.ok) setPartners(data.partners || [])
    else setError(data.error || 'Не удалось загрузить рефералов')
    setLoading(false)
  }

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Не удалось создать партнера')
      return
    }
    setPartners(prev => [data, ...prev])
    setForm({
      name: '',
      code: '',
      contactEmail: '',
      commissionType: 'percentage',
      commissionValue: '10',
      commissionMonths: '12',
      notes: '',
      payoutDetails: '',
    })
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Рефералы</div>
          <div className="page-subtitle">Партнерские ссылки, приглашенные организации и будущие выплаты</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">Назад</Link>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: 18, maxWidth: 980 }}>
          <div className="section-title">Новый реферальный партнер</div>
          <form onSubmit={createPartner}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 220px', gap: 14 }}>
              <div className="form-group">
                <label className="label">Имя партнера *</label>
                <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Напр.: Ivan Legal Partner" required />
              </div>
              <div className="form-group">
                <label className="label">Код ссылки</label>
                <input className="input" value={form.code} onChange={e => setField('code', e.target.value)} placeholder="ivan" />
              </div>
              <div className="form-group">
                <label className="label">Email партнера</label>
                <input className="input" type="email" value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)} placeholder="partner@example.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 180px 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">Тип комиссии</label>
                <select className="select" value={form.commissionType} onChange={e => setField('commissionType', e.target.value)}>
                  <option value="percentage">Процент</option>
                  <option value="fixed">Фиксированно</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Комиссия</label>
                <input className="input" value={form.commissionValue} onChange={e => setField('commissionValue', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Месяцев</label>
                <input className="input" value={form.commissionMonths} onChange={e => setField('commissionMonths', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Заметка</label>
                <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Условия, источник, договоренность" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Реквизиты для выплат</label>
              <textarea className="input" value={form.payoutDetails} onChange={e => setField('payoutDetails', e.target.value)} rows={2} placeholder="IBAN, BLIK, договоренность по выплатам" />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Создание...' : 'Создать партнера'}</button>
          </form>
        </div>

        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Партнер</th>
                  <th>Ссылка</th>
                  <th>Условия</th>
                  <th>Приглашено</th>
                  <th>К выплате</th>
                  <th>Выплачено</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</td></tr>}
                {!loading && partners.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>Партнеров пока нет</td></tr>}
                {partners.map(partner => (
                  <tr key={partner.id}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{partner.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.contactEmail || 'Email не указан'}</div>
                      {partner.portalUrl && <a href={partner.portalUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}>Кабинет партнера</a>}
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{partner.signupUrl}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Код: {partner.code}</div>
                    </td>
                    <td>
                      {partner.commissionType === 'percentage' ? `${partner.commissionValue}%` : money(partner.commissionValue)}
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissionMonths} мес.</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800 }}>{partner.attributions.length}</div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                        {partner.attributions.slice(0, 4).map(item => (
                          <div key={item.id} style={{ fontSize: 12 }}>
                            <strong>{item.organization.name}</strong>
                            <span style={{ color: 'var(--muted)' }}> · {statusBadge(item.organization.billingStatus || item.organization.status)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{money(partner.totals.open)}</td>
                    <td>{money(partner.totals.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
