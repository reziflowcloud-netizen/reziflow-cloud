'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

interface Service {
  id: number
  name: string
  description: string | null
  price: number | null
  color: string
  active: boolean
  createdAt: string
}

const serviceText = {
  ru: {
    serverError: 'Ошибка сервера: {status}',
    connectionError: 'Ошибка соединения с сервером. Попробуйте ещё раз.',
    updateError: 'Ошибка при обновлении услуги',
    connectionShort: 'Ошибка соединения с сервером.',
    deleteConfirm: 'Удалить услугу? Дела с этой услугой останутся, но связь будет удалена.',
    deleteError: 'Ошибка при удалении.',
    addTitle: 'Добавить услугу',
    serviceName: 'Название услуги *',
    namePlaceholder: 'Напр.: Побыт часовы',
    description: 'Описание',
    descriptionPlaceholder: 'Краткое описание...',
    basePrice: 'Базовая цена (zł)',
    color: 'Цвет',
    adding: 'Добавление...',
    add: '+ Добавить',
    activeTitle: 'Активные услуги — {count}',
    emptyActive: 'Нет услуг. Добавьте первую!',
    name: 'Название',
    price: 'Цена',
    priceNotSet: 'Цена не задана',
    deactivate: 'Деактивировать',
    inactiveTitle: 'Неактивные услуги — {count}',
    restore: 'Восстановить',
  },
  uk: {
    serverError: 'Помилка сервера: {status}',
    connectionError: 'Помилка з’єднання з сервером. Спробуйте ще раз.',
    updateError: 'Помилка під час оновлення послуги',
    connectionShort: 'Помилка з’єднання з сервером.',
    deleteConfirm: 'Видалити послугу? Справи з цією послугою залишаться, але зв’язок буде видалено.',
    deleteError: 'Помилка під час видалення.',
    addTitle: 'Додати послугу',
    serviceName: 'Назва послуги *',
    namePlaceholder: 'Напр.: Часове перебування',
    description: 'Опис',
    descriptionPlaceholder: 'Короткий опис...',
    basePrice: 'Базова ціна (zł)',
    color: 'Колір',
    adding: 'Додавання...',
    add: '+ Додати',
    activeTitle: 'Активні послуги — {count}',
    emptyActive: 'Послуг немає. Додайте першу!',
    name: 'Назва',
    price: 'Ціна',
    priceNotSet: 'Ціну не задано',
    deactivate: 'Деактивувати',
    inactiveTitle: 'Неактивні послуги — {count}',
    restore: 'Відновити',
  },
  pl: {
    serverError: 'Błąd serwera: {status}',
    connectionError: 'Błąd połączenia z serwerem. Spróbuj ponownie.',
    updateError: 'Błąd podczas aktualizacji usługi',
    connectionShort: 'Błąd połączenia z serwerem.',
    deleteConfirm: 'Usunąć usługę? Sprawy z tą usługą zostaną, ale powiązanie zostanie usunięte.',
    deleteError: 'Błąd podczas usuwania.',
    addTitle: 'Dodaj usługę',
    serviceName: 'Nazwa usługi *',
    namePlaceholder: 'Np.: Pobyt czasowy',
    description: 'Opis',
    descriptionPlaceholder: 'Krótki opis...',
    basePrice: 'Cena bazowa (zł)',
    color: 'Kolor',
    adding: 'Dodawanie...',
    add: '+ Dodaj',
    activeTitle: 'Aktywne usługi — {count}',
    emptyActive: 'Brak usług. Dodaj pierwszą!',
    name: 'Nazwa',
    price: 'Cena',
    priceNotSet: 'Cena nie ustawiona',
    deactivate: 'Dezaktywuj',
    inactiveTitle: 'Nieaktywne usługi — {count}',
    restore: 'Przywróć',
  },
}

export default function ServicesPage() {
  const { lang, t } = useLanguage()
  const text = serviceText[lang] || serviceText.ru
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
        setError(data?.error || text.serverError.replace('{status}', String(res.status)))
        return
      }
      setServices(prev => [...prev, data])
      setForm({ name: '', description: '', price: '', color: '#3b82f6' })
    } catch {
      setError(text.connectionError)
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
        setError(data?.error || text.updateError)
        return
      }
      setServices(prev => prev.map(s => s.id === id ? data : s))
      setEditingId(null)
    } catch {
      setError(text.connectionShort)
    }
  }

  async function remove(id: number) {
    if (!confirm(text.deleteConfirm)) return
    setError('')
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE' })
      setServices(prev => prev.filter(s => s.id !== id))
    } catch {
      setError(text.deleteError)
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
          <div className="page-title">{t('services_title')}</div>
          <div className="page-subtitle">{t('services_sub')}</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
      </div>

      <div className="page-body">
        {/* Add form */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title"><span>➕</span>{text.addTitle}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">{text.serviceName}</label>
              <input className="input" value={form.name}
                onChange={e => { setF('name', e.target.value); setError('') }}
                placeholder={text.namePlaceholder}
                onKeyDown={e => e.key === 'Enter' && add()} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">{text.description}</label>
              <input className="input" value={form.description}
                onChange={e => setF('description', e.target.value)}
                placeholder={text.descriptionPlaceholder} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">{text.basePrice}</label>
              <input className="input" type="number" value={form.price}
                onChange={e => setF('price', e.target.value)}
                placeholder="0" step="50" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="label">{text.color}</label>
              <input type="color" value={form.color}
                onChange={e => setF('color', e.target.value)}
                style={{ height: 38, width: 52, padding: 3, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
            </div>
            <button onClick={add} className="btn btn-primary"
              disabled={loading || !form.name.trim()} style={{ marginBottom: 0 }}>
              {loading ? text.adding : text.add}
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
          <div className="section-title">{text.activeTitle.replace('{count}', String(active.length))}</div>

          {active.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>{text.emptyActive}</div>
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
                    style={{ flex: 2 }} autoFocus placeholder={text.name} />
                  <input className="input" value={editForm.description} onChange={e => setE('description', e.target.value)}
                    style={{ flex: 2 }} placeholder={text.description} />
                  <input className="input" type="number" value={editForm.price} onChange={e => setE('price', e.target.value)}
                    style={{ width: 100 }} placeholder={text.price} />
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
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{text.priceNotSet}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(s)}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button onClick={() => toggleActive(s, false)}
                      style={{ background: '#fef3c7', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#92400e' }}
                      title={text.deactivate}>⏸</button>
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
            <div className="section-title" style={{ color: 'var(--muted)' }}>{text.inactiveTitle.replace('{count}', String(inactive.length))}</div>
            {inactive.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', opacity: 0.6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#d1d5db' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, textDecoration: 'line-through' }}>{s.name}</div>
                </div>
                <button onClick={() => toggleActive(s, true)} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                  {text.restore}
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
