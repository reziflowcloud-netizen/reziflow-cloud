'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

type OrganizationItem = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  billingStatus?: string
  trialEndsAt: string | null
  createdAt: string
  users?: Array<{
    id: number
    name: string
    email: string
    role: string
  }>
  _count: {
    users: number
    clients: number
    cases: number
    tasks: number
  }
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale)
}

export default function OrganizationsPage() {
  const { lang, t } = useLanguage()
  const locale = lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU'
  const statusLabel = (status: string) => ({
    active: t('org_status_active'),
    paused: t('org_status_paused'),
    trial: t('org_status_trial'),
    expired: 'Trial истек',
    past_due: 'Просрочка',
    canceled: 'Отменена',
  }[status] || status)
  const planLabel = (plan: string) => ({
    manual: t('org_plan_manual'),
    trial: t('org_plan_trial'),
    free: 'Бесплатный',
    starter: 'Starter',
    basic: 'Basic',
    pro: 'Pro',
    agency: 'Agency',
  }[plan] || plan)
  const billingLabel = (status?: string) => ({
    manual: 'Ручной',
    trialing: 'Trial',
    active: 'Оплачено',
    past_due: 'Просрочка',
    canceled: 'Отменено',
    expired: 'Trial истек',
  }[status || ''] || status || '—')
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [canManageAll, setCanManageAll] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan: 'manual',
    status: 'active',
    trialEndsAt: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    plan: '',
    status: '',
    trialEndsAt: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })

  useEffect(() => {
    loadOrganizations()
  }, [])

  async function loadOrganizations() {
    setLoading(true)
    const res = await fetch('/api/organizations')
    const data = await res.json().catch(() => [])
    if (res.ok) {
      if (Array.isArray(data)) {
        setOrganizations(data)
        setCanManageAll(true)
      } else {
        setOrganizations(data.organizations || [])
        setCanManageAll(Boolean(data.canManageAll))
      }
    }
    else setError(data.error || 'Не удалось загрузить фирмы')
    setLoading(false)
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function createOrganization() {
    setError('')
    setSuccess('')
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      setError('Заполните название фирмы, администратора, email и пароль')
      return
    }

    setSaving(true)
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Не удалось создать фирму')
      return
    }

    setOrganizations(prev => [...prev, data])
    setForm({ name: '', slug: '', plan: 'manual', status: 'active', trialEndsAt: '', adminName: '', adminEmail: '', adminPassword: '' })
    setShowNew(false)
    setSuccess(`Фирма "${data.name}" создана. Администратор может входить по своему email и паролю.`)
  }

  function startEdit(org: OrganizationItem) {
    const primaryAdmin = org.users?.[0]
    setEditingId(org.id)
    setEditForm({
      name: org.name,
      plan: org.plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
      adminName: primaryAdmin?.name || '',
      adminEmail: primaryAdmin?.email || '',
      adminPassword: '',
    })
  }

  async function saveOrganization(id: string) {
    setError('')
    setSuccess('')
    setSaving(true)
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Не удалось сохранить фирму')
      return
    }
    setOrganizations(prev => prev.map(org => org.id === id ? data : org))
    setEditingId(null)
    setSuccess('Фирма обновлена')
  }

  async function deleteOrganization(org: OrganizationItem) {
    setError('')
    setSuccess('')

    const message = [
      `Удалить организацию "${org.name}"?`,
      '',
      `Будут удалены пользователи: ${org._count.users}`,
      `Клиенты: ${org._count.clients}`,
      `Дела: ${org._count.cases}`,
      `Задачи: ${org._count.tasks}`,
      '',
      'Это действие нельзя отменить.',
    ].join('\n')

    if (!window.confirm(message)) return

    setDeletingId(org.id)
    const res = await fetch(`/api/organizations/${org.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)

    if (!res.ok) {
      setError(data.error || 'Не удалось удалить организацию')
      return
    }

    setOrganizations(prev => prev.filter(item => item.id !== org.id))
    if (editingId === org.id) setEditingId(null)
    setSuccess(`Организация "${org.name}" удалена`)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('organizations_title')}</div>
          <div className="page-subtitle">{t('organizations_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
          {canManageAll && <button className="btn btn-primary" onClick={() => setShowNew(true)}>{t('new_company')}</button>}
        </div>
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

        {canManageAll && showNew && (
          <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--brand)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Новая фирма</div>
              <button onClick={() => setShowNew(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">Название фирмы *</label>
                <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Напр.: Legal Partner" />
              </div>
              <div className="form-group">
                <label className="label">Короткий адрес</label>
                <input className="input" value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="legal-partner" />
              </div>
              <div className="form-group">
                <label className="label">Тариф</label>
                <select className="select" value={form.plan} onChange={e => setField('plan', e.target.value)}>
                  <option value="manual">Ручной</option>
                  <option value="trial">Пробный</option>
                  <option value="free">Бесплатный</option>
                  <option value="starter">Starter</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agency</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Статус</label>
                <select className="select" value={form.status} onChange={e => setField('status', e.target.value)}>
                  <option value="active">Активна</option>
                  <option value="trial">Пробный период</option>
                  <option value="paused">Пауза</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Пробный период до</label>
                <input className="input" type="date" value={form.trialEndsAt} onChange={e => setField('trialEndsAt', e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 16px' }} />
            <div className="section-title">Первый администратор фирмы</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">Имя *</label>
                <input className="input" value={form.adminName} onChange={e => setField('adminName', e.target.value)} placeholder="Administrator" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.adminEmail} onChange={e => setField('adminEmail', e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="form-group">
                <label className="label">Пароль *</label>
                <input className="input" type="password" value={form.adminPassword} onChange={e => setField('adminPassword', e.target.value)} placeholder="Минимум 6 символов" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={createOrganization} disabled={saving}>
                {saving ? 'Создание...' : 'Создать фирму'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Отмена</button>
            </div>
          </div>
        )}

        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('administrator')}</th>
                  <th>{t('organization')}</th>
                  <th>{t('plan')}</th>
                  <th>{t('status')}</th>
                  <th>Оплата</th>
                  <th>{t('trial_until')}</th>
                  <th>{t('users_short')}</th>
                  <th>{t('clients_title')}</th>
                  <th>{t('cases_title')}</th>
                  <th>{t('tasks_title')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</td></tr>
                )}
                {!loading && organizations.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)' }}>Фирм пока нет</td></tr>
                )}
                {organizations.map(org => {
                  const primaryAdmin = org.users?.[0]
                  return (
                  <tr key={org.id}>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <div style={{ display: 'grid', gap: 8, minWidth: 220 }}>
                          <input className="input" value={editForm.adminName} onChange={e => setEditForm(p => ({ ...p, adminName: e.target.value }))} placeholder="Имя администратора" />
                          <input className="input" type="email" value={editForm.adminEmail} onChange={e => setEditForm(p => ({ ...p, adminEmail: e.target.value }))} placeholder="Email для входа" />
                          <input className="input" type="password" value={editForm.adminPassword} onChange={e => setEditForm(p => ({ ...p, adminPassword: e.target.value }))} placeholder="Новый пароль, если нужно" />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700 }}>{primaryAdmin?.name || '—'}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{primaryAdmin?.email || 'Администратор не задан'}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                      ) : (
                        <>
                          <div style={{ fontWeight: 700 }}>{org.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{org.slug}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <select className="select" value={editForm.plan} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                          <option value="manual">Ручной</option>
                          <option value="trial">Пробный</option>
                          <option value="free">Бесплатный</option>
                          <option value="starter">Starter</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                          <option value="agency">Agency</option>
                        </select>
                      ) : planLabel(org.plan)}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <select className="select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                          <option value="active">Активна</option>
                          <option value="trial">Пробный период</option>
                          <option value="paused">Пауза</option>
                        </select>
                      ) : (
                        <span className="badge" style={{
                          background: org.status === 'active' ? '#dcfce7' : org.status === 'trial' ? '#eff6ff' : '#f3f4f6',
                          color: org.status === 'active' ? '#166534' : org.status === 'trial' ? '#1d4ed8' : '#374151',
                        }}>{statusLabel(org.status)}</span>
                      )}
                    </td>
                    <td>{billingLabel(org.billingStatus)}</td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <input className="input" type="date" value={editForm.trialEndsAt} onChange={e => setEditForm(p => ({ ...p, trialEndsAt: e.target.value }))} />
                      ) : formatDate(org.trialEndsAt, locale)}
                    </td>
                    <td>{org._count.users}</td>
                    <td>{org._count.clients}</td>
                    <td>{org._count.cases}</td>
                    <td>{org._count.tasks}</td>
                    <td>
                      {editingId === org.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary" onClick={() => saveOrganization(org.id)} disabled={saving}>Сохранить</button>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Отмена</button>
                        </div>
                      ) : canManageAll ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary" onClick={() => startEdit(org)}>Редактировать</button>
                          <button
                            className="btn btn-secondary"
                            style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                            onClick={() => deleteOrganization(org)}
                            disabled={deletingId === org.id || saving}
                          >
                            {deletingId === org.id ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
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
