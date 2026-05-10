'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, leadDisplayName } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'
import { LEAD_LOCALES, leadSourceLabel, leadStatusLabel, leadText } from '@/lib/leadI18n'

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { lang } = useLanguage()
  const locale = LEAD_LOCALES[lang] || 'ru-RU'
  const lt = (key: string) => leadText(lang, key)
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
  const [quickNote, setQuickNote] = useState('')
  const [quickNextContactAt, setQuickNextContactAt] = useState('')
  const [quickNextContactNote, setQuickNextContactNote] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
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

  const activityItems = useMemo(() => {
    const items = [
      ...contactHistory.map(item => ({ ...item, kind: 'history' })),
      ...(lead?.createdAt ? [{
        id: 'created',
        kind: 'created',
        contactAt: lead.createdAt,
        note: lt('lead_created'),
        author: null,
      }] : []),
    ]
    return items.sort((a, b) => new Date(b.contactAt).getTime() - new Date(a.contactAt).getTime())
  }, [contactHistory, lead?.createdAt, lang])

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

  async function recordQuickContact(actionKey: string) {
    setQuickSaving(true)
    setError('')
    const baseNote = lt(actionKey)
    const note = [baseNote, quickNote.trim()].filter(Boolean).join(': ')
    try {
      const res = await fetch(`/api/leads/${id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactAt: new Date().toISOString(),
          note,
          nextContactAt: quickNextContactAt,
          nextContactNote: quickNextContactNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || lt('save_failed'))
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
      setQuickNote('')
      setQuickNextContactAt('')
      setQuickNextContactNote('')
    } finally {
      setQuickSaving(false)
    }
  }

  async function scheduleQuickContact() {
    if (!quickNextContactAt && !quickNextContactNote.trim()) return
    setQuickSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nextContactAt: quickNextContactAt,
          nextContactNote: quickNextContactNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || lt('save_failed'))
        return
      }
      setLead(data)
      setForm((current: any) => ({
        ...current,
        nextContactAt: data.nextContactAt ? toDateTimeLocal(data.nextContactAt) : '',
        nextContactNote: data.nextContactNote || '',
      }))
      setQuickNextContactAt('')
      setQuickNextContactNote('')
      await loadContactHistory()
    } finally {
      setQuickSaving(false)
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
        setError(data.error || lt('save_failed'))
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
        setError(data.error || lt('convert_failed'))
        return
      }
      router.push(data.caseId ? `/cases/${data.caseId}` : `/clients/${data.clientId}`)
    } finally {
      setConverting(false)
    }
  }

  async function deleteLead() {
    if (!confirm(lt('delete_confirm'))) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{lt('loading')}</div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/leads')} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <div>
            <div className="page-title">{leadDisplayName(lead)}</div>
            <div className="page-subtitle">{lead.phone || lead.email || lead.instagram || lt('contact_not_set')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard" className="btn btn-secondary">{lt('dashboard')}</Link>
          {lead.convertedClientId ? (
            <Link className="btn btn-secondary" href={`/clients/${lead.convertedClientId}`}>{lt('open_client')}</Link>
          ) : (
            <button className="btn btn-secondary" onClick={openConvertModal} disabled={converting}>
              {converting ? lt('converting') : lt('convert_to_client')}
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? lt('saving') : lt('save')}</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="error-msg">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>◎</span>{lt('funnel')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <div className="form-group">
                  <label className="label">{lt('responsible')}</label>
                  <select className="select" value={form.assignedToId || ''} onChange={set('assignedToId')}>
                    <option value="">{lt('not_assigned')}</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">{lt('interested_service')}</label>
                  <select className="select" value={form.serviceInterest || ''} onChange={set('serviceInterest')}>
                    <option value="">{lt('choose_service')}</option>
                    {services.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">{lt('last_contact')}</label>
                  <input className="input" type="datetime-local" value={form.lastContactAt} onChange={set('lastContactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('next_contact')}</label>
                  <input className="input" type="datetime-local" value={form.nextContactAt} onChange={set('nextContactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('last_contact_about')}</label>
                  <textarea className="input" rows={3} value={form.lastContactNote || ''} onChange={set('lastContactNote')} placeholder={lt('last_contact_note_placeholder')} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('next_contact_about')}</label>
                  <textarea className="input" rows={3} value={form.nextContactNote || ''} onChange={set('nextContactNote')} placeholder={lt('next_contact_note_placeholder')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>☎</span>{lt('contacts')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="label">{lt('first_name')}</label><input className="input" value={form.firstName || ''} onChange={set('firstName')} /></div>
                <div className="form-group"><label className="label">{lt('last_name')}</label><input className="input" value={form.lastName || ''} onChange={set('lastName')} /></div>
                <div className="form-group"><label className="label">{lt('phone')}</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
                <div className="form-group"><label className="label">{lt('email')}</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
                <div className="form-group"><label className="label">Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} /></div>
                <div className="form-group"><label className="label">Facebook</label><input className="input" value={form.facebook} onChange={set('facebook')} /></div>
              </div>
            </div>

            <div className="card">
              <div className="section-title"><span>✦</span>{lt('qualification')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="label">{lt('city')}</label><input className="input" value={form.city} onChange={set('city')} /></div>
                <div className="form-group"><label className="label">{lt('country')}</label><input className="input" value={form.country} onChange={set('country')} /></div>
                <div className="form-group"><label className="label">{lt('language')}</label><input className="input" value={form.language} onChange={set('language')} /></div>
                <div className="form-group"><label className="label">{lt('budget')}</label><input className="input" value={form.budget} onChange={set('budget')} /></div>
                <div className="form-group"><label className="label">{lt('urgency')}</label><input className="input" value={form.urgency} onChange={set('urgency')} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="label">{lt('notes')}</label><textarea className="input" rows={7} value={form.notes} onChange={set('notes')} /></div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><span>◷</span>{lt('activity')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="label">{lt('last_contact_date')}</label>
                  <input className="input" type="datetime-local" value={contactForm.contactAt} onChange={setContact('contactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('next_contact')}</label>
                  <input className="input" type="datetime-local" value={contactForm.nextContactAt} onChange={setContact('nextContactAt')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="label">{lt('last_contact_note')}</label>
                  <textarea className="input" rows={3} value={contactForm.note} onChange={setContact('note')} placeholder={lt('last_contact_note_placeholder')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="label">{lt('next_contact_note')}</label>
                  <textarea className="input" rows={3} value={contactForm.nextContactNote} onChange={setContact('nextContactNote')} placeholder={lt('next_contact_note_placeholder')} />
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addContactHistory} disabled={savingContact || !contactForm.note.trim()}>
                    {savingContact ? lt('saving') : lt('add_record')}
                  </button>
                </div>
              </div>

              {activityItems.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>{lt('no_contact_history')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {activityItems.map(item => (
                    <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                        <strong>{new Date(item.contactAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.author?.name || (item.kind === 'created' ? lt('lead') : lt('no_value'))}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{item.note}</div>
                      {(item.nextContactAt || item.nextContactNote) && (
                        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, color: 'var(--muted)', fontSize: 12 }}>
                          {item.nextContactAt && <div><strong>{lt('next_contact')}:</strong> {new Date(item.nextContactAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
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
              <div className="section-title"><span>⚡</span>{lt('quick_actions')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => recordQuickContact('quick_called')} disabled={quickSaving}>{lt('quick_called')}</button>
                <button type="button" className="btn btn-secondary" onClick={() => recordQuickContact('quick_wrote')} disabled={quickSaving}>{lt('quick_wrote')}</button>
                <button type="button" className="btn btn-secondary" onClick={() => recordQuickContact('quick_no_answer')} disabled={quickSaving}>{lt('quick_no_answer')}</button>
              </div>
              <div className="form-group">
                <label className="label">{lt('quick_contact_note')}</label>
                <textarea className="input" rows={3} value={quickNote} onChange={event => setQuickNote(event.target.value)} placeholder={lt('quick_note_placeholder')} />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                <div className="section-title" style={{ marginBottom: 10 }}><span>◷</span>{lt('schedule_next_contact')}</div>
                <div className="form-group">
                  <label className="label">{lt('next_contact')}</label>
                  <input className="input" type="datetime-local" value={quickNextContactAt} onChange={event => setQuickNextContactAt(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('next_contact_note')}</label>
                  <textarea className="input" rows={3} value={quickNextContactNote} onChange={event => setQuickNextContactNote(event.target.value)} placeholder={lt('next_contact_note_placeholder')} />
                </div>
                <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={scheduleQuickContact} disabled={quickSaving || (!quickNextContactAt && !quickNextContactNote.trim())}>
                  {quickSaving ? lt('saving') : lt('quick_schedule')}
                </button>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>ⓘ</span>{lt('info')}</div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>{lt('created')}</span><strong>{new Date(lead.createdAt).toLocaleDateString(locale)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>{lt('updated')}</span><strong>{new Date(lead.updatedAt).toLocaleDateString(locale)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>{lt('responsible')}</span><strong>{users.find(user => String(user.id) === String(form.assignedToId))?.name || lt('no_value')}</strong></div>
              </div>
            </div>

            <div className="card">
              <div className="section-title"><span>⚠</span>{lt('danger_zone')}</div>
              <button className="btn btn-danger" onClick={deleteLead} style={{ width: '100%', justifyContent: 'center' }}>{lt('delete_lead')}</button>
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
            <div className="section-title"><span>→</span>{lt('convert_title')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="label">{lt('first_name')}</label><input className="input" value={convertForm.firstName} onChange={setConvert('firstName')} /></div>
              <div className="form-group"><label className="label">{lt('last_name')}</label><input className="input" value={convertForm.lastName} onChange={setConvert('lastName')} /></div>
              <div className="form-group"><label className="label">{lt('phone')}</label><input className="input" value={convertForm.phone} onChange={setConvert('phone')} /></div>
              <div className="form-group"><label className="label">{lt('email')}</label><input className="input" value={convertForm.email} onChange={setConvert('email')} /></div>
              <div className="form-group"><label className="label">{lt('city')}</label><input className="input" value={convertForm.city} onChange={setConvert('city')} /></div>
              <div className="form-group"><label className="label">{lt('country')}</label><input className="input" value={convertForm.country} onChange={setConvert('country')} /></div>
              <label style={{ gridColumn: '1/-1', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginTop: 4 }}>
                <input type="checkbox" checked={convertForm.createCase} onChange={setConvert('createCase')} />
                {lt('create_case_after_client')}
              </label>
              {convertForm.createCase && (
                <>
                  <div className="form-group">
                    <label className="label">{lt('service')}</label>
                    <select className="select" value={convertForm.serviceId} onChange={setConvert('serviceId')}>
                      <option value="">{lt('choose_service')}</option>
                      {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="label">{lt('cost')}</label><input className="input" type="number" step="0.01" value={convertForm.totalValue} onChange={setConvert('totalValue')} /></div>
                  <div className="form-group">
                    <label className="label">{lt('responsible')}</label>
                    <select className="select" value={convertForm.assignedToId} onChange={setConvert('assignedToId')}>
                      <option value="">{lt('not_assigned')}</option>
                      {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="label">{lt('case_note')}</label>
                    <textarea className="input" rows={3} value={convertForm.caseNotes} onChange={setConvert('caseNotes')} />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConvert(false)}>{lt('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={convertToClient} disabled={converting || !convertForm.firstName.trim()}>
                {converting ? lt('converting') : lt('convert')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
