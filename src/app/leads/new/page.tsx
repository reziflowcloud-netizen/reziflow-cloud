'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEAD_SOURCES, LEAD_STATUSES } from '@/lib/leads'

const initialForm = {
  status: 'Новый',
  source: 'manual',
  fullName: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  instagram: '',
  facebook: '',
  city: '',
  country: '',
  language: '',
  serviceInterest: '',
  budget: '',
  urgency: '',
  nextContactAt: '',
  notes: '',
}

export default function NewLeadPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(current => ({ ...current, [key]: event.target.value }))
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить лид')
        return
      }
      router.push(`/leads/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <form onSubmit={save}>
        <div className="page-header">
          <div>
            <div className="page-title">Новый лид</div>
            <div className="page-subtitle">Первичный контакт до перевода в клиента</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Отмена</button>
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Сохраняю...' : 'Сохранить'}</button>
          </div>
        </div>

        <div className="page-body">
          {error && <div className="error-msg">{error}</div>}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>◎</span>Основное</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">Имя лида</label>
                <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="Например: Ivan Ivanov" />
              </div>
              <div className="form-group">
                <label className="label">Интересующая услуга</label>
                <input className="input" value={form.serviceInterest} onChange={set('serviceInterest')} placeholder="Побыт часовый, карта, работа..." />
              </div>
              <div className="form-group">
                <label className="label">Статус</label>
                <select className="select" value={form.status} onChange={set('status')}>
                  {LEAD_STATUSES.map(status => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Источник</label>
                <select className="select" value={form.source} onChange={set('source')}>
                  {LEAD_SOURCES.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>☎</span>Контакты</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="label">Телефон</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
              <div className="form-group"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
              <div className="form-group"><label className="label">Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} placeholder="@username" /></div>
              <div className="form-group"><label className="label">Facebook</label><input className="input" value={form.facebook} onChange={set('facebook')} /></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title"><span>✦</span>Квалификация</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="label">Город</label><input className="input" value={form.city} onChange={set('city')} /></div>
              <div className="form-group"><label className="label">Страна/гражданство</label><input className="input" value={form.country} onChange={set('country')} /></div>
              <div className="form-group"><label className="label">Язык</label><input className="input" value={form.language} onChange={set('language')} /></div>
              <div className="form-group"><label className="label">Бюджет</label><input className="input" value={form.budget} onChange={set('budget')} /></div>
              <div className="form-group"><label className="label">Срочность</label><input className="input" value={form.urgency} onChange={set('urgency')} /></div>
              <div className="form-group"><label className="label">Следующий контакт</label><input className="input" type="datetime-local" value={form.nextContactAt} onChange={set('nextContactAt')} /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="label">Заметки</label><textarea className="input" rows={5} value={form.notes} onChange={set('notes')} /></div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
