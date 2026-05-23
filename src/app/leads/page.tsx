'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES, leadDisplayName, type LeadSourceOption } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'
import { LEAD_LOCALES, LEAD_WEEKDAYS, leadSourceLabel, leadSourceOptionLabel, leadStatusLabel, leadTemperatureLabel, leadText } from '@/lib/leadI18n'

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
type SortKey = 'lead' | 'status' | 'source' | 'interest' | 'nextContact' | 'responsible'
type SortDirection = 'asc' | 'desc'

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

function statusReasons(status: any) {
  return Array.isArray(status?.reasons) ? status.reasons.map((item: any) => String(item || '').trim()).filter(Boolean) as string[] : []
}

function parseReasonList(value: string) {
  return Array.from(new Set(value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)))
}

function isConvertedLead(lead: any) {
  const value = String(lead.status || '').toLowerCase()
  return Boolean(lead.convertedClientId) || value.includes('клиент') || value.includes('\u043a\u043b\u0456\u0454\u043d\u0442') || value.includes('client') || value.includes('klient')
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
  const [statusReasonFilter, setStatusReasonFilter] = useState('')
  const [source, setSource] = useState('')
  const [temperature, setTemperature] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [users, setUsers] = useState<any[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [leadStatuses, setLeadStatuses] = useState<any[]>([])
  const [leadSources, setLeadSources] = useState<LeadSourceOption[]>(LEAD_SOURCES.map((item, index) => ({ ...item, order: index, system: true })))
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
  const [statusReasonModal, setStatusReasonModal] = useState<null | { leadIds: string[], nextStatus: string, previousLeads: any[] }>(null)
  const [statusReasonDraft, setStatusReasonDraft] = useState({ reason: '', comment: '' })
  const [statusReasonSaving, setStatusReasonSaving] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'status', direction: 'asc' })

  const orderedStatuses = leadStatuses.length ? leadStatuses : DEFAULT_LEAD_STATUSES
  const statusNames = orderedStatuses.map(status => status.name)
  const defaultStatusName = statusNames[0] || DEFAULT_LEAD_STATUSES[0]?.name || 'Новый'
  const statusByName = useMemo(() => {
    const map: Record<string, any> = {}
    for (const item of orderedStatuses) map[item.name] = item
    return map
  }, [leadStatuses])
  const sourceByValue = useMemo(() => {
    const map: Record<string, LeadSourceOption> = {}
    for (const item of leadSources) map[item.value] = item
    return map
  }, [leadSources])
  const sourceLabel = (value?: string | null) => {
    const source = sourceByValue[String(value || '')]
    return source ? leadSourceOptionLabel(lang, source) : leadSourceLabel(lang, String(value || 'manual'))
  }
  const normalizedStatus = (value?: string) => {
    const raw = String(value || '').trim()
    if (!raw) return defaultStatusName
    return statusByName[raw] ? raw : defaultStatusName
  }
  const selectedStatusConfig = status ? statusByName[status] : null
  const selectedStatusReasons = statusReasons(selectedStatusConfig)
  const showStatusReasons = Boolean(status && selectedStatusConfig?.requireReason && selectedStatusReasons.length > 0)

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
    fetch('/api/lead-sources', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeadSources(Array.isArray(data.sources) ? data.sources : LEAD_SOURCES.map((item, index) => ({ ...item, order: index, system: true }))))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rank = (lead: any) => {
      const index = statusNames.indexOf(normalizedStatus(lead.status))
      return index === -1 ? 999 : index
    }
    const compareText = (a: unknown, b: unknown) => String(a || '').localeCompare(String(b || ''), locale)
    const compareDate = (a?: string, b?: string) => {
      const aTime = a ? new Date(a).getTime() : Number.POSITIVE_INFINITY
      const bTime = b ? new Date(b).getTime() : Number.POSITIVE_INFINITY
      return aTime - bTime
    }
    const compareLeads = (a: any, b: any) => {
      let result = 0
      if (sortConfig.key === 'lead') result = compareText(leadDisplayName(a), leadDisplayName(b))
      if (sortConfig.key === 'status') result = rank(a) - rank(b)
      if (sortConfig.key === 'source') result = compareText(sourceLabel(a.source), sourceLabel(b.source))
      if (sortConfig.key === 'interest') result = compareText(a.serviceInterest, b.serviceInterest)
      if (sortConfig.key === 'nextContact') result = compareDate(a.nextContactAt, b.nextContactAt)
      if (sortConfig.key === 'responsible') result = compareText(a.assignedTo?.name, b.assignedTo?.name)
      if (sortConfig.direction === 'desc') result *= -1
      return result || rank(a) - rank(b) || new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    }
    const byFilters = leads.filter(lead => {
      const leadStatus = normalizedStatus(lead.status)
      if (status && leadStatus !== status) return false
      if (showStatusReasons && statusReasonFilter && lead.statusReason !== statusReasonFilter) return false
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
    return [...searched].sort(compareLeads)
  }, [leads, search, status, statusReasonFilter, source, temperature, quickFilter, showStatusReasons, statusNames.join('|'), sortConfig, lang])

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

  useEffect(() => {
    setStatusReasonFilter('')
  }, [status])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const lead of leads) {
      const leadStatus = normalizedStatus(lead.status)
      counts[leadStatus] = (counts[leadStatus] || 0) + 1
    }
    return counts
  }, [leads, statusNames.join('|')])

  const statusReasonCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!status) return counts
    for (const lead of leads) {
      if (normalizedStatus(lead.status) !== status) continue
      const reason = lead.statusReason || lt('without_reason')
      counts[reason] = (counts[reason] || 0) + 1
    }
    return counts
  }, [leads, status, statusNames.join('|')])

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
        for (const reminder of lead.leadReminders || []) {
          if (!reminder.reminderAt && !reminder.dueDate) continue
          items.push({
            ...lead,
            reminderId: reminder.id,
            reminderKind: reminder.reminderKind || 'manual',
            reminderAt: reminder.reminderAt || reminder.dueDate,
            reminderNote: reminder.reminderNote || reminder.title,
          })
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
      const leadStatus = normalizedStatus(lead.status)
      if (!groups[leadStatus]) groups[leadStatus] = []
      groups[leadStatus].push(lead)
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
    if (!lead || normalizedStatus(lead.status) === nextStatus) return
    const targetStatus = statusByName[nextStatus]
    if (targetStatus?.requireReason) {
      setStatusReasonDraft({ reason: statusReasons(targetStatus)[0] || '', comment: '' })
      setStatusReasonModal({ leadIds: [lead.id], nextStatus, previousLeads: leads })
      return
    }
    const previousLeads = leads
    setLeads(current => current.map(item => item.id === lead.id ? { ...item, status: nextStatus, statusReason: null, statusReasonComment: null } : item))
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, statusReason: null, statusReasonComment: null }),
    })
    if (!res.ok) setLeads(previousLeads)
  }

  function requestSort(key: SortKey) {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function sortHeader(key: SortKey, label: string) {
    const active = sortConfig.key === key
    return (
      <button
        type="button"
        onClick={() => requestSort(key)}
        style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 800, color: active ? 'var(--primary)' : 'inherit', cursor: 'pointer', textTransform: 'inherit', letterSpacing: 'inherit' }}
      >
        {label} {active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
      </button>
    )
  }

  async function applyStatusReasonChange() {
    if (!statusReasonModal || !statusReasonDraft.reason) return
    const { leadIds, nextStatus, previousLeads } = statusReasonModal
    setStatusReasonSaving(true)
    const patch = { status: nextStatus, statusReason: statusReasonDraft.reason, statusReasonComment: statusReasonDraft.comment }
    setLeads(current => current.map(lead => leadIds.includes(lead.id) ? { ...lead, ...patch } : lead))
    try {
      const results = await Promise.all(leadIds.map(id => fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })))
      if (results.some(res => !res.ok)) {
        setLeads(previousLeads)
        return
      }
      setStatusReasonModal(null)
      setStatusReasonDraft({ reason: '', comment: '' })
      await loadLeads()
    } finally {
      setStatusReasonSaving(false)
    }
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

  function bulkChangeStatus(nextStatus: string) {
    if (!nextStatus || selectedLeadIds.length === 0) return
    const targetStatus = statusByName[nextStatus]
    if (targetStatus?.requireReason) {
      setStatusReasonDraft({ reason: statusReasons(targetStatus)[0] || '', comment: '' })
      setStatusReasonModal({ leadIds: selectedLeadIds, nextStatus, previousLeads: leads })
      return
    }
    bulkPatch({ status: nextStatus, statusReason: null, statusReasonComment: null })
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
    <div className="fade-in leads-page">
      <style>{`
        @media (max-width: 760px) {
          .leads-page {
            overflow-x: hidden;
          }

          .leads-page .page-header {
            align-items: flex-start;
            gap: 10px;
          }

          .leads-page .lead-status-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .leads-page .lead-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .leads-page .lead-view-toggle {
            width: 100%;
          }

          .leads-page .lead-view-toggle .btn {
            flex: 1;
            justify-content: center;
          }

          .leads-page .lead-content-grid {
            display: flex !important;
            flex-direction: column;
            gap: 12px !important;
          }

          .leads-page .lead-results {
            order: 1;
            min-width: 0;
            width: 100%;
          }

          .leads-page .lead-calendar-card {
            order: 2;
            position: static !important;
            width: 100%;
            max-width: 100%;
          }

          .leads-page .table-container,
          .leads-page .table-scroll {
            width: 100%;
            max-width: calc(100vw - 24px);
            overflow-x: auto;
          }

          .leads-page .table {
            min-width: 760px;
          }

          .leads-page .lead-board-scroll {
            width: 100%;
            max-width: calc(100vw - 24px);
            overflow-x: auto;
          }
        }

        @media (max-width: 420px) {
          .leads-page .page-body {
            padding-left: 10px;
            padding-right: 10px;
          }
        }
      `}</style>
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

        <div className="lead-status-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
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
                {editingStatuses && item.id && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
                      <input type="checkbox" checked={Boolean(item.requireReason)} onChange={event => saveLeadStatus(item, { requireReason: event.target.checked })} />
                      {lt('reason_required_on_status')}
                    </label>
                    {item.requireReason && (
                      <textarea
                        className="textarea"
                        defaultValue={statusReasons(item).join('\n')}
                        onBlur={event => saveLeadStatus(item, { reasons: parseReasonList(event.target.value) })}
                        placeholder={lt('reasons_placeholder')}
                        style={{ minHeight: 72, fontSize: 12 }}
                      />
                    )}
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

        {showStatusReasons && (
          <div className="card" style={{ marginBottom: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <strong>Причины: {leadStatusLabel(lang, status)}</strong>
                  <button type="button" className="btn btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setStatusReasonFilter('')}>{lt('all_reasons')}</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Array.from(new Set([...selectedStatusReasons, ...Object.keys(statusReasonCounts)])).map(reason => (
                <button
                  key={reason}
                  type="button"
                  className={statusReasonFilter === reason ? 'btn btn-primary' : 'btn btn-secondary'}
                  onClick={() => setStatusReasonFilter(current => current === reason ? '' : reason)}
                  style={{ padding: '6px 10px' }}
                >
                  {reason} <span style={{ opacity: 0.78 }}>({statusReasonCounts[reason] || 0})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lead-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 190px 190px auto', gap: 10, marginBottom: 16 }}>
          <input className="input" placeholder={`🔍 ${lt('search_placeholder')}`} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{lt('all_statuses')}</option>
            {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
          </select>
          <select className="select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">{lt('all_sources')}</option>
            {leadSources.map(item => <option key={item.value} value={item.value}>{leadSourceOptionLabel(lang, item)}</option>)}
          </select>
          <div className="lead-view-toggle" style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button type="button" className={viewMode === 'table' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '7px 10px' }} onClick={() => setViewMode('table')}>{lt('table')}</button>
            <button type="button" className={viewMode === 'board' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '7px 10px' }} onClick={() => setViewMode('board')}>{lt('board')}</button>
          </div>
        </div>

        {selectedLeadIds.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(160px, 1fr) minmax(170px, 1fr) minmax(160px, 1fr) auto auto', gap: 8, alignItems: 'center' }}>
              <strong>{lt('selected_count')}: {selectedLeadIds.length}</strong>
              <select className="select" defaultValue="" disabled={bulkSaving} onChange={event => event.target.value && bulkChangeStatus(event.target.value)}>
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
                {leadSources.map(item => <option key={item.value} value={item.value}>{leadSourceOptionLabel(lang, item)}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" disabled={bulkSaving} onClick={() => setSelectedLeadIds([])}>{lt('clear_selection')}</button>
              <button type="button" className="btn btn-danger" disabled={bulkSaving} onClick={bulkDelete}>{bulkSaving ? lt('processing') : lt('bulk_delete')}</button>
            </div>
          </div>
        )}

        <div className="lead-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 16, alignItems: 'start' }}>
          {viewMode === 'table' ? (
          <div className="table-container lead-results">
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
                    <th>{sortHeader('lead', lt('lead'))}</th>
                    <th>{sortHeader('status', lt('status'))}</th>
                    {showStatusReasons && <th>{lt('reason')}</th>}
                    <th>{sortHeader('source', lt('source'))}</th>
                    <th>{sortHeader('interest', lt('interest'))}</th>
                    <th>{sortHeader('nextContact', lt('next_contact'))}</th>
                    <th>{sortHeader('responsible', lt('responsible'))}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={showStatusReasons ? 8 : 7} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{lt('loading')}</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={showStatusReasons ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
                      <div>{search || status || source || temperature ? lt('leads_not_found') : lt('no_leads')}</div>
                      {!search && !status && !source && !temperature && <Link href="/leads/new" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 12 }}>{lt('add_first_lead')}</Link>}
                    </td></tr>
                  ) : filtered.map(lead => {
                    const leadStatus = normalizedStatus(lead.status)
                    const colors = statusColors(statusByName[leadStatus])
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
                            value={leadStatus}
                            onChange={event => updateLeadStatus(lead, event.target.value)}
                            style={{ minWidth: 150, height: 32, padding: '4px 8px', background: colors.bg, color: colors.color, fontWeight: 700, borderColor: colors.bg }}
                          >
                            {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
                          </select>
                        </td>
                        {showStatusReasons && (
                          <td style={{ fontSize: 13 }}>
                            {lead.statusReason ? (
                              <div>
                                <strong>{lead.statusReason}</strong>
                                {lead.statusReasonComment && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{lead.statusReasonComment}</div>}
                              </div>
                            ) : lt('no_value')}
                          </td>
                        )}
                        <td style={{ fontSize: 13 }}>{sourceLabel(lead.source)}</td>
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
            <div className="lead-results lead-board-scroll" style={{ overflowX: 'auto', paddingBottom: 6 }}>
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
                            {lead.statusReason && <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>{lt('reason_prefix')}: {lead.statusReason}</div>}
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

          <div className="card lead-calendar-card" style={{ position: 'sticky', top: 16 }}>
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
                      onClick={() => lead.reminderKind === 'deadline' || lead.reminderKind === 'manual' ? router.push(`/leads/${lead.id}`) : openReminder(lead)}
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
      {statusReasonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 60,
          }}
          onClick={() => {
            setLeads(statusReasonModal.previousLeads)
            setStatusReasonModal(null)
          }}
        >
          <div className="card" style={{ width: 'min(520px, 100%)' }} onClick={event => event.stopPropagation()}>
            <div className="section-title" style={{ marginBottom: 12 }}><span>!</span>{lt('status_change_reason')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
              {lt('status_label')}: <strong>{leadStatusLabel(lang, statusReasonModal.nextStatus)}</strong>. {lt('leads_count')}: {statusReasonModal.leadIds.length}
            </div>
            <div className="form-group">
              <label className="label">{lt('reason')}</label>
              <select className="select" value={statusReasonDraft.reason} onChange={event => setStatusReasonDraft(current => ({ ...current, reason: event.target.value }))}>
                <option value="">{lt('choose_reason')}</option>
                {statusReasons(statusByName[statusReasonModal.nextStatus]).map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">{lt('comment')}</label>
              <textarea className="input" rows={3} value={statusReasonDraft.comment} onChange={event => setStatusReasonDraft(current => ({ ...current, comment: event.target.value }))} placeholder={lt('comment_placeholder')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setLeads(statusReasonModal.previousLeads)
                  setStatusReasonModal(null)
                }}
              >
                {lt('cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={applyStatusReasonChange} disabled={statusReasonSaving || !statusReasonDraft.reason}>
                {statusReasonSaving ? lt('saving') : lt('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
