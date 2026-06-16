'use client'
import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'

type Partner = {
  id: string
  name: string
  code: string
  status: string
  contactEmail?: string | null
  payoutDetails?: string | null
  notes?: string | null
  commissionType: string
  commissionValue: number
  commissionMonths: number
  signupUrl: string
  portalUrl?: string | null
  totals: { total: number, open: number, paid: number, canceled: number }
  commissions?: Array<{
    id: string
    organizationId: string
    amount: number
    currency: string
    status: string
    earnedAt: string
    paidAt?: string | null
    notes?: string | null
    organization?: {
      id: string
      name: string
    }
  }>
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

type PartnerEditForm = {
  name: string
  code: string
  status: string
  contactEmail: string
  commissionType: string
  commissionValue: string
  commissionMonths: string
  notes: string
  payoutDetails: string
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

function commissionStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: 'К выплате',
    paid: 'Выплачено',
    canceled: 'Отменено',
  }
  return labels[status || ''] || status || '—'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—'
}

export default function ReferralsPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null)
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null)
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null)
  const [payingPartnerId, setPayingPartnerId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editForms, setEditForms] = useState<Record<string, PartnerEditForm>>({})
  const [commissionForms, setCommissionForms] = useState<Record<string, { organizationId: string, amount: string, notes: string }>>({})
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
    if (data.id) setExpandedPartnerId(data.id)
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

  function buildEditForm(partner: Partner): PartnerEditForm {
    return {
      name: partner.name || '',
      code: partner.code || '',
      status: partner.status || 'active',
      contactEmail: partner.contactEmail || '',
      commissionType: partner.commissionType || 'percentage',
      commissionValue: String(partner.commissionValue || ''),
      commissionMonths: String(partner.commissionMonths || ''),
      notes: partner.notes || '',
      payoutDetails: partner.payoutDetails || '',
    }
  }

  function editForm(partner: Partner) {
    return editForms[partner.id] || buildEditForm(partner)
  }

  function startEditing(partner: Partner) {
    setError('')
    setSuccess('')
    setExpandedPartnerId(partner.id)
    setEditingPartnerId(partner.id)
    setEditForms(prev => ({ ...prev, [partner.id]: buildEditForm(partner) }))
  }

  function togglePartner(partnerId: string) {
    const isOpen = expandedPartnerId === partnerId
    setExpandedPartnerId(isOpen ? null : partnerId)
    if (isOpen && editingPartnerId === partnerId) setEditingPartnerId(null)
  }

  function setEditField(partner: Partner, key: keyof PartnerEditForm, value: string) {
    setEditForms(prev => ({
      ...prev,
      [partner.id]: { ...editForm(partner), [key]: value },
    }))
  }

  async function savePartner(partner: Partner) {
    setError('')
    setSuccess('')
    setSavingEditId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm(partner)),
    })
    const data = await res.json().catch(() => ({}))
    setSavingEditId(null)
    if (!res.ok) {
      setError(data.error || 'Не удалось сохранить партнера')
      return
    }
    setSuccess('Партнер обновлен')
    setEditingPartnerId(null)
    await loadPartners()
  }

  async function deletePartner(partner: Partner) {
    if (!window.confirm(`Удалить партнера "${partner.name}"? Если у него есть история, он будет архивирован и скрыт из списка.`)) return

    setError('')
    setSuccess('')
    setDeletingPartnerId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingPartnerId(null)
    if (!res.ok) {
      setError(data.error || 'Не удалось удалить партнера')
      return
    }
    setSuccess(data.archived ? 'Партнер архивирован' : 'Партнер удален')
    if (editingPartnerId === partner.id) setEditingPartnerId(null)
    if (expandedPartnerId === partner.id) setExpandedPartnerId(null)
    await loadPartners()
  }

  function commissionForm(partner: Partner) {
    return commissionForms[partner.id] || {
      organizationId: partner.attributions[0]?.organization.id || '',
      amount: '',
      notes: '',
    }
  }

  function setCommissionField(partner: Partner, key: string, value: string) {
    setCommissionForms(prev => ({
      ...prev,
      [partner.id]: { ...commissionForm(partner), [key]: value },
    }))
  }

  async function createCommission(partner: Partner) {
    const current = commissionForm(partner)
    setError('')
    setSuccess('')
    setSavingCommissionId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}/commissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    const data = await res.json().catch(() => ({}))
    setSavingCommissionId(null)
    if (!res.ok) {
      setError(data.error || 'Не удалось начислить комиссию')
      return
    }
    setSuccess('Комиссия начислена')
    setCommissionForms(prev => ({
      ...prev,
      [partner.id]: { organizationId: current.organizationId, amount: '', notes: '' },
    }))
    await loadPartners()
  }

  async function payOpenCommissions(partner: Partner) {
    if (!window.confirm(`Отметить все открытые начисления партнера "${partner.name}" как выплаченные?`)) return

    setError('')
    setSuccess('')
    setPayingPartnerId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Ручная выплата через админку LegalHub' }),
    })
    const data = await res.json().catch(() => ({}))
    setPayingPartnerId(null)
    if (!res.ok) {
      setError(data.error || 'Не удалось отметить выплату')
      return
    }
    setSuccess('Открытые начисления отмечены как выплаченные')
    await loadPartners()
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
        {success && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#14532d', fontSize: 13 }}>
            {success}
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
                <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} style={{ minHeight: 82, resize: 'vertical' }} placeholder="Условия, источник, договоренность" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Реквизиты для выплат</label>
              <textarea className="input" value={form.payoutDetails} onChange={e => setField('payoutDetails', e.target.value)} rows={3} style={{ minHeight: 82, resize: 'vertical' }} placeholder="IBAN, BLIK, договоренность по выплатам" />
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
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</td></tr>}
                {!loading && partners.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Партнеров пока нет</td></tr>}
                {partners.map(partner => {
                  const isExpanded = expandedPartnerId === partner.id
                  const currentCommissionForm = commissionForm(partner)

                  return (
                    <Fragment key={partner.id}>
                      <tr
                        onClick={() => togglePartner(partner.id)}
                        style={{ cursor: 'pointer', background: isExpanded ? '#f8fafc' : undefined }}
                      >
                        <td>
                          <div style={{ fontWeight: 800 }}>{partner.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.contactEmail || 'Email не указан'}</div>
                          {partner.portalUrl && (
                            <a
                              href={partner.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}
                            >
                              Кабинет партнера
                            </a>
                          )}
                        </td>
                        <td>
                          <a
                            href={partner.signupUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--brand)', display: 'block', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {partner.signupUrl}
                          </a>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Код: {partner.code}</div>
                        </td>
                        <td>
                          {partner.commissionType === 'percentage' ? `${partner.commissionValue}%` : money(partner.commissionValue)}
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissionMonths} мес.</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{partner.attributions.length}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>организаций</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{money(partner.totals.open)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissions?.filter(item => item.status === 'pending').length || 0} открытых</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{money(partner.totals.paid)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissions?.length || 0} начислений</div>
                        </td>
                        <td>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 260 }}>
                            <button type="button" className="btn btn-secondary" onClick={() => togglePartner(partner.id)}>
                              {isExpanded ? 'Скрыть' : 'Подробнее'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => editingPartnerId === partner.id ? setEditingPartnerId(null) : startEditing(partner)}
                            >
                              {editingPartnerId === partner.id ? 'Закрыть' : 'Редактировать'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ color: '#b91c1c' }}
                              onClick={() => deletePartner(partner)}
                              disabled={deletingPartnerId === partner.id}
                            >
                              {deletingPartnerId === partner.id ? 'Удаление...' : 'Удалить'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: '#fbfdff', padding: 0 }}>
                            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
                                <div>
                                  <div className="section-title" style={{ marginBottom: 8 }}>Приглашенные организации</div>
                                  {partner.attributions.length === 0 ? (
                                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Пока нет приглашенных организаций</div>
                                  ) : (
                                    <div className="table-scroll">
                                      <table className="table">
                                        <thead>
                                          <tr>
                                            <th>Организация</th>
                                            <th>Статус</th>
                                            <th>Тариф</th>
                                            <th>Дата</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {partner.attributions.map(item => (
                                            <tr key={item.id}>
                                              <td style={{ fontWeight: 800 }}>{item.organization.name}</td>
                                              <td>{statusBadge(item.organization.billingStatus || item.organization.status)}</td>
                                              <td>{item.organization.plan || '—'}</td>
                                              <td>{formatDate(item.organization.createdAt)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'grid', gap: 12 }}>
                                  <div>
                                    <div className="section-title" style={{ marginBottom: 8 }}>Начислить комиссию</div>
                                    {partner.attributions.length > 0 ? (
                                      <div style={{ display: 'grid', gap: 8 }}>
                                        <select
                                          className="select"
                                          value={currentCommissionForm.organizationId}
                                          onChange={e => setCommissionField(partner, 'organizationId', e.target.value)}
                                        >
                                          {partner.attributions.map(item => (
                                            <option key={item.organization.id} value={item.organization.id}>{item.organization.name}</option>
                                          ))}
                                        </select>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) auto', gap: 8 }}>
                                          <input
                                            className="input"
                                            value={currentCommissionForm.amount}
                                            onChange={e => setCommissionField(partner, 'amount', e.target.value)}
                                            placeholder="Сумма, PLN"
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => createCommission(partner)}
                                            disabled={savingCommissionId === partner.id}
                                          >
                                            {savingCommissionId === partner.id ? '...' : 'Начислить'}
                                          </button>
                                        </div>
                                        <textarea
                                          className="input"
                                          value={currentCommissionForm.notes}
                                          onChange={e => setCommissionField(partner, 'notes', e.target.value)}
                                          rows={4}
                                          style={{ minHeight: 96, resize: 'vertical' }}
                                          placeholder="Заметка к начислению"
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>Сначала нужна приглашенная организация</div>
                                    )}
                                  </div>

                                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 10, padding: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                                      <div>
                                        <div className="label">К выплате</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.open)}</div>
                                      </div>
                                      <div>
                                        <div className="label">Выплачено</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.paid)}</div>
                                      </div>
                                      <div>
                                        <div className="label">Всего</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.total)}</div>
                                      </div>
                                    </div>
                                    {partner.totals.open > 0 && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => payOpenCommissions(partner)}
                                        disabled={payingPartnerId === partner.id}
                                      >
                                        {payingPartnerId === partner.id ? 'Выплата...' : 'Выплатить открытые'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="section-title" style={{ marginBottom: 8 }}>Начисления по организациям</div>
                                {!!partner.commissions?.length ? (
                                  <div className="table-scroll">
                                    <table className="table">
                                      <thead>
                                        <tr>
                                          <th>Организация</th>
                                          <th>Начисление</th>
                                          <th>Сумма</th>
                                          <th>Статус</th>
                                          <th>Начислено</th>
                                          <th>Выплачено</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {partner.commissions.map(item => (
                                          <tr key={item.id}>
                                            <td style={{ fontWeight: 800 }}>{item.organization?.name || 'Организация'}</td>
                                            <td>{item.notes || 'Партнерская комиссия'}</td>
                                            <td style={{ fontWeight: 800 }}>{money(item.amount || 0)}</td>
                                            <td>{commissionStatusLabel(item.status)}</td>
                                            <td>{formatDate(item.earnedAt)}</td>
                                            <td>{formatDate(item.paidAt)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Начислений пока нет</div>
                                )}
                              </div>

                              {editingPartnerId === partner.id && (
                                <div style={{ borderTop: '1px solid var(--border)', display: 'grid', gap: 12, paddingTop: 14 }}>
                                  <div className="section-title">Редактирование партнера</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div className="form-group">
                                      <label className="label">Имя партнера *</label>
                                      <input className="input" value={editForm(partner).name} onChange={e => setEditField(partner, 'name', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Код ссылки</label>
                                      <input className="input" value={editForm(partner).code} onChange={e => setEditField(partner, 'code', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Email партнера</label>
                                      <input className="input" type="email" value={editForm(partner).contactEmail} onChange={e => setEditField(partner, 'contactEmail', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Статус</label>
                                      <select className="select" value={editForm(partner).status} onChange={e => setEditField(partner, 'status', e.target.value)}>
                                        <option value="active">Активен</option>
                                        <option value="paused">Отключен</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div className="form-group">
                                      <label className="label">Тип комиссии</label>
                                      <select className="select" value={editForm(partner).commissionType} onChange={e => setEditField(partner, 'commissionType', e.target.value)}>
                                        <option value="percentage">Процент</option>
                                        <option value="fixed">Фиксированно</option>
                                      </select>
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Комиссия</label>
                                      <input className="input" value={editForm(partner).commissionValue} onChange={e => setEditField(partner, 'commissionValue', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Месяцев</label>
                                      <input className="input" value={editForm(partner).commissionMonths} onChange={e => setEditField(partner, 'commissionMonths', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">Заметка</label>
                                      <textarea className="input" value={editForm(partner).notes} onChange={e => setEditField(partner, 'notes', e.target.value)} rows={4} style={{ minHeight: 110, resize: 'vertical' }} />
                                    </div>
                                  </div>
                                  <div className="form-group">
                                    <label className="label">Реквизиты для выплат</label>
                                    <textarea className="input" value={editForm(partner).payoutDetails} onChange={e => setEditField(partner, 'payoutDetails', e.target.value)} rows={4} style={{ minHeight: 110, resize: 'vertical' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingPartnerId(null)}>Отмена</button>
                                    <button type="button" className="btn btn-primary" onClick={() => savePartner(partner)} disabled={savingEditId === partner.id}>
                                      {savingEditId === partner.id ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
