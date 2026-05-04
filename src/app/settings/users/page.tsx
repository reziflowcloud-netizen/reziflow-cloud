// src/app/settings/users/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface UserItem {
  id: number
  name: string
  email: string
  role: string
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  employee: 'Сотрудник',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#fef3c7', color: '#92400e' },
  employee: { bg: '#eff6ff', color: '#1d4ed8' },
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [newForm, setNewForm] = useState({ name: '', email: '', password: '', role: 'employee' })
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
  }

  function setN(k: string, v: string) { setNewForm(p => ({ ...p, [k]: v })) }
  function setE(k: string, v: string) { setEditForm(p => ({ ...p, [k]: v })) }

  async function createUser() {
    setError(''); setSuccess('')
    if (!newForm.name.trim() || !newForm.email.trim() || !newForm.password.trim()) {
      setError('Заполните все поля'); return
    }
    if (newForm.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов'); return
    }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Ошибка создания'); setSaving(false); return }
    setUsers(p => [...p, data])
    setNewForm({ name: '', email: '', password: '', role: 'employee' })
    setShowNew(false)
    setSuccess(`Пользователь "${data.name}" успешно создан`)
    setSaving(false)
    setTimeout(() => setSuccess(''), 4000)
  }

  function startEdit(u: UserItem) {
    setEditingId(u.id)
    setEditForm({ name: u.name, email: u.email, role: u.role, password: '' })
    setError('')
  }

  async function saveEdit(id: number) {
    setError('')
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError('Имя и email обязательны'); return
    }
    if (editForm.password && editForm.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов'); return
    }
    setSaving(true)
    const body: any = { name: editForm.name, email: editForm.email, role: editForm.role }
    if (editForm.password) body.password = editForm.password
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Ошибка сохранения'); setSaving(false); return }
    setUsers(p => p.map(u => u.id === id ? data : u))
    setEditingId(null)
    setSuccess('Данные обновлены')
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Удалить пользователя "${name}"? Это действие нельзя отменить.`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Ошибка удаления'); return }
    setUsers(p => p.filter(u => u.id !== id))
    setSuccess(`Пользователь "${name}" удалён`)
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">👥 Пользователи системы</div>
          <div className="page-subtitle">Управление доступом к ReziFlow</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/settings" className="btn btn-secondary">← Назад</Link>
          <button onClick={() => { setShowNew(true); setEditingId(null); setError('') }} className="btn btn-primary">
            + Добавить пользователя
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Уведомления */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
          </div>
        )}
        {success && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#14532d', fontSize: 13 }}>
            ✅ {success}
          </div>
        )}

        {/* Форма создания нового пользователя */}
        {showNew && (
          <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--brand)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Новый пользователь</div>
              <button onClick={() => { setShowNew(false); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">Имя *</label>
                <input className="input" value={newForm.name} onChange={e => setN('name', e.target.value)} placeholder="Иван Иванов" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" value={newForm.email} onChange={e => setN('email', e.target.value)} placeholder="ivan@example.com" />
              </div>
              <div className="form-group">
                <label className="label">Пароль * (мин. 6 символов)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPasswords['new'] ? 'text' : 'password'}
                    value={newForm.password}
                    onChange={e => setN('password', e.target.value)}
                    placeholder="Введите пароль"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    onClick={() => setShowPasswords(p => ({ ...p, new: !p['new'] }))}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
                  >{showPasswords['new'] ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Роль</label>
                <select className="select" value={newForm.role} onChange={e => setN('role', e.target.value)}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createUser} className="btn btn-primary" disabled={saving}>
                {saving ? 'Создание...' : '✅ Создать пользователя'}
              </button>
              <button onClick={() => { setShowNew(false); setError('') }} className="btn btn-secondary">Отмена</button>
            </div>
          </div>
        )}

        {/* Список пользователей */}
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {users.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Нет пользователей</div>
            )}
            {users.map((u, idx) => (
              <div key={u.id}>
                {idx > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}
                {editingId === u.id ? (
                  /* Режим редактирования */
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group">
                        <label className="label">Имя</label>
                        <input className="input" value={editForm.name} onChange={e => setE('name', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="label">Email</label>
                        <input className="input" type="email" value={editForm.email} onChange={e => setE('email', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="label">Новый пароль (оставьте пустым чтобы не менять)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input"
                            type={showPasswords[u.id] ? 'text' : 'password'}
                            value={editForm.password}
                            onChange={e => setE('password', e.target.value)}
                            placeholder="Новый пароль..."
                            style={{ paddingRight: 40 }}
                          />
                          <button
                            onClick={() => setShowPasswords(p => ({ ...p, [u.id]: !p[u.id] }))}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
                          >{showPasswords[u.id] ? '🙈' : '👁'}</button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="label">Роль</label>
                        <select className="select" value={editForm.role} onChange={e => setE('role', e.target.value)}>
                          <option value="employee">Сотрудник</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveEdit(u.id)} className="btn btn-primary" disabled={saving}>
                        {saving ? 'Сохранение...' : '💾 Сохранить'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn btn-secondary">Отмена</button>
                    </div>
                  </div>
                ) : (
                  /* Режим просмотра */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                    </div>
                    <span className="badge" style={{ ...(ROLE_COLORS[u.role] || { bg: '#f3f4f6', color: '#374151' }) }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 80 }}>
                      {new Date(u.createdAt).toLocaleDateString('ru')}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(u)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                        ✏️ Изменить
                      </button>
                      <button onClick={() => deleteUser(u.id, u.name)}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Подсказка */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
          💡 <strong>Роли:</strong> Администратор имеет полный доступ. Сотрудник может просматривать и редактировать дела и клиентов.
          Каждый пользователь входит в систему через страницу входа используя свой email и пароль.
        </div>
      </div>
    </div>
  )
}
