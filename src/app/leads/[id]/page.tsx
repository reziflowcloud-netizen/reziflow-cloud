'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, leadDisplayName } from '@/lib/leads'

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [services, setServices] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [leadStatuses, setLeadStatuses] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(data => setServices(Array.isArray(data) ? data.filter((s: any) => s.active) : []))
    fetch('/api/users').then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : []))
    fetch('/api/lead-statuses').then(r => r.json()).then(data => setLeadStatuses(Array.isArray(data) ? data : []))
    fetch(`/api/leads/${id}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setLead(data)
        setForm({
          status: data.status || 'Новый',
          source: data.source || 'manual',
          fullName: data.fullName || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          email: data.email || '',
          instagram: data.instagram || '',
          facebook: data.facebook || '',
          city: data.city || '',
          country: data.country || '',
          language: data.language || '',
          serviceInterest: data.serviceInterest || '',
          budget: data.budget || '',
          urgency: data.urgency || '',
          assignedToId: data.assignedToId ? String(data.assignedToId) : '',
          nextContactAt: data.nextContactAt?.slice(0, 16) || '',
          nextContactNote: data.nextContactNote || '',
          lastContactAt: data.lastContactAt?.slice(0, 16) || '',
          lastContactNote: data.lastContactNote || '',
          notes: data.notes || '',
        })
      })
  }, [id])

  function set(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current: any) => ({ ...current, [key]: event.target.value }))
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить лид')
        return
      }
      setLead(data)
      setForm((current: any) => ({ ...current, assignedToId: data.assignedToId ? String(data.assignedToId) : '' }))
    } finally {
      setSaving(false)
    }
  }

  async function convertToClient() {
    if (!confirm('Перевести этого лида в клиента?')) return
    setConverting(true)
    setError('')
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось перевести лида')
        return
      }
      router.push(`/clients/${data.clientId}`)
    } finally {
      setConverting(false)
    }
  }

  async function deleteLead() {
    if (!confirm('Удалить лид?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Загрузка...</div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/leads')} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <div>
            <div className="page-title">{leadDisplayName(lead)}</div>
            <div className="page-subtitle">{lead.phone || lead.email || lead.instagram || 'Контакт не указан'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
          {lead.convertedClientId ? (
            <Link className="btn btn-secondary" href={`/clients/${lead.convertedClientId}`}>Открыть клиента</Link>
          ) : (
            <button className="btn btn-secondary" onClick={convertToClient} disabled={converting}>
              {converting ? 'Перевожу...' : 'Перевести в клиента'}
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="error-msg">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>◎</span>Воронка</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="label">Статус</label>
                  <select className="select" value={form.status} onChange={set('status')}>
                    {(leadStatuses.length ? leadStatuses : DEFAULT_LEAD_STATUSES).map(status => <option key={status.name}>{status.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Источник</label>
                  <select className="select" value={form.source} onChange={set('source')}>
                    {LEAD_SOURCES.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Ответственный</label>
                  <select className="select" value={form.assignedToId || ''} onChange={set('assignedToId')}>
                    <option value="">— Не назначен —</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Интересующая услуга</label>
                  <select className="select" value={form.serviceInterest || ''} onChange={set('serviceInterest')}>
                    <option value="">— Выберите услугу —</option>
                    {services.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Последний контакт</label>
                  <input className="input" type="datetime-local" value={form.lastContactAt} onChange={set('lastContactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">Следующий контакт</label>
                  <input className="input" type="datetime-local" value={form.nextContactAt} onChange={set('nextContactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">О чем был последний контакт</label>
                  <textarea className="input" rows={3} value={form.lastContactNote || ''} onChange={set('lastContactNote')} placeholder="Например: обсудили документы, клиент попросил перезвонить, отправили условия" />
                </div>
                <div className="form-group">
                  <label className="label">О чем сконтактироваться</label>
                  <textarea className="input" rows={3} value={form.nextContactNote || ''} onChange={set('nextContactNote')} placeholder="Например: уточнить документы, напомнить об оплате, назначить консультацию" />
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>☎</span>Контакты</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="label">Имя</label><input className="input" value={form.firstName || ''} onChange={set('firstName')} /></div>
                <div className="form-group"><label className="label">Фамилия</label><input className="input" value={form.lastName || ''} onChange={set('lastName')} /></div>
                <div className="form-group"><label className="label">Телефон</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
                <div className="form-group"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
                <div className="form-group"><label className="label">Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} /></div>
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
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="label">Заметки</label><textarea className="input" rows={7} value={form.notes} onChange={set('notes')} /></div>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>ⓘ</span>Информация</div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Создан</span><strong>{new Date(lead.createdAt).toLocaleDateString('ru-RU')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Обновлён</span><strong>{new Date(lead.updatedAt).toLocaleDateString('ru-RU')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Ответственный</span><strong>{users.find(user => String(user.id) === String(form.assignedToId))?.name || '—'}</strong></div>
              </div>
            </div>

            <div className="card">
              <div className="section-title"><span>⚠</span>Опасная зона</div>
              <button className="btn btn-danger" onClick={deleteLead} style={{ width: '100%', justifyContent: 'center' }}>Удалить лид</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
