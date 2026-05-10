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
  const [contactHistory, setContactHistory] = useState<any[]>([])
  const [contactForm, setContactForm] = useState({
    contactAt: '',
    note: '',
    nextContactAt: '',
    nextContactNote: '',
  })
  const [showConvert, setShowConvert] = useState(false)
  const [convertForm, setConvertForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    country: '',
    createCase: true,
    serviceId: '',
    totalValue: '',
    assignedToId: '',
    caseNotes: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(data => setServices(Array.isArray(data) ? data.filter((s: any) => s.active) : []))
    fetch('/api/users').then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : []))
    fetch('/api/lead-statuses').then(r => r.json()).then(data => setLeadStatuses(Array.isArray(data) ? data : []))
    loadContactHistory()
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
        setConvertForm(current => ({
          ...current,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          email: data.email || '',
          city: data.city || '',
          country: data.country || '',
          totalValue: data.budget || '',
          assignedToId: data.assignedToId ? String(data.assignedToId) : '',
          caseNotes: data.notes || '',
        }))
      })
  }, [id])

  useEffect(() => {
    if (!services.length || !lead?.serviceInterest || convertForm.serviceId) return
    const service = services.find(item => item.name === lead.serviceInterest)
    if (service) setConvertForm(current => ({ ...current, serviceId: String(service.id) }))
  }, [services, lead?.serviceInterest, convertForm.serviceId])

  async function loadContactHistory() {
    const data = await fetch(`/api/leads/${id}/contacts`, { cache: 'no-store' }).then(r => r.json())
    setContactHistory(Array.isArray(data) ? data : [])
  }

  function set(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current: any) => ({ ...current, [key]: event.target.value }))
    }
  }

  function setContact(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setContactForm(current => ({ ...current, [key]: event.target.value }))
    }
  }

  function setConvert(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target instanceof HTMLInputElement && event.target.type === 'checkbox' ? event.target.checked : event.target.value
      setConvertForm(current => ({ ...current, [key]: value }))
    }
  }

  function toDateTimeLocal(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
  }

  async function addContactHistory() {
    if (!contactForm.note.trim()) return
    setSavingContact(true)
    setError('')
    try {
      const res = await fetch(`/api/leads/${id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactAt: contactForm.contactAt || new Date().toISOString(),
          note: contactForm.note,
          nextContactAt: contactForm.nextContactAt,
          nextContactNote: contactForm.nextContactNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось добавить контакт')
        return
      }
      setContactHistory(current => [data, ...current])
      setForm((current: any) => ({
        ...current,
        lastContactAt: toDateTimeLocal(data.contactAt),
        lastContactNote: data.note || '',
        nextContactAt: data.nextContactAt ? toDateTimeLocal(data.nextContactAt) : '',
        nextContactNote: data.nextContactNote || '',
      }))
      setContactForm({ contactAt: '', note: '', nextContactAt: '', nextContactNote: '' })
    } finally {
      setSavingContact(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    const previousStatus = lead?.status
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
      if (form.status && form.status !== previousStatus) {
        loadContactHistory()
      }
    } finally {
      setSaving(false)
    }
  }

  function openConvertModal() {
    const service = services.find(item => item.name === form.serviceInterest)
    setConvertForm(current => ({
      ...current,
      serviceId: current.serviceId || (service ? String(service.id) : ''),
      totalValue: current.totalValue || form.budget || '',
      assignedToId: current.assignedToId || form.assignedToId || '',
    }))
    setShowConvert(true)
  }

  async function convertToClient() {
    setConverting(true)
    setError('')
    try {
      const res = await fetch(`/api/leads/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось перевести лида')
        return
      }
      router.push(data.caseId ? `/cases/${data.caseId}` : `/clients/${data.clientId}`)
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
            <button className="btn btn-secondary" onClick={openConvertModal} disabled={converting}>
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

            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><span>◷</span>История контактов</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="label">Дата контакта</label>
                  <input className="input" type="datetime-local" value={contactForm.contactAt} onChange={setContact('contactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">Следующий контакт</label>
                  <input className="input" type="datetime-local" value={contactForm.nextContactAt} onChange={setContact('nextContactAt')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="label">О чем был контакт</label>
                  <textarea className="input" rows={3} value={contactForm.note} onChange={setContact('note')} placeholder="Что обсудили, что клиент ответил, о чем договорились" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="label">О чем сконтактироваться дальше</label>
                  <textarea className="input" rows={3} value={contactForm.nextContactNote} onChange={setContact('nextContactNote')} placeholder="Что обсудить при следующем контакте" />
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addContactHistory} disabled={savingContact || !contactForm.note.trim()}>
                    {savingContact ? 'Сохраняю...' : '+ Добавить запись'}
                  </button>
                </div>
              </div>

              {contactHistory.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>Истории контактов пока нет</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {contactHistory.map(item => (
                    <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                        <strong>{new Date(item.contactAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.author?.name || '—'}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{item.note}</div>
                      {(item.nextContactAt || item.nextContactNote) && (
                        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, color: 'var(--muted)', fontSize: 12 }}>
                          {item.nextContactAt && <div><strong>Следующий контакт:</strong> {new Date(item.nextContactAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                          {item.nextContactNote && <div style={{ marginTop: 4 }}>{item.nextContactNote}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
      {showConvert && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
          onClick={() => setShowConvert(false)}
        >
          <div className="card" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto' }} onClick={event => event.stopPropagation()}>
            <div className="section-title"><span>→</span>Перевод лида в клиента</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="label">Имя</label><input className="input" value={convertForm.firstName} onChange={setConvert('firstName')} /></div>
              <div className="form-group"><label className="label">Фамилия</label><input className="input" value={convertForm.lastName} onChange={setConvert('lastName')} /></div>
              <div className="form-group"><label className="label">Телефон</label><input className="input" value={convertForm.phone} onChange={setConvert('phone')} /></div>
              <div className="form-group"><label className="label">Email</label><input className="input" value={convertForm.email} onChange={setConvert('email')} /></div>
              <div className="form-group"><label className="label">Город</label><input className="input" value={convertForm.city} onChange={setConvert('city')} /></div>
              <div className="form-group"><label className="label">Страна/гражданство</label><input className="input" value={convertForm.country} onChange={setConvert('country')} /></div>
              <label style={{ gridColumn: '1/-1', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginTop: 4 }}>
                <input type="checkbox" checked={convertForm.createCase} onChange={setConvert('createCase')} />
                Создать дело сразу после создания клиента
              </label>
              {convertForm.createCase && (
                <>
                  <div className="form-group">
                    <label className="label">Услуга</label>
                    <select className="select" value={convertForm.serviceId} onChange={setConvert('serviceId')}>
                      <option value="">— Выберите услугу —</option>
                      {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="label">Стоимость</label><input className="input" type="number" step="0.01" value={convertForm.totalValue} onChange={setConvert('totalValue')} /></div>
                  <div className="form-group">
                    <label className="label">Ответственный</label>
                    <select className="select" value={convertForm.assignedToId} onChange={setConvert('assignedToId')}>
                      <option value="">— Не назначен —</option>
                      {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="label">Заметка к делу</label>
                    <textarea className="input" rows={3} value={convertForm.caseNotes} onChange={setConvert('caseNotes')} />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConvert(false)}>Отмена</button>
              <button type="button" className="btn btn-primary" onClick={convertToClient} disabled={converting || !convertForm.firstName.trim()}>
                {converting ? 'Перевожу...' : 'Перевести'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
