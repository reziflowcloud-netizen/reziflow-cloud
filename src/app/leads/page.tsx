'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES, leadDisplayName } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'
import { LEAD_LOCALES, LEAD_WEEKDAYS, leadSourceLabel, leadStatusLabel, leadTemperatureLabel, leadText } from '@/lib/leadI18n'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Новый': { bg: '#eff6ff', color: '#1d4ed8' },
  'Первый контакт': { bg: '#e0f2fe', color: '#0369a1' },
  'Квалификация': { bg: '#fef3c7', color: '#92400e' },
  'Прогрев': { bg: '#ede9fe', color: '#5b21b6' },
  'Готов к сделке': { bg: '#dcfce7', color: '#166534' },
  'Не подходит': { bg: '#fef2f2', color: '#991b1b' },
  'Переведён в клиента': { bg: '#f3f4f6', color: '#374151' },
}

type QuickFilter = 'all' | 'today' | 'overdue' | 'unassigned' | 'no_next_contact'

function temperatureMeta(value?: string) {
  return LEAD_TEMPERATURES.find(item => item.value === value)
}

function initials(lead: any) {
  return leadDisplayName(lead).slice(0, 2).toUpperCase()
}

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLeadDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColors(status: any) {
  const color = status?.color || '#2563eb'
  return { bg: `${color}18`, color }
}

function isConvertedLead(lead: any) {
  const value = String(lead.status || '').toLowerCase()
  return Boolean(lead.convertedClientId) || value.includes('клиент') || value.includes('client') || value.includes('klient')
}

function isToday(value?: string) {
  return Boolean(value) && dateKey(value as string) === dateKey(new Date())
}

function isOverdue(value?: string) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}

export default function LeadsPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const locale = LEAD_LOCALES[lang] || 'ru-RU'
  const lt = (key: string) => leadText(lang, key)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [temperature, setTemperature] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [users, setUsers] = useState<any[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [leadStatuses, setLeadStatuses] = useState<any[]>([])
  const [editingStatuses, setEditingStatuses] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#2563eb')
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [activeReminder, setActiveReminder] = useState<any>(null)
  const [reminderForm, setReminderForm] = useState({
    completed: false,
    lastContactAt: '',
    lastContactNote: '',
    nextContactAt: '',
    nextContactNote: '',
  })
  const [reminderSaving, setReminderSaving] = useState(false)

  const orderedStatuses = leadStatuses.length ? leadStatuses : DEFAULT_LEAD_STATUSES
  const statusNames = orderedStatuses.map(status => status.name)
  const statusByName = useMemo(() => {
    const map: Record<string, any> = {}
    for (const item of orderedStatuses) map[item.name] = item
    return map
  }, [leadStatuses])

  function loadLeads() {
    setLoading(true)
    return fetch('/api/leads', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeads(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    fetch('/api/lead-statuses', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeadStatuses(Array.isArray(data) ? data : []))
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rank = (lead: any) => {
      const index = statusNames.indexOf(lead.status)
      return index === -1 ? 999 : index
    }
    const byFilters = leads.filter(lead => {
      if (status && lead.status !== status) return false
      if (source && lead.source !== source) return false
      if (temperature && lead.urgency !== temperature) return false
      if (quickFilter === 'today') return isToday(lead.nextContactAt) && !isConvertedLead(lead)
      if (quickFilter === 'overdue') return isOverdue(lead.nextContactAt) && !isConvertedLead(lead)
      if (quickFilter === 'unassigned') return !lead.assignedToId && !isConvertedLead(lead)
      if (quickFilter === 'no_next_contact') return !lead.nextContactAt && !isConvertedLead(lead)
      return true
    })
    const searched = q ? byFilters.filter(lead => [
      leadDisplayName(lead),
      lead.phone,
      lead.email,
      lead.instagram,
      lead.facebook,
      lead.serviceInterest,
      lead.nextContactNote,
      lead.city,
      lead.voivodeship,
      lead.notes,
    ].filter(Boolean).join(' ').toLowerCase().includes(q)) : byFilters
    return [...searched].sort((a, b) => rank(a) - rank(b) || new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  }, [leads, search, status, source, temperature, quickFilter, statusNames.join('|')])

  const visibleLeadIds = useMemo(() => filtered.map(lead => lead.id), [filtered])
  const allVisibleSelected = visibleLeadIds.length > 0 && visibleLeadIds.every(id => selectedLeadIds.includes(id))

  const quickCounts = useMemo(() => ({
    all: leads.length,
    today: leads.filter(lead => isToday(lead.nextContactAt) && !isConvertedLead(lead)).length,
    overdue: leads.filter(lead => isOverdue(lead.nextContactAt) && !isConvertedLead(lead)).length,
    unassigned: leads.filter(lead => !lead.assignedToId && !isConvertedLead(lead)).length,
    no_next_contact: leads.filter(lead => !lead.nextContactAt && !isConvertedLead(lead)).length,
  }), [leads])

  const temperatureCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const lead of leads) {
      if (!isConvertedLead(lead) && lead.urgency) counts[lead.urgency] = (counts[lead.urgency] || 0) + 1
    }
    return counts
  }, [leads])

  useEffect(() => {
    setSelectedLeadIds(current => current.filter(id => leads.some(lead => lead.id === id)))
  }, [leads])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const lead of leads) counts[lead.status] = (counts[lead.status] || 0) + 1
    return counts
  }, [leads])

  const activeLeadCount = useMemo(() => leads.filter(lead => !isConvertedLead(lead)).length, [leads])

  const reminders = useMemo(() => {
    return leads
      .flatMap(lead => {
        const items: any[] = []
        if (lead.nextContactAt) {
          items.push({ ...lead, reminderId: `${lead.id}:contact`, reminderKind: 'contact', reminderAt: lead.nextContactAt, reminderNote: lead.nextContactNote })
        }
        if (lead.deadlineAt && !isConvertedLead(lead)) {
          items.push({ ...lead, reminderId: `${lead.id}:deadline`, reminderKind: 'deadline', reminderAt: lead.deadlineAt, reminderNote: lt('deadline_hint') })
        }
        return items
      })
      .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime())
  }, [leads, lang])

  const remindersByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const lead of reminders) {
      const key = dateKey(lead.reminderAt)
      if (!key) continue
      map[key] = [...(map[key] || []), lead]
    }
    return map
  }, [reminders])

  const selectedReminders = remindersByDate[selectedDate] || []

  const leadsByStatus = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const item of statusNames) groups[item] = []
    for (const lead of filtered) {
      if (!groups[lead.status]) groups[lead.status] = []
      groups[lead.status].push(lead)
    }
    return groups
  }, [filtered, statusNames.join('|')])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const offset = (firstDay.getDay() + 6) % 7
    const totalDays = new Date(year, month + 1, 0).getDate()
    const days: Array<{ key: string; day: number | null; hasReminder: boolean }> = []
    for (let i = 0; i < offset; i++) days.push({ key: `empty-${i}`, day: null, hasReminder: false })
    for (let day = 1; day <= totalDays; day++) {
      const key = dateKey(new Date(year, month, day))
      days.push({ key, day, hasReminder: Boolean(remindersByDate[key]?.length) })
    }
    return days
  }, [calendarMonth, remindersByDate])

  function changeCalendarMonth(delta: number) {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  async function updateLeadStatus(lead: any, nextStatus: string) {
    if (!lead || lead.status === nextStatus) return
    const previousLeads = leads
    setLeads(current => current.map(item => item.id === lead.id ? { ...item, status: nextStatus } : item))
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!res.ok) setLeads(previousLeads)
  }

  function toggleLeadSelection(id: string) {
    setSelectedLeadIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function toggleVisibleSelection() {
    setSelectedLeadIds(current => {
      if (allVisibleSelected) return current.filter(id => !visibleLeadIds.includes(id))
      return Array.from(new Set([...current, ...visibleLeadIds]))
    })
  }

  async function bulkPatch(patch: any) {
    if (selectedLeadIds.length === 0) return
    const previousLeads = leads
    setBulkSaving(true)
    setLeads(current => current.map(lead => selectedLeadIds.includes(lead.id) ? { ...lead, ...patch } : lead))
    try {
      const results = await Promise.all(selectedLeadIds.map(id => fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })))
      if (results.some(res => !res.ok)) {
        setLeads(previousLeads)
        return
      }
      await loadLeads()
      setSelectedLeadIds([])
    } finally {
      setBulkSaving(false)
    }
  }

  async function bulkDelete() {
    if (selectedLeadIds.length === 0 || !confirm(lt('bulk_delete_confirm'))) return
    const previousLeads = leads
    setBulkSaving(true)
    setLeads(current => current.filter(lead => !selectedLeadIds.includes(lead.id)))
    try {
      const results = await Promise.all(selectedLeadIds.map(id => fetch(`/api/leads/${id}`, { method: 'DELETE' })))
      if (results.some(res => !res.ok)) {
        setLeads(previousLeads)
        return
      }
      setSelectedLeadIds([])
      await loadLeads()
    } finally {
      setBulkSaving(false)
    }
  }

  function droppedOnStatus(nextStatus: string) {
    const lead = leads.find(item => item.id === draggingLeadId)
    setDraggingLeadId(null)
    if (lead) updateLeadStatus(lead, nextStatus)
  }

  async function saveLeadStatus(item: any, patch: any) {
    const previous = leadStatuses
    const nextStatuses = leadStatuses.map(status => status.id === item.id ? { ...status, ...patch } : status)
    setLeadStatuses(nextStatuses)
    const res = await fetch(`/api/lead-statuses/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      setLeadStatuses(previous)
      return
    }
    const updated = await res.json()
    setLeadStatuses(current => current.map(status => status.id === item.id ? updated : status).sort((a, b) => a.order - b.order))
    if (patch.name && patch.name !== item.name) {
      setLeads(current => current.map(lead => lead.status === item.name ? { ...lead, status: patch.name } : lead))
      if (status === item.name) setStatus(patch.name)
    }
  }

  async function moveLeadStatus(index: number, delta: number) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= leadStatuses.length) return
    const reordered = [...leadStatuses]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    const withOrder = reordered.map((item, order) => ({ ...item, order }))
    setLeadStatuses(withOrder)
    await Promise.all(withOrder.map(item => fetch(`/api/lead-statuses/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: item.order }),
    })))
  }

  async function addLeadStatus() {
    const name = newStatusName.trim()
    if (!name) return
    const res = await fetch('/api/lead-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: newStatusColor, order: leadStatuses.length }),
    })
    if (!res.ok) return
    const created = await res.json()
    setLeadStatuses(current => [...current, created].sort((a, b) => a.order - b.order))
    setNewStatusName('')
    setNewStatusColor('#2563eb')
  }

  function toDateTimeLocal(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
  }

  function openReminder(lead: any) {
    setActiveReminder(lead)
    setReminderForm({
      completed: false,
      lastContactAt: toDateTimeLocal(lead.nextContactAt) || toDateTimeLocal(new Date().toISOString()),
      lastContactNote: lead.lastContactNote || lead.nextContactNote || '',
      nextContactAt: '',
      nextContactNote: '',
    })
  }

  function setReminderField(key: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target instanceof HTMLInputElement && event.target.type === 'checkbox' ? event.target.checked : event.target.value
      setReminderForm(current => ({ ...current, [key]: value }))
    }
  }

  async function saveReminder() {
    if (!activeReminder) return
    setReminderSaving(true)
    const payload: any = {
      status: activeReminder.status,
      source: activeReminder.source,
      firstName: activeReminder.firstName || '',
      lastName: activeReminder.lastName || '',
      fullName: activeReminder.fullName || '',
      phone: activeReminder.phone || '',
      email: activeReminder.email || '',
      instagram: activeReminder.instagram || '',
      facebook: activeReminder.facebook || '',
      city: activeReminder.city || '',
      voivodeship: activeReminder.voivodeship || '',
      country: activeReminder.country || '',
      language: activeReminder.language || '',
      serviceInterest: activeReminder.serviceInterest || '',
      budget: activeReminder.budget || '',
      urgency: activeReminder.urgency || '',
      deadlineAt: activeReminder.deadlineAt || '',
      assignedToId: activeReminder.assignedToId || '',
      notes: activeReminder.notes || '',
      lastContactAt: activeReminder.lastContactAt ? toDateTimeLocal(activeReminder.lastContactAt) : '',
      lastContactNote: activeReminder.lastContactNote || '',
      nextContactAt: reminderForm.nextContactAt,
      nextContactNote: reminderForm.nextContactNote,
    }

    if (reminderForm.completed) {
      payload.lastContactAt = reminderForm.lastContactAt
      payload.lastContactNote = reminderForm.lastContactNote
    } else {
      payload.lastContactAt = activeReminder.lastContactAt ? toDateTimeLocal(activeReminder.lastContactAt) : ''
      payload.lastContactNote = activeReminder.lastContactNote || ''
      payload.nextContactAt = reminderForm.nextContactAt || toDateTimeLocal(activeReminder.nextContactAt)
      payload.nextContactNote = reminderForm.nextContactNote || activeReminder.nextContactNote || ''
    }

    try {
      if (reminderForm.completed) {
        const res = await fetch(`/api/leads/${activeReminder.id}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactAt: reminderForm.lastContactAt,
            note: reminderForm.lastContactNote,
            nextContactAt: reminderForm.nextContactAt,
            nextContactNote: reminderForm.nextContactNote,
          }),
        })
        if (!res.ok) return
      } else {
        const res = await fetch(`/api/leads/${activeReminder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return
      }
      await loadLeads()
      setActiveReminder(null)
    } finally {
      setReminderSaving(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{lt('leads')}</div>
          <div className="page-subtitle">{lt('total')}: {leads.length}. {lt('active')}: {activeLeadCount}. {lt('leads_subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard" className="btn btn-secondary">{lt('dashboard')}</Link>
          <Link href="/leads/new" className="btn btn-primary">{lt('add_lead')}</Link>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEditingStatuses(current => !current)}>
            {editingStatuses ? lt('done') : lt('configure_statuses')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {orderedStatuses.map((item, index) => {
            const colors = statusColors(item)
            return (
              <div key={item.id || item.name} style={{ border: `1px solid ${status === item.name ? colors.color : 'var(--border)'}`, background: status === item.name ? colors.bg : 'var(--surface)', borderRadius: 8, padding: 10 }}>
                <button
                  type="button"
                  onClick={() => !editingStatuses && setStatus(current => current === item.name ? '' : item.name)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: editingStatuses ? 'default' : 'pointer' }}
                >
                  <div style={{ color: colors.color, fontWeight: 800, fontSize: 18 }}>{statusCounts[item.name] || 0}</div>
                  {editingStatuses && item.id ? (
                    <input className="input" defaultValue={item.name} onBlur={event => event.target.value.trim() !== item.name && saveLeadStatus(item, { name: event.target.value })} style={{ height: 30, padding: '4px 8px', fontSize: 12, fontWeight: 700 }} />
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{leadStatusLabel(lang, item.name)}</div>
                  )}
                </button>
                {editingStatuses && item.id && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8 }}>
                    <input type="color" value={item.color || '#2563eb'} onChange={event => saveLeadStatus(item, { color: event.target.value })} style={{ width: 34, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 6 }} />
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={index === 0} onClick={() => moveLeadStatus(index, -1)}>←</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={index === leadStatuses.length - 1} onClick={() => moveLeadStatus(index, 1)}>→</button>
                  </div>
                )}
              </div>
            )
          })}
          {editingStatuses && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
              <input className="input" value={newStatusName} onChange={event => setNewStatusName(event.target.value)} placeholder={lt('new_status')} style={{ height: 30, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="color" value={newStatusColor} onChange={event => setNewStatusColor(event.target.value)} style={{ width: 36, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6 }} />
                <button type="button" className="btn btn-primary" style={{ flex: 1, padding: '6px 10px' }} onClick={addLeadStatus}>{lt('add')}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {([
            ['all', 'quick_all'],
            ['today', 'quick_today'],
            ['overdue', 'quick_overdue'],
            ['unassigned', 'quick_unassigned'],
            ['no_next_contact', 'quick_no_next_contact'],
          ] as Array<[QuickFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={quickFilter === key ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setQuickFilter(key)}
              style={{ padding: '7px 10px' }}
            >
              {lt(label)} <span style={{ opacity: 0.78 }}>({quickCounts[key]})</span>
            </button>
          ))}
          {LEAD_TEMPERATURES.map(item => (
            <button
              key={item.value}
              type="button"
              className={temperature === item.value ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setTemperature(current => current === item.value ? '' : item.value)}
              style={{ padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color }} />
              {leadTemperatureLabel(lang, item.value)} <span style={{ opacity: 0.78 }}>({temperatureCounts[item.value] || 0})</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 190px 190px auto', gap: 10, marginBottom: 16 }}>
          <input className="input" placeholder={`🔍 ${lt('search_placeholder')}`} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{lt('all_statuses')}</option>
            {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
          </select>
          <select className="select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">{lt('all_sources')}</option>
            {LEAD_SOURCES.map(item => <option key={item.value} value={item.value}>{leadSourceLabel(lang, item.value)}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button type="button" className={viewMode === 'table' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '7px 10px' }} onClick={() => setViewMode('table')}>{lt('table')}</button>
            <button type="button" className={viewMode === 'board' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '7px 10px' }} onClick={() => setViewMode('board')}>{lt('board')}</button>
          </div>
        </div>

        {selectedLeadIds.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(160px, 1fr) minmax(170px, 1fr) minmax(160px, 1fr) auto auto', gap: 8, alignItems: 'center' }}>
              <strong>{lt('selected_count')}: {selectedLeadIds.length}</strong>
              <select className="select" defaultValue="" disabled={bulkSaving} onChange={event => event.target.value && bulkPatch({ status: event.target.value })}>
                <option value="">{lt('bulk_status')}</option>
                {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
              </select>
              <select className="select" defaultValue="" disabled={bulkSaving} onChange={event => event.target.value && bulkPatch({ assignedToId: event.target.value === '__none' ? '' : event.target.value })}>
                <option value="">{lt('bulk_responsible')}</option>
                <option value="__none">{lt('not_assigned')}</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <select className="select" defaultValue="" disabled={bulkSaving} onChange={event => event.target.value && bulkPatch({ source: event.target.value })}>
                <option value="">{lt('bulk_source')}</option>
                {LEAD_SOURCES.map(item => <option key={item.value} value={item.value}>{leadSourceLabel(lang, item.value)}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" disabled={bulkSaving} onClick={() => setSelectedLeadIds([])}>{lt('clear_selection')}</button>
              <button type="button" className="btn btn-danger" disabled={bulkSaving} onClick={bulkDelete}>{bulkSaving ? lt('processing') : lt('bulk_delete')}</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 16, alignItems: 'start' }}>
          {viewMode === 'table' ? (
          <div className="table-container">
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        onClick={event => event.stopPropagation()}
                        aria-label={lt('selected_count')}
                      />
                    </th>
                    <th>{lt('lead')}</th>
                    <th>{lt('status')}</th>
                    <th>{lt('source')}</th>
                    <th>{lt('interest')}</th>
                    <th>{lt('next_contact')}</th>
                    <th>{lt('responsible')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{lt('loading')}</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
                      <div>{search || status || source || temperature ? lt('leads_not_found') : lt('no_leads')}</div>
                      {!search && !status && !source && !temperature && <Link href="/leads/new" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 12 }}>{lt('add_first_lead')}</Link>}
                    </td></tr>
                  ) : filtered.map(lead => {
                    const colors = statusColors(statusByName[lead.status])
                    const temp = temperatureMeta(lead.urgency)
                    const overdue = isOverdue(lead.nextContactAt) && !isConvertedLead(lead)
                    const dueToday = isToday(lead.nextContactAt) && !isConvertedLead(lead)
                    return (
                      <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} style={{ cursor: 'pointer', background: overdue ? '#fef2f2' : undefined }}>
                        <td onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            aria-label={leadDisplayName(lead)}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(lead)}</div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                                {temp && <span title={leadTemperatureLabel(lang, lead.urgency)} style={{ width: 8, height: 8, borderRadius: 999, background: temp.color, flex: '0 0 auto' }} />}
                                <span>{leadDisplayName(lead)}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lead.phone || lead.email || lead.instagram || lead.facebook || lt('contact_not_set')}</div>
                            </div>
                          </div>
                        </td>
                        <td onClick={event => event.stopPropagation()}>
                          <select
                            className="select"
                            value={lead.status}
                            onChange={event => updateLeadStatus(lead, event.target.value)}
                            style={{ minWidth: 150, height: 32, padding: '4px 8px', background: colors.bg, color: colors.color, fontWeight: 700, borderColor: colors.bg }}
                          >
                            {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
                          </select>
                        </td>
                        <td style={{ fontSize: 13 }}>{leadSourceLabel(lang, lead.source)}</td>
                        <td style={{ fontSize: 13 }}>{lead.serviceInterest || lt('no_value')}</td>
                        <td style={{ fontSize: 13 }}>
                          {lead.nextContactAt ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span>{formatLeadDateTime(lead.nextContactAt, locale)}</span>
                                {(overdue || dueToday) && (
                                  <span className="badge" style={{ background: overdue ? '#fee2e2' : '#fef3c7', color: overdue ? '#b91c1c' : '#92400e' }}>
                                    {overdue ? lt('overdue') : lt('due_today')}
                                  </span>
                                )}
                              </div>
                              {lead.nextContactNote && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{lead.nextContactNote}</div>}
                            </div>
                          ) : lt('no_value')}
                        </td>
                        <td style={{ fontSize: 13 }}>{lead.assignedTo?.name || lt('no_value')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statusNames.length}, minmax(230px, 1fr))`, gap: 12, minWidth: Math.max(320, statusNames.length * 240) }}>
                {orderedStatuses.map(item => {
                  const colors = statusColors(item)
                  const columnLeads = leadsByStatus[item.name] || []
                  return (
                    <div
                      key={item.id || item.name}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => droppedOnStatus(item.name)}
                      style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, minHeight: 420, padding: 10 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontWeight: 800, color: colors.color }}>{leadStatusLabel(lang, item.name)}</div>
                        <span style={{ background: colors.bg, color: colors.color, borderRadius: 999, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>{columnLeads.length}</span>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {columnLeads.length === 0 ? (
                          <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>{lt('drag_lead_here')}</div>
                        ) : columnLeads.map(lead => {
                          const temp = temperatureMeta(lead.urgency)
                          return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={() => setDraggingLeadId(lead.id)}
                            onDragEnd={() => setDraggingLeadId(null)}
                            onClick={() => router.push(`/leads/${lead.id}`)}
                            style={{ background: isOverdue(lead.nextContactAt) && !isConvertedLead(lead) ? '#fef2f2' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'grab', boxShadow: 'var(--shadow-sm)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <input
                                type="checkbox"
                                checked={selectedLeadIds.includes(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                                onClick={event => event.stopPropagation()}
                              />
                              <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(lead)}</div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {temp && <span title={leadTemperatureLabel(lang, lead.urgency)} style={{ width: 8, height: 8, borderRadius: 999, background: temp.color, flex: '0 0 auto' }} />}
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{leadDisplayName(lead)}</span>
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.phone || lead.email || lead.instagram || lt('contact_not_set')}</div>
                              </div>
                            </div>
                            {lead.serviceInterest && <div style={{ fontSize: 12, marginBottom: 6 }}>{lead.serviceInterest}</div>}
                            {lead.nextContactAt && (
                              <div style={{ color: isOverdue(lead.nextContactAt) && !isConvertedLead(lead) ? '#b91c1c' : 'var(--muted)', fontSize: 12, fontWeight: isOverdue(lead.nextContactAt) && !isConvertedLead(lead) ? 800 : 500 }}>
                                {formatLeadDateTime(lead.nextContactAt, locale)}
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <div className="section-title"><span>◷</span>{lt('leads_calendar')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(-1)}>‹</button>
              <strong>{calendarMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(1)}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8, color: 'var(--muted)', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
              {LEAD_WEEKDAYS[lang].map(day => <div key={day}>{day}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {calendarDays.map(item => item.day ? (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedDate(item.key)}
                  style={{
                    minHeight: 34,
                    borderRadius: 6,
                    border: item.key === selectedDate ? '1px solid #2563eb' : '1px solid var(--border)',
                    background: item.key === selectedDate ? '#eff6ff' : 'var(--surface)',
                    color: item.key === selectedDate ? '#1d4ed8' : 'inherit',
                    fontWeight: item.hasReminder ? 800 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {item.day}
                  {item.hasReminder && <span style={{ position: 'absolute', left: '50%', bottom: 4, width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: '#2563eb' }} />}
                </button>
              ) : <div key={item.key} />)}
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              {selectedReminders.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{lt('no_lead_contacts_day')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedReminders.map(lead => (
                    <button
                      key={lead.reminderId || lead.id}
                      type="button"
                      onClick={() => lead.reminderKind === 'deadline' ? router.push(`/leads/${lead.id}`) : openReminder(lead)}
                      style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 10, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <strong>{leadDisplayName(lead)}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{lead.reminderKind === 'deadline' ? lt('deadline_at') : new Date(lead.reminderAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{lead.reminderNote || lt('no_note')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {activeReminder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
          onClick={() => setActiveReminder(null)}
        >
          <div
            className="card"
            style={{ width: 'min(620px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}><span>◷</span>{lt('lead_contact')}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{leadDisplayName(activeReminder)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{activeReminder.phone || activeReminder.email || activeReminder.instagram || lt('contact_not_set')}</div>
              </div>
              <Link href={`/leads/${activeReminder.id}`} className="btn btn-secondary">{lt('open_card')}</Link>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
                <input type="checkbox" checked={reminderForm.completed} onChange={setReminderField('completed')} />
                {lt('contact_completed')}
              </label>

              <div className="form-group">
                <label className="label">{lt('last_contact_date')}</label>
                <input className="input" type="datetime-local" value={reminderForm.lastContactAt} onChange={setReminderField('lastContactAt')} />
              </div>

              <div className="form-group">
                <label className="label">{lt('last_contact_note')}</label>
                <textarea className="input" rows={3} value={reminderForm.lastContactNote} onChange={setReminderField('lastContactNote')} placeholder={lt('last_contact_note_placeholder')} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="form-group">
                  <label className="label">{lt('next_contact')}</label>
                  <input className="input" type="datetime-local" value={reminderForm.nextContactAt} onChange={setReminderField('nextContactAt')} />
                </div>
                <div className="form-group">
                  <label className="label">{lt('next_contact_note')}</label>
                  <textarea className="input" rows={3} value={reminderForm.nextContactNote} onChange={setReminderField('nextContactNote')} placeholder={lt('next_contact_note_placeholder')} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveReminder(null)}>{lt('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={saveReminder} disabled={reminderSaving}>
                {reminderSaving ? lt('saving') : lt('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
