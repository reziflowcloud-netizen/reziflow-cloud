'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES, POLISH_VOIVODESHIPS } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'
import { leadSourceLabel, leadStatusLabel, leadTemperatureLabel, leadText } from '@/lib/leadI18n'
import PhoneListEditor, { ensurePhoneRows } from '@/components/PhoneListEditor'

const initialForm = {
  status: 'Новый',
  source: 'manual',
  fullName: '',
  firstName: '',
  lastName: '',
  phone: '',
  phones: ensurePhoneRows([], ''),
  email: '',
  instagram: '',
  facebook: '',
  city: '',
  voivodeship: '',
  country: '',
  language: '',
  serviceInterest: '',
  budget: '',
  urgency: '',
  deadlineAt: '',
  assignedToId: '',
  nextContactAt: '',
  nextContactNote: '',
  notes: '',
}

export default function NewLeadPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const lt = (key: string) => leadText(lang, key)
  const [form, setForm] = useState(initialForm)
  const [services, setServices] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [leadStatuses, setLeadStatuses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(data => setServices(Array.isArray(data) ? data.filter((s: any) => s.active) : []))
    fetch('/api/users').then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : []))
    fetch('/api/lead-statuses').then(r => r.json()).then(data => {
      const statuses = Array.isArray(data) ? data : []
      setLeadStatuses(statuses)
      if (statuses[0]?.name) setForm(current => ({ ...current, status: statuses[0].name }))
    })
  }, [])

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
        setError(data.error || lt('save_failed'))
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
            <div className="page-title">{lt('new_lead')}</div>
            <div className="page-subtitle">{lt('new_lead_subtitle')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard" className="btn btn-secondary">{lt('dashboard')}</Link>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>{lt('cancel')}</button>
            <button className="btn btn-primary" disabled={loading}>{loading ? lt('saving') : lt('save')}</button>
          </div>
        </div>

        <div className="page-body">
          {error && <div className="error-msg">{error}</div>}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>◎</span>{lt('main')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">{lt('first_name')}</label>
                <input className="input" value={form.firstName} onChange={set('firstName')} placeholder={lt('first_name_placeholder')} />
              </div>
              <div className="form-group">
                <label className="label">{lt('last_name')}</label>
                <input className="input" value={form.lastName} onChange={set('lastName')} placeholder={lt('last_name_placeholder')} />
              </div>
              <div className="form-group">
                <label className="label">{lt('interested_service')}</label>
                <select className="select" value={form.serviceInterest} onChange={set('serviceInterest')}>
                  <option value="">{lt('choose_service')}</option>
                  {services.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">{lt('status')}</label>
                <select className="select" value={form.status} onChange={set('status')}>
                  {(leadStatuses.length ? leadStatuses : DEFAULT_LEAD_STATUSES).map(status => <option key={status.name} value={status.name}>{leadStatusLabel(lang, status.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">{lt('source')}</label>
                <select className="select" value={form.source} onChange={set('source')}>
                  {LEAD_SOURCES.map(source => <option key={source.value} value={source.value}>{leadSourceLabel(lang, source.value)}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">{lt('responsible')}</label>
                <select className="select" value={form.assignedToId} onChange={set('assignedToId')}>
                  <option value="">{lt('not_assigned')}</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>☎</span>{lt('contacts')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">{lt('phone')}</label>
                <PhoneListEditor
                  phones={form.phones}
                  onChange={phones => {
                    const primary = phones.find(item => item.isPrimary)?.phone || phones[0]?.phone || ''
                    setForm(current => ({ ...current, phones, phone: primary }))
                  }}
                />
              </div>
              <div className="form-group"><label className="label">{lt('email')}</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
              <div className="form-group"><label className="label">Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} placeholder="@username" /></div>
              <div className="form-group"><label className="label">Facebook</label><input className="input" value={form.facebook} onChange={set('facebook')} /></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title"><span>✦</span>{lt('qualification')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="label">{lt('city')}</label><input className="input" value={form.city} onChange={set('city')} /></div>
              <div className="form-group">
                <label className="label">{lt('voivodeship')}</label>
                <select className="select" value={form.voivodeship} onChange={set('voivodeship')}>
                  <option value="">{lt('no_value')}</option>
                  {POLISH_VOIVODESHIPS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="label">{lt('country')}</label><input className="input" value={form.country} onChange={set('country')} /></div>
              <div className="form-group"><label className="label">{lt('language')}</label><input className="input" value={form.language} onChange={set('language')} /></div>
              <div className="form-group"><label className="label">{lt('budget')}</label><input className="input" value={form.budget} onChange={set('budget')} /></div>
              <div className="form-group">
                <label className="label">{lt('urgency')}</label>
                <select className="select" value={form.urgency} onChange={set('urgency')}>
                  <option value="">{lt('temperature_empty')}</option>
                  {LEAD_TEMPERATURES.map(item => <option key={item.value} value={item.value}>{leadTemperatureLabel(lang, item.value)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">{lt('deadline_at')}</label>
                <input className="input" type="date" value={form.deadlineAt} onChange={set('deadlineAt')} title={lt('deadline_hint')} />
              </div>
              <div className="form-group"><label className="label">{lt('next_contact')}</label><input className="input" type="datetime-local" value={form.nextContactAt} onChange={set('nextContactAt')} /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">{lt('next_contact_about')}</label>
                <textarea className="input" rows={3} value={form.nextContactNote} onChange={set('nextContactNote')} placeholder={lt('next_contact_note_placeholder')} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="label">{lt('notes')}</label><textarea className="input" rows={5} value={form.notes} onChange={set('notes')} /></div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
