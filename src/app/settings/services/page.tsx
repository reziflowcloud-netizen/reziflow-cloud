'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Service {
  id: number
  name: string
  description: string | null
  price: number | null
  color: string
  active: boolean
  createdAt: string
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [form, setForm] = useState({ name: '', description: '', price: '', color: '#3b82f6' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => setServices(Array.isArray(d) ? d : []))
  }, [])

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function setE(k: string, v: string) { setEditForm((p: any) => ({ ...p, [k]: v })) }

  async function add() {
    if (!form.name.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      let data: any
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        setError(data?.error || `Ошибка сервера: ${res.status}`)
        return
      }
      setServices(prev => [...prev, data])
      setForm({ name: '', description: '', price: '', color: '#3b82f6' })
    } catch {
      setError('Ошибка соединения с сервером. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  async function save(id: number) {
    setError('')
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      let data: any
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        setError(data?.error || 'Ошибка при обновлении услуги')
        return
      }
      setServices(prev => prev.map(s => s.id === id ? data : s))
      setEditingId(null)
    } catch {
      setError('Ошибка соединения с сервером.')
    }
  }

  async function remove(id: number) {
    if (!confirm('Удалить услугу? Дела с этой услугой останутся, но связь будет удалена.')) return
    setError('')
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE' })
      setServices(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Ошибка при удалении.')
    }
  }

  async function toggleActive(s: Service, active: boolean) {
    try {
      const res = await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, active }),
      })
      if (res.ok) {
        setServices(prev => prev.map(x => x.id === s.id ? { ...x, active } : x))
      }
    } catch { /* silent */ }
  }

  function startEdit(s: Service) {
    setEditingId(s.id)
    setEditForm({ name: s.name, description: s.description || '', price: s.price?.toString() || '0', color: s.color, active: s.active })
    setError('')
  }

  const active = services.filter(s => s.active)
  const inactive = services.filter(s => !s.active)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Услуги</div>
          <div className="page-subtitle">Услуги которые вы предоставляете клиентам</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">Назад</Link>
      </div>

      <div className="page-body">
        {/* Add form */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title"><span>➕</span>Добавить услугу</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Название услуги *</label>
              <input className="input" value={form.name}
                onChange={e => { setF('name', e.target.value); setError('') }}
                placeholder="Напр.: Побыт часовы"
                onKeyDown={e => e.key === 'Enter' && add()} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Описание</label>
              <input className="input" value={form.description}
                onChange={e => setF('description', e.target.value)}
                placeholder="Краткое описание..." />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Базовая цена (zł)</label>
              <input className="input" type="number" value={form.price}
                onChange={e => setF('price', e.target.value)}
                placeholder="0" step="50" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">Цвет</label>
              <input type="color" value={form.color}
                onChange={e => setF('color', e.target.value)}
                style={{ height: 38, width: 52, padding: 3, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
            </div>
            <button onClick={add} className="btn btn-primary"
              disabled={loading || !form.name.trim()} style={{ marginBottom: 0 }}>
              {loading ? 'Добавление...' : '+ Добавить'}
            </button>
          </div>
          {error && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, color: '#dc2626', fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Active services */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Активные услуги — {active.length}</div>

          {active.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>Нет услуг. Добавьте первую!</div>
          )}

          {active.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < active.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {editingId === s.id ? (
                <>
                  <input type="color" value={editForm.color}
                    onChange={e => setE('color', e.target.value)}
                    style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                  <input className="input" value={editForm.name} onChange={e => setE('name', e.target.value)}
                    style={{ flex: 2 }} autoFocus placeholder="Название" />
                  <input className="input" value={editForm.description} onChange={e => setE('description', e.target.value)}
                    style={{ flex: 2 }} placeholder="Описание" />
                  <input className="input" type="number" value={editForm.price} onChange={e => setE('price', e.target.value)}
                    style={{ width: 100 }} placeholder="Цена" />
                  <button onClick={() => save(s.id)} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>💾</button>
                  <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>✕</button>
                </>
              ) : (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <div style={{ flex: 2 }}>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.description}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {s.price ? (
                      <span className="badge" style={{ background: '#dcfce7', color: '#14532d' }}>{s.price.toFixed(0)} zł</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Цена не задана</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(s)}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button onClick={() => toggleActive(s, false)}
                      style={{ background: '#fef3c7', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#92400e' }}
                      title="Деактивировать">⏸</button>
                    <button onClick={() => remove(s.id)}
                      style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>🗑</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Inactive */}
        {inactive.length > 0 && (
          <div className="card">
            <div className="section-title" style={{ color: 'var(--muted)' }}>Неактивные услуги — {inactive.length}</div>
            {inactive.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', opacity: 0.6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#d1d5db' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, textDecoration: 'line-through' }}>{s.name}</div>
                </div>
                <button onClick={() => toggleActive(s, true)} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Восстановить
                </button>
                <button onClick={() => remove(s.id)}
                  style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
