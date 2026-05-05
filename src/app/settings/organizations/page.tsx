'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type OrganizationItem = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  trialEndsAt: string | null
  createdAt: string
  _count: {
    users: number
    clients: number
    cases: number
    tasks: number
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  paused: 'Пауза',
  trial: 'Пробный период',
}

const PLAN_LABELS: Record<string, string> = {
  manual: 'Ручной',
  trial: 'Пробный',
  basic: 'Basic',
  pro: 'Pro',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru')
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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
  const [editForm, setEditForm] = useState({ name: '', plan: '', status: '', trialEndsAt: '' })

  useEffect(() => {
    loadOrganizations()
  }, [])

  async function loadOrganizations() {
    setLoading(true)
    const res = await fetch('/api/organizations')
    const data = await res.json().catch(() => [])
    if (res.ok) setOrganizations(data)
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
    setEditingId(org.id)
    setEditForm({
      name: org.name,
      plan: org.plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Организации</div>
          <div className="page-subtitle">Фирмы, администраторы и тарифы внутри ReziFlow Cloud</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/settings" className="btn btn-secondary">Назад</Link>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Новая фирма</button>
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

        {showNew && (
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
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
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
                  <th>Фирма</th>
                  <th>Тариф</th>
                  <th>Статус</th>
                  <th>Пробный до</th>
                  <th>Польз.</th>
                  <th>Клиенты</th>
                  <th>Дела</th>
                  <th>Задачи</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</td></tr>
                )}
                {!loading && organizations.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>Фирм пока нет</td></tr>
                )}
                {organizations.map(org => (
                  <tr key={org.id}>
                    <td>
                      {editingId === org.id ? (
                        <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                      ) : (
                        <>
                          <div style={{ fontWeight: 700 }}>{org.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{org.slug}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id ? (
                        <select className="select" value={editForm.plan} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                          <option value="manual">Ручной</option>
                          <option value="trial">Пробный</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                        </select>
                      ) : PLAN_LABELS[org.plan] || org.plan}
                    </td>
                    <td>
                      {editingId === org.id ? (
                        <select className="select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                          <option value="active">Активна</option>
                          <option value="trial">Пробный период</option>
                          <option value="paused">Пауза</option>
                        </select>
                      ) : (
                        <span className="badge" style={{
                          background: org.status === 'active' ? '#dcfce7' : org.status === 'trial' ? '#eff6ff' : '#f3f4f6',
                          color: org.status === 'active' ? '#166534' : org.status === 'trial' ? '#1d4ed8' : '#374151',
                        }}>{STATUS_LABELS[org.status] || org.status}</span>
                      )}
                    </td>
                    <td>
                      {editingId === org.id ? (
                        <input className="input" type="date" value={editForm.trialEndsAt} onChange={e => setEditForm(p => ({ ...p, trialEndsAt: e.target.value }))} />
                      ) : formatDate(org.trialEndsAt)}
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
                      ) : (
                        <button className="btn btn-secondary" onClick={() => startEdit(org)}>Редактировать</button>
                      )}
                    </td>
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
