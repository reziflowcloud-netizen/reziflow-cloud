'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', city: '', pesel: '',
    passportSeries: '', passportNumber: '', passportIssuedBy: '',
    passportIssuedAt: '', passportExpiresAt: '',
    addressInPoland: '', stayBasis: '',
    motherMaidenName: '', dependents: '',
    height: '', eyeColor: '', specialSigns: '',
  })

  function set(k: string) {
    return function(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
      setForm(prev => ({ ...prev, [k]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Ошибка')
      else router.push(`/clients/${data.id}`)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Новый клиент</div>
          <div className="page-subtitle">Заполните данные клиента</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">Отмена</button>
          <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : '💾 Сохранить'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="error-msg">{error}</div>}

        {/* Личные данные */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>👤</span>Личные данные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">Имя *</label>
              <input className="input" type="text" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div className="form-group">
              <label className="label">Фамилия *</label>
              <input className="input" type="text" value={form.lastName} onChange={set('lastName')} required />
            </div>
            <div className="form-group">
              <label className="label">Телефон</label>
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="label">Город</label>
              <input className="input" type="text" value={form.city} onChange={set('city')} />
            </div>
            <div className="form-group">
              <label className="label">PESEL</label>
              <input className="input" type="text" value={form.pesel} onChange={set('pesel')} />
            </div>
            <div className="form-group">
              <label className="label">Девичья фамилия матери</label>
              <input className="input" type="text" value={form.motherMaidenName} onChange={set('motherMaidenName')} />
            </div>
            <div className="form-group">
              <label className="label">Иждивенцы</label>
              <textarea className="input" value={form.dependents} onChange={set('dependents')} rows={2} placeholder="Информация об иждивенцах..." />
            </div>
          </div>
        </div>

        {/* Паспортные данные */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>📘</span>Паспортные данные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">Серия</label>
              <input className="input" type="text" value={form.passportSeries} onChange={set('passportSeries')} />
            </div>
            <div className="form-group">
              <label className="label">Номер</label>
              <input className="input" type="text" value={form.passportNumber} onChange={set('passportNumber')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">Выдан</label>
              <input className="input" type="text" value={form.passportIssuedBy} onChange={set('passportIssuedBy')} />
            </div>
            <div className="form-group">
              <label className="label">Дата выдачи</label>
              <input className="input" type="date" value={form.passportIssuedAt} onChange={set('passportIssuedAt')} />
            </div>
            <div className="form-group">
              <label className="label">Действителен до</label>
              <input className="input" type="date" value={form.passportExpiresAt} onChange={set('passportExpiresAt')} />
            </div>
          </div>
        </div>

        {/* Физические характеристики */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>📏</span>Физические характеристики</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">Рост (см)</label>
              <input className="input" type="number" value={form.height} onChange={set('height')} />
            </div>
            <div className="form-group">
              <label className="label">Цвет глаз</label>
              <select className="select" value={form.eyeColor} onChange={set('eyeColor')}>
                <option value="">Выберите</option>
                <option>Карие</option>
                <option>Зелёные</option>
                <option>Голубые</option>
                <option>Серые</option>
                <option>Чёрные</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">Особые приметы</label>
              <textarea className="input" value={form.specialSigns} onChange={set('specialSigns')} rows={2} />
            </div>
          </div>
        </div>

        {/* Пребывание в Польше */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><span>🏠</span>Пребывание в Польше</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">Адрес в Польше</label>
              <input className="input" type="text" value={form.addressInPoland} onChange={set('addressInPoland')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="label">Основание пребывания</label>
              <select className="select" value={form.stayBasis} onChange={set('stayBasis')}>
                <option value="">Выберите</option>
                <option>Трудоустройство</option>
                <option>Воссоединение семьи</option>
                <option>Обучение</option>
                <option>Бизнес</option>
                <option>Временная защита</option>
                <option>Другое</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
