'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEFAULT_LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES, leadDisplayName, type LeadSourceOption } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'
import { LEAD_LOCALES, LEAD_WEEKDAYS, leadSourceLabel, leadSourceOptionLabel, leadStatusLabel, leadTemperatureLabel, leadText } from '@/lib/leadI18n'
import { normalizeLang } from '@/lib/translations'
import TutorialVideoButton from '@/components/TutorialVideoButton'

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
type SortKey = 'lead' | 'status' | 'source' | 'interest' | 'createdAt' | 'lastContact' | 'nextContact' | 'responsible'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'table' | 'board'
type LeadColumnKey = 'lead' | 'status' | 'reason' | 'source' | 'interest' | 'createdAt' | 'lastContact' | 'nextContact' | 'responsible'
type LeadListState = {
  search: string
  status: string
  statusReasonFilter: string
  source: string
  temperature: string
  quickFilter: QuickFilter
  viewMode: ViewMode
  sortConfig: { key: SortKey; direction: SortDirection }
}

const QUICK_FILTER_VALUES: QuickFilter[] = ['all', 'today', 'overdue', 'unassigned', 'no_next_contact']
const SORT_KEY_VALUES: SortKey[] = ['lead', 'status', 'source', 'interest', 'createdAt', 'lastContact', 'nextContact', 'responsible']
const SORT_DIRECTION_VALUES: SortDirection[] = ['asc', 'desc']
const VIEW_MODE_VALUES: ViewMode[] = ['table', 'board']
const ALL_LEAD_COLUMNS: Array<{ key: LeadColumnKey; labelKey: string; always?: boolean; requiresStatusReasons?: boolean }> = [
  { key: 'lead', labelKey: 'lead', always: true },
  { key: 'status', labelKey: 'status' },
  { key: 'reason', labelKey: 'reason', requiresStatusReasons: true },
  { key: 'source', labelKey: 'source' },
  { key: 'interest', labelKey: 'interest' },
  { key: 'createdAt', labelKey: 'created' },
  { key: 'lastContact', labelKey: 'last_contact' },
  { key: 'nextContact', labelKey: 'next_contact' },
  { key: 'responsible', labelKey: 'responsible' },
]
const DEFAULT_VISIBLE_LEAD_COLUMNS: LeadColumnKey[] = ['lead', 'status', 'reason', 'source', 'interest', 'createdAt', 'lastContact', 'nextContact', 'responsible']
const LEAD_COLUMN_KEYS = ALL_LEAD_COLUMNS.map(col => col.key)
const LEAD_SELECT_COLUMN_WIDTH = 42
const LEAD_TABLE_COLUMN_WIDTHS: Record<LeadColumnKey, number> = {
  lead: 240,
  status: 170,
  reason: 190,
  source: 130,
  interest: 170,
  createdAt: 140,
  lastContact: 170,
  nextContact: 230,
  responsible: 150,
}
const DEFAULT_LEAD_LIST_STATE: LeadListState = {
  search: '',
  status: '',
  statusReasonFilter: '',
  source: '',
  temperature: '',
  quickFilter: 'all',
  viewMode: 'table',
  sortConfig: { key: 'status', direction: 'asc' },
}

function parseQueryOption<T extends string>(value: string | null, allowed: T[], fallback: T) {
  return value && allowed.includes(value as T) ? value as T : fallback
}

function parseLeadListState(params: URLSearchParams): LeadListState {
  return {
    search: params.get('q') || DEFAULT_LEAD_LIST_STATE.search,
    status: params.get('status') || DEFAULT_LEAD_LIST_STATE.status,
    statusReasonFilter: params.get('reason') || DEFAULT_LEAD_LIST_STATE.statusReasonFilter,
    source: params.get('source') || DEFAULT_LEAD_LIST_STATE.source,
    temperature: params.get('temperature') || DEFAULT_LEAD_LIST_STATE.temperature,
    quickFilter: parseQueryOption(params.get('quick'), QUICK_FILTER_VALUES, DEFAULT_LEAD_LIST_STATE.quickFilter),
    viewMode: parseQueryOption(params.get('view'), VIEW_MODE_VALUES, DEFAULT_LEAD_LIST_STATE.viewMode),
    sortConfig: {
      key: parseQueryOption(params.get('sort'), SORT_KEY_VALUES, DEFAULT_LEAD_LIST_STATE.sortConfig.key),
      direction: parseQueryOption(params.get('dir'), SORT_DIRECTION_VALUES, DEFAULT_LEAD_LIST_STATE.sortConfig.direction),
    },
  }
}

function buildLeadListQuery(state: LeadListState) {
  const params = new URLSearchParams()
  const search = state.search.trim()
  if (search) params.set('q', search)
  if (state.status) params.set('status', state.status)
  if (state.statusReasonFilter) params.set('reason', state.statusReasonFilter)
  if (state.source) params.set('source', state.source)
  if (state.temperature) params.set('temperature', state.temperature)
  if (state.quickFilter !== DEFAULT_LEAD_LIST_STATE.quickFilter) params.set('quick', state.quickFilter)
  if (state.viewMode !== DEFAULT_LEAD_LIST_STATE.viewMode) params.set('view', state.viewMode)
  if (
    state.sortConfig.key !== DEFAULT_LEAD_LIST_STATE.sortConfig.key ||
    state.sortConfig.direction !== DEFAULT_LEAD_LIST_STATE.sortConfig.direction
  ) {
    params.set('sort', state.sortConfig.key)
    params.set('dir', state.sortConfig.direction)
  }
  return params.toString()
}

function buildLeadListHref(state: LeadListState) {
  const query = buildLeadListQuery(state)
  return query ? `/leads?${query}` : '/leads'
}

function temperatureMeta(value?: string) {
  return LEAD_TEMPERATURES.find(item => item.value === value)
}

function initials(lead: any) {
  return leadDisplayName(lead).slice(0, 2).toUpperCase()
}

function leadResponsibleName(lead: any) {
  return lead.employee?.name || lead.assignedTo?.name || ''
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

function formatLeadCreatedAt(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function latestLeadContactAt(lead: any) {
  const candidates = [lead.lastInteractionAt, lead.lastMessageAt, lead.lastContactAt]
  let latest = ''
  let latestTime = Number.NEGATIVE_INFINITY
  for (const value of candidates) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time
      latest = value
    }
  }
  return latest
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
  const { lang: currentLang, t } = useLanguage()
  const lang = normalizeLang(currentLang)
  const locale = LEAD_LOCALES[lang] || 'ru-RU'
  const lt = (key: string) => leadText(lang, key)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(DEFAULT_LEAD_LIST_STATE.search)
  const [status, setStatus] = useState(DEFAULT_LEAD_LIST_STATE.status)
  const [statusReasonFilter, setStatusReasonFilter] = useState(DEFAULT_LEAD_LIST_STATE.statusReasonFilter)
  const [source, setSource] = useState(DEFAULT_LEAD_LIST_STATE.source)
  const [temperature, setTemperature] = useState(DEFAULT_LEAD_LIST_STATE.temperature)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(DEFAULT_LEAD_LIST_STATE.quickFilter)
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [leadStatuses, setLeadStatuses] = useState<any[]>([])
  const [leadSources, setLeadSources] = useState<LeadSourceOption[]>(LEAD_SOURCES.map((item, index) => ({ ...item, order: index, system: true })))
  const [editingStatuses, setEditingStatuses] = useState(false)
  const [deletingStatusId, setDeletingStatusId] = useState<number | null>(null)
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#2563eb')
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_LEAD_LIST_STATE.viewMode)
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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>(DEFAULT_LEAD_LIST_STATE.sortConfig)
  const [urlStateReady, setUrlStateReady] = useState(false)
  const [visibleCols, setVisibleCols] = useState<LeadColumnKey[]>(DEFAULT_VISIBLE_LEAD_COLUMNS)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const leadWorkScrollRef = useRef<HTMLDivElement>(null)
  const leadBottomScrollRef = useRef<HTMLDivElement>(null)
  const syncingLeadScrollRef = useRef(false)
  const [leadScrollState, setLeadScrollState] = useState({ width: 0, viewportWidth: 0, left: 0, visible: false })

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
  const availableLeadColumns = useMemo(
    () => ALL_LEAD_COLUMNS.filter(col => !col.requiresStatusReasons || showStatusReasons),
    [showStatusReasons],
  )
  const visibleLeadColumns = useMemo(
    () => availableLeadColumns.filter(col => visibleCols.includes(col.key)).map(col => col.key),
    [availableLeadColumns, visibleCols],
  )
  const leadTableMinWidth = useMemo(
    () => LEAD_SELECT_COLUMN_WIDTH + visibleLeadColumns.reduce((sum, key) => sum + LEAD_TABLE_COLUMN_WIDTHS[key], 0),
    [visibleLeadColumns],
  )
  const visibleLeadColumnCount = visibleLeadColumns.length
  const totalLeadColumnCount = availableLeadColumns.length
  const isColumnVisible = (key: LeadColumnKey) => visibleLeadColumns.includes(key)

  function applyLeadListState(nextState: LeadListState) {
    setSearch(nextState.search)
    setStatus(nextState.status)
    setStatusReasonFilter(nextState.statusReasonFilter)
    setSource(nextState.source)
    setTemperature(nextState.temperature)
    setQuickFilter(nextState.quickFilter)
    setViewMode(nextState.viewMode)
    setSortConfig(nextState.sortConfig)
  }

  function loadLeads() {
    setLoading(true)
    return fetch('/api/leads?view=list', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeads(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const applyFromLocation = () => applyLeadListState(parseLeadListState(new URLSearchParams(window.location.search)))
    applyFromLocation()
    setUrlStateReady(true)
    window.addEventListener('popstate', applyFromLocation)
    return () => window.removeEventListener('popstate', applyFromLocation)
  }, [])

  useEffect(() => {
    fetch('/api/lead-statuses', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeadStatuses(Array.isArray(data) ? data : []))
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => setEmployees(Array.isArray(data) ? data.filter((item: any) => item.active) : []))
    fetch('/api/lead-sources', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeadSources(Array.isArray(data.sources) ? data.sources : LEAD_SOURCES.map((item, index) => ({ ...item, order: index, system: true }))))
  }, [])

  useEffect(() => {
    fetch('/api/user-preferences')
      .then(res => res.ok ? res.json() : {})
      .then((data: any) => {
        if (Array.isArray(data.leadColumns)) {
          const next = data.leadColumns.filter((key: string) => LEAD_COLUMN_KEYS.includes(key as LeadColumnKey)) as LeadColumnKey[]
          setVisibleCols(next.includes('lead') ? next : ['lead', ...next])
        }
        setPreferencesReady(true)
      })
      .catch(() => setPreferencesReady(true))
  }, [])

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
      if (sortConfig.key === 'createdAt') result = compareDate(a.createdAt, b.createdAt)
      if (sortConfig.key === 'lastContact') result = compareDate(latestLeadContactAt(a), latestLeadContactAt(b))
      if (sortConfig.key === 'nextContact') result = compareDate(a.nextContactAt, b.nextContactAt)
      if (sortConfig.key === 'responsible') result = compareText(leadResponsibleName(a), leadResponsibleName(b))
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
      if (quickFilter === 'unassigned') return !leadResponsibleName(lead) && !isConvertedLead(lead)
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
      leadResponsibleName(lead),
    ].filter(Boolean).join(' ').toLowerCase().includes(q)) : byFilters
    return [...searched].sort(compareLeads)
  }, [leads, search, status, statusReasonFilter, source, temperature, quickFilter, showStatusReasons, statusNames.join('|'), sortConfig, lang])

  const visibleLeadIds = useMemo(() => filtered.map(lead => lead.id), [filtered])
  const allVisibleSelected = visibleLeadIds.length > 0 && visibleLeadIds.every(id => selectedLeadIds.includes(id))

  const quickCounts = useMemo(() => ({
    all: leads.length,
    today: leads.filter(lead => isToday(lead.nextContactAt) && !isConvertedLead(lead)).length,
    overdue: leads.filter(lead => isOverdue(lead.nextContactAt) && !isConvertedLead(lead)).length,
    unassigned: leads.filter(lead => !leadResponsibleName(lead) && !isConvertedLead(lead)).length,
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
    if (!statusReasonFilter) return
    if (status && !selectedStatusConfig && leadStatuses.length === 0) return
    if (!showStatusReasons || !selectedStatusReasons.includes(statusReasonFilter)) setStatusReasonFilter('')
  }, [status, selectedStatusConfig, leadStatuses.length, showStatusReasons, statusReasonFilter, selectedStatusReasons.join('|')])

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

  const leadListState = useMemo<LeadListState>(() => ({
    search,
    status,
    statusReasonFilter,
    source,
    temperature,
    quickFilter,
    viewMode,
    sortConfig,
  }), [search, status, statusReasonFilter, source, temperature, quickFilter, viewMode, sortConfig])

  const leadListHref = useMemo(() => buildLeadListHref(leadListState), [leadListState])

  useEffect(() => {
    if (!urlStateReady || typeof window === 'undefined') return
    const currentHref = `${window.location.pathname}${window.location.search}`
    if (currentHref !== leadListHref) window.history.replaceState(null, '', leadListHref)
  }, [urlStateReady, leadListHref])

  function leadHref(id: string) {
    return `/leads/${id}?backTo=${encodeURIComponent(leadListHref)}`
  }

  function openLeadCard(id: string) {
    router.push(leadHref(id))
  }

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

  useEffect(() => {
    const content = leadWorkScrollRef.current
    if (!content || typeof window === 'undefined') return

    const updateScrollState = () => {
      const scrollWidth = Math.ceil(content.scrollWidth)
      const clientWidth = Math.ceil(content.clientWidth)
      const rect = content.getBoundingClientRect()
      const nextState = {
        width: scrollWidth,
        viewportWidth: Math.max(0, Math.round(rect.width)),
        left: Math.max(0, Math.round(rect.left)),
        visible: scrollWidth > clientWidth + 2,
      }
      setLeadScrollState(current => (
        current.width === nextState.width &&
        current.viewportWidth === nextState.viewportWidth &&
        current.left === nextState.left &&
        current.visible === nextState.visible
          ? current
          : nextState
      ))
      if (leadBottomScrollRef.current) leadBottomScrollRef.current.scrollLeft = content.scrollLeft
    }

    updateScrollState()
    window.addEventListener('resize', updateScrollState)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateScrollState)
      observer.observe(content)
      if (content.firstElementChild) observer.observe(content.firstElementChild)
    }

    return () => {
      window.removeEventListener('resize', updateScrollState)
      observer?.disconnect()
    }
  }, [viewMode, visibleLeadColumns.join('|'), filtered.length, statusNames.length])

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

  function toggleCol(key: LeadColumnKey) {
    const column = ALL_LEAD_COLUMNS.find(item => item.key === key)
    if (column?.always) return
    setVisibleCols(current => {
      const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key]
      const safeNext: LeadColumnKey[] = next.includes('lead') ? next : ['lead', ...next]
      if (preferencesReady) {
        fetch('/api/user-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadColumns: safeNext }),
        }).catch(() => {})
      }
      return safeNext
    })
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

  async function deleteLeadStatus(item: any) {
    const count = statusCounts[item.name] || 0
    if (count > 0) {
      window.alert(lt('status_delete_blocked').replace('{count}', String(count)))
      return
    }
    if (!window.confirm(lt('status_delete_confirm').replace('{name}', item.name))) return

    const previous = leadStatuses
    setDeletingStatusId(item.id)
    setLeadStatuses(current => current.filter(statusItem => statusItem.id !== item.id))
    try {
      const res = await fetch(`/api/lead-statuses/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setLeadStatuses(previous)
        window.alert(data.error || lt('status_delete_failed'))
        return
      }
      if (status === item.name) setStatus('')
    } finally {
      setDeletingStatusId(null)
    }
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

  function syncLeadContentScroll() {
    if (syncingLeadScrollRef.current) return
    const content = leadWorkScrollRef.current
    const scrollbar = leadBottomScrollRef.current
    if (!content || !scrollbar) return
    syncingLeadScrollRef.current = true
    scrollbar.scrollLeft = content.scrollLeft
    requestAnimationFrame(() => {
      syncingLeadScrollRef.current = false
    })
  }

  function syncLeadBottomScroll() {
    if (syncingLeadScrollRef.current) return
    const content = leadWorkScrollRef.current
    const scrollbar = leadBottomScrollRef.current
    if (!content || !scrollbar) return
    syncingLeadScrollRef.current = true
    content.scrollLeft = scrollbar.scrollLeft
    requestAnimationFrame(() => {
      syncingLeadScrollRef.current = false
    })
  }

  const leadHorizontalScrollbar = leadScrollState.visible ? (
    <div
      ref={leadBottomScrollRef}
      className="lead-horizontal-scrollbar"
      style={{ left: leadScrollState.left, width: leadScrollState.viewportWidth }}
      onScroll={syncLeadBottomScroll}
      aria-hidden="true"
    >
      <div style={{ width: leadScrollState.width, height: 1 }} />
    </div>
  ) : null

  return (
    <div className="fade-in leads-page">
      <style>{`
        .leads-page .lead-results-shell {
          min-width: 0;
          width: 100%;
        }

        .leads-page .lead-work-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-gutter: stable;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .leads-page .lead-table {
          table-layout: fixed;
        }

        .leads-page .lead-table th,
        .leads-page .lead-table td {
          vertical-align: middle;
        }

        .leads-page .lead-table th {
          white-space: normal;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .leads-page .lead-table th button {
          max-width: 100%;
          white-space: normal;
          line-height: 1.15;
          text-align: left;
        }

        .leads-page .lead-table td {
          white-space: nowrap;
        }

        .leads-page .lead-status-card,
        .leads-page .lead-status-card button,
        .leads-page .lead-status-label {
          color: var(--text);
        }

        .leads-page .lead-table-lead-cell,
        .leads-page .lead-table-text-cell,
        .leads-page .lead-table-date-cell {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .leads-page .lead-table-person {
          min-width: 0;
          max-width: 100%;
        }

        .leads-page .lead-table-person-name,
        .leads-page .lead-table-person-contact {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .leads-page .lead-table-person-name span:last-child {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .leads-page .lead-table .select {
          max-width: 100%;
        }

        .leads-page .lead-overdue-row {
          background: var(--danger-soft);
        }

        .leads-page .lead-overdue-row td {
          border-bottom-color: var(--danger-border);
        }

        .leads-page .lead-overdue-card {
          background: var(--danger-soft) !important;
          border-color: var(--danger-border) !important;
          color: var(--danger-text);
          box-shadow: inset 3px 0 0 var(--danger-strong), var(--shadow) !important;
        }

        .leads-page .lead-overdue-card:hover {
          background: var(--danger-hover) !important;
        }

        .leads-page .lead-overdue-card .lead-overdue-muted {
          color: var(--danger-muted) !important;
        }

        .leads-page .lead-overdue-date {
          color: var(--danger-strong) !important;
          font-weight: 800 !important;
        }

        .leads-page .lead-overdue-badge {
          background: var(--danger-hover) !important;
          color: var(--danger-text) !important;
          border: 1px solid var(--danger-border);
        }

        .leads-page .lead-board-column {
          min-width: 0;
          overflow: hidden;
        }

        .leads-page .lead-board-column-title {
          min-width: 0;
          overflow: hidden;
          overflow-wrap: anywhere;
          line-height: 1.2;
        }

        .leads-page .lead-board-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .leads-page .lead-board-card * {
          min-width: 0;
        }

        .leads-page .lead-board-card input[type="checkbox"],
        .leads-page .lead-board-card .avatar {
          flex: 0 0 auto;
        }

        .leads-page .lead-work-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .leads-page .lead-horizontal-scrollbar {
          position: fixed;
          bottom: 0;
          z-index: 45;
          height: 18px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-top: 4px;
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.08), var(--surface) 48%);
          border-top: 1px solid var(--border);
          scrollbar-gutter: stable;
        }

        .leads-page .lead-horizontal-scrollbar::-webkit-scrollbar {
          height: 12px;
        }

        .leads-page .lead-horizontal-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: content-box;
        }

        .leads-page .lead-horizontal-scrollbar::-webkit-scrollbar-track {
          background: #e5e7eb;
          border-radius: 999px;
        }

        @media (max-width: 760px) {
          .leads-page {
            overflow-x: hidden;
          }

          .leads-page .page-header {
            align-items: flex-start;
            gap: 10px;
          }

          .leads-page .lead-status-grid {
            display: flex !important;
            gap: 8px !important;
            margin: 0 -10px 10px !important;
            overflow-x: auto;
            padding: 0 10px 4px;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }

          .leads-page .lead-status-card {
            flex: 0 0 auto;
            min-width: 112px;
            max-width: 150px;
            padding: 7px 9px !important;
            scroll-snap-align: start;
          }

          .leads-page .lead-status-count {
            font-size: 15px !important;
            line-height: 1.05;
          }

          .leads-page .lead-status-label {
            font-size: 10px !important;
            line-height: 1.15;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .leads-page .lead-quick-filters {
            flex-wrap: nowrap !important;
            margin: 0 -10px 10px !important;
            overflow-x: auto;
            padding: 0 10px 4px;
            -webkit-overflow-scrolling: touch;
          }

          .leads-page .lead-quick-filters .btn {
            flex: 0 0 auto;
            padding: 6px 9px !important;
            white-space: nowrap;
          }

          .leads-page .lead-filter-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .leads-page .lead-view-toggle {
            width: 100%;
          }

          .leads-page .lead-view-toggle .btn {
            flex: 1;
            justify-content: center;
          }

          .leads-page .lead-content-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(136px, 38vw) !important;
            gap: 8px !important;
          }

          .leads-page .lead-results {
            min-width: 0;
            width: 100%;
          }

          .leads-page .lead-calendar-card {
            align-self: start;
            padding: 8px !important;
            position: sticky !important;
            top: 8px !important;
            width: 100%;
            max-width: 100%;
          }

          .leads-page .table-container,
          .leads-page .table-scroll {
            width: 100%;
            max-width: none;
          }

          .leads-page .table {
            table-layout: fixed;
          }

          .leads-page .table th,
          .leads-page .table td {
            padding: 7px 6px;
          }

          .leads-page .table td:nth-child(3) .select {
            min-width: 0 !important;
            width: 100%;
            height: 28px !important;
            padding: 3px 5px !important;
            font-size: 10px;
          }

          .leads-page .lead-board-scroll {
            width: 100%;
            max-width: none;
            overflow-x: auto;
          }

          .leads-page .lead-calendar-card .section-title {
            font-size: 10px;
            margin-bottom: 6px;
          }

          .leads-page .lead-calendar-nav {
            gap: 4px;
            margin-bottom: 7px !important;
          }

          .leads-page .lead-calendar-nav .btn {
            padding: 3px 6px !important;
          }

          .leads-page .lead-calendar-nav strong {
            font-size: 11px;
            line-height: 1.1;
            text-align: center;
          }

          .leads-page .lead-calendar-weekdays {
            gap: 2px !important;
            font-size: 9px !important;
            margin-bottom: 4px !important;
          }

          .leads-page .lead-calendar-grid {
            gap: 2px !important;
          }

          .leads-page .lead-calendar-grid button {
            min-height: 24px !important;
            border-radius: 5px !important;
            font-size: 10px;
          }

          .leads-page .lead-selected-reminders {
            margin-top: 8px !important;
            padding-top: 8px !important;
          }

          .leads-page .lead-selected-reminders button {
            padding: 6px !important;
          }

          .leads-page .lead-selected-reminders strong,
          .leads-page .lead-selected-reminders div {
            font-size: 10px !important;
          }
        }

        @media (max-width: 420px) {
          .leads-page .page-body {
            padding-left: 8px;
            padding-right: 8px;
          }

          .leads-page .lead-content-grid {
            grid-template-columns: minmax(0, 1fr) 138px !important;
          }
        }
      `}</style>
      <div className="page-header">
        <div>
          <div className="page-title">{lt('leads')}</div>
          <div className="page-subtitle">{lt('total')}: {leads.length}. {lt('active')}: {activeLeadCount}. {lt('leads_subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TutorialVideoButton videoKey="leads" />
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
            const leadCount = statusCounts[item.name] || 0
            return (
              <div className="lead-status-card" key={item.id || item.name} style={{ border: `1px solid ${status === item.name ? colors.color : 'var(--border)'}`, background: status === item.name ? colors.bg : 'var(--surface)', borderRadius: 8, padding: 10 }}>
                <button
                  type="button"
                  onClick={() => !editingStatuses && setStatus(current => current === item.name ? '' : item.name)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: editingStatuses ? 'default' : 'pointer' }}
                >
                  <div className="lead-status-count" style={{ color: colors.color, fontWeight: 800, fontSize: 18 }}>{leadCount}</div>
                  {editingStatuses && item.id ? (
                    <input className="input" defaultValue={item.name} onBlur={event => event.target.value.trim() !== item.name && saveLeadStatus(item, { name: event.target.value })} style={{ height: 30, padding: '4px 8px', fontSize: 12, fontWeight: 700 }} />
                  ) : (
                    <div className="lead-status-label" style={{ fontSize: 12, fontWeight: 700 }}>{leadStatusLabel(lang, item.name)}</div>
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
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={deletingStatusId === item.id || leadCount > 0}
                      title={leadCount > 0 ? lt('status_delete_blocked').replace('{count}', String(leadCount)) : lt('delete_status')}
                      onClick={() => deleteLeadStatus(item)}
                      style={{ width: '100%', justifyContent: 'center', padding: '6px 10px', fontSize: 12 }}
                    >
                      {deletingStatusId === item.id ? lt('processing') : lt('delete_status')}
                    </button>
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

        <div className="lead-quick-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
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
              <strong>{lt('reasons')}: {leadStatusLabel(lang, status)}</strong>
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

        <div className="lead-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 190px 190px auto auto', gap: 10, marginBottom: 16 }}>
          <input className="input" placeholder={`🔍 ${lt('search_placeholder')}`} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{lt('all_statuses')}</option>
            {statusNames.map(item => <option key={item} value={item}>{leadStatusLabel(lang, item)}</option>)}
          </select>
          <select className="select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">{lt('all_sources')}</option>
            {leadSources.map(item => <option key={item.value} value={item.value}>{leadSourceOptionLabel(lang, item)}</option>)}
          </select>
          <div ref={colMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowColMenu(current => !current)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 7, height: '100%', whiteSpace: 'nowrap' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
              {t('columns')} <span style={{ background: 'var(--brand)', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{visibleLeadColumnCount}/{totalLeadColumnCount}</span>
            </button>
            {showColMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: 'var(--shadow-md)', zIndex: 70, minWidth: 230, padding: '8px 0'
              }}>
                <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {t('visible_columns')}
                </div>
                {availableLeadColumns.map(col => {
                  const checked = visibleCols.includes(col.key)
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleCol(col.key)}
                      disabled={col.always}
                      style={{
                        width: '100%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', cursor: col.always ? 'default' : 'pointer', opacity: col.always ? 0.55 : 1,
                        textAlign: 'left', color: 'var(--text)'
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 4, border: '2px solid',
                        borderColor: checked ? 'var(--brand)' : 'var(--border)',
                        background: checked ? 'var(--brand)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: 'white', fontSize: 12, lineHeight: 1
                      }}>
                        {checked ? '✓' : ''}
                      </span>
                      <span style={{ fontSize: 13 }}>{lt(col.labelKey)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
              <select className="select" defaultValue="" disabled={bulkSaving} onChange={event => event.target.value && bulkPatch({ employeeId: event.target.value === '__none' ? '' : event.target.value })}>
                <option value="">{lt('bulk_responsible')}</option>
                <option value="__none">{lt('not_assigned')}</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
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
          <div className="lead-results lead-results-shell">
            <div className="table-container">
              <div ref={leadWorkScrollRef} className="table-scroll lead-work-scroll" onScroll={syncLeadContentScroll}>
                <table className="table lead-table" style={{ minWidth: leadTableMinWidth, width: `max(100%, ${leadTableMinWidth}px)` }}>
                <colgroup>
                  <col style={{ width: LEAD_SELECT_COLUMN_WIDTH }} />
                  {visibleLeadColumns.map(key => <col key={key} style={{ width: LEAD_TABLE_COLUMN_WIDTHS[key] }} />)}
                </colgroup>
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
                    {isColumnVisible('lead') && <th>{sortHeader('lead', lt('lead'))}</th>}
                    {isColumnVisible('status') && <th>{sortHeader('status', lt('status'))}</th>}
                    {isColumnVisible('reason') && <th>{lt('reason')}</th>}
                    {isColumnVisible('source') && <th>{sortHeader('source', lt('source'))}</th>}
                    {isColumnVisible('interest') && <th>{sortHeader('interest', lt('interest'))}</th>}
                    {isColumnVisible('createdAt') && <th>{sortHeader('createdAt', lt('created'))}</th>}
                    {isColumnVisible('lastContact') && <th>{sortHeader('lastContact', lt('last_contact'))}</th>}
                    {isColumnVisible('nextContact') && <th>{sortHeader('nextContact', lt('next_contact'))}</th>}
                    {isColumnVisible('responsible') && <th>{sortHeader('responsible', lt('responsible'))}</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={visibleLeadColumnCount + 1} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{lt('loading')}</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={visibleLeadColumnCount + 1} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
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
                    const lastContactAt = latestLeadContactAt(lead)
                    const responsible = leadResponsibleName(lead)
                    return (
                      <tr key={lead.id} className={overdue ? 'lead-overdue-row' : undefined} onClick={() => openLeadCard(lead.id)} style={{ cursor: 'pointer' }}>
                        <td onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            aria-label={leadDisplayName(lead)}
                          />
                        </td>
                        {isColumnVisible('lead') && (
                          <td className="lead-table-lead-cell">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(lead)}</div>
                              <div className="lead-table-person">
                                <div className="lead-table-person-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                                  {temp && <span title={leadTemperatureLabel(lang, lead.urgency)} style={{ width: 8, height: 8, borderRadius: 999, background: temp.color, flex: '0 0 auto' }} />}
                                  <span>{leadDisplayName(lead)}</span>
                                </div>
                                <div className="lead-table-person-contact" style={{ fontSize: 12, color: 'var(--muted)' }}>{lead.phone || lead.email || lead.instagram || lead.facebook || lt('contact_not_set')}</div>
                              </div>
                            </div>
                          </td>
                        )}
                        {isColumnVisible('status') && (
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
                        )}
                        {isColumnVisible('reason') && (
                          <td className="lead-table-text-cell" style={{ fontSize: 13 }}>
                            {lead.statusReason ? (
                              <div>
                                <strong>{lead.statusReason}</strong>
                                {lead.statusReasonComment && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{lead.statusReasonComment}</div>}
                              </div>
                            ) : lt('no_value')}
                          </td>
                        )}
                        {isColumnVisible('source') && <td className="lead-table-text-cell" style={{ fontSize: 13 }}>{sourceLabel(lead.source)}</td>}
                        {isColumnVisible('interest') && <td className="lead-table-text-cell" style={{ fontSize: 13 }}>{lead.serviceInterest || lt('no_value')}</td>}
                        {isColumnVisible('createdAt') && <td className="lead-table-date-cell" style={{ fontSize: 13, color: 'var(--muted)' }}>{lead.createdAt ? formatLeadCreatedAt(lead.createdAt, locale) : lt('no_value')}</td>}
                        {isColumnVisible('lastContact') && (
                          <td className="lead-table-date-cell" style={{ fontSize: 13, color: lastContactAt ? 'var(--text)' : 'var(--muted)' }}>
                            {lastContactAt ? formatLeadCreatedAt(lastContactAt, locale) : lt('no_value')}
                          </td>
                        )}
                        {isColumnVisible('nextContact') && (
                          <td style={{ fontSize: 13 }}>
                            {lead.nextContactAt ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{formatLeadDateTime(lead.nextContactAt, locale)}</span>
                                  {(overdue || dueToday) && (
                                    <span className={overdue ? 'badge lead-overdue-badge' : 'badge'} style={overdue ? undefined : { background: '#fef3c7', color: '#92400e' }}>
                                      {overdue ? lt('overdue') : lt('due_today')}
                                    </span>
                                  )}
                                </div>
                                {lead.nextContactNote && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{lead.nextContactNote}</div>}
                              </div>
                            ) : lt('no_value')}
                          </td>
                        )}
                        {isColumnVisible('responsible') && <td className="lead-table-text-cell" style={{ fontSize: 13 }}>{responsible || lt('no_value')}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>
          ) : (
            <div className="lead-results lead-results-shell">
            <div ref={leadWorkScrollRef} className="lead-board-scroll lead-work-scroll" onScroll={syncLeadContentScroll} style={{ overflowX: 'auto', paddingBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statusNames.length}, minmax(230px, 1fr))`, gap: 12, minWidth: Math.max(320, statusNames.length * 240) }}>
                {orderedStatuses.map(item => {
                  const colors = statusColors(item)
                  const columnLeads = leadsByStatus[item.name] || []
                  return (
                    <div
                      className="lead-board-column"
                      key={item.id || item.name}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => droppedOnStatus(item.name)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, minHeight: 420, padding: 10 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <div className="lead-board-column-title" style={{ fontWeight: 800, color: colors.color }}>{leadStatusLabel(lang, item.name)}</div>
                        <span style={{ background: colors.bg, color: colors.color, borderRadius: 999, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>{columnLeads.length}</span>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {columnLeads.length === 0 ? (
                          <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>{lt('drag_lead_here')}</div>
                        ) : columnLeads.map(lead => {
                          const temp = temperatureMeta(lead.urgency)
                          const responsible = leadResponsibleName(lead)
                          const overdue = isOverdue(lead.nextContactAt) && !isConvertedLead(lead)
                          return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={() => setDraggingLeadId(lead.id)}
                            onDragEnd={() => setDraggingLeadId(null)}
                            onClick={() => openLeadCard(lead.id)}
                            className={`lead-board-card${overdue ? ' lead-overdue-card' : ''}`}
                            style={{ background: overdue ? undefined : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'grab', boxShadow: 'var(--shadow)' }}
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
                                <div className={overdue ? 'lead-overdue-muted' : undefined} style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.phone || lead.email || lead.instagram || lt('contact_not_set')}</div>
                              </div>
                            </div>
                            {lead.serviceInterest && <div style={{ fontSize: 12, marginBottom: 6 }}>{lead.serviceInterest}</div>}
                            {responsible && <div className={overdue ? 'lead-overdue-muted' : undefined} style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>{responsible}</div>}
                            {lead.statusReason && <div className={overdue ? 'lead-overdue-muted' : undefined} style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>{lt('reason_prefix')}: {lead.statusReason}</div>}
                            {lead.nextContactAt && (
                              <div className={overdue ? 'lead-overdue-date' : undefined} style={{ color: overdue ? undefined : 'var(--muted)', fontSize: 12, fontWeight: overdue ? 800 : 500 }}>
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
            </div>
          )}

          <div className="card lead-calendar-card" style={{ position: 'sticky', top: 16 }}>
            <div className="section-title"><span>◷</span>{lt('leads_calendar')}</div>
            <div className="lead-calendar-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(-1)}>‹</button>
              <strong>{calendarMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(1)}>›</button>
            </div>
            <div className="lead-calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8, color: 'var(--muted)', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
              {LEAD_WEEKDAYS[lang].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="lead-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
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
            <div className="lead-selected-reminders" style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
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
                      onClick={() => lead.reminderKind === 'deadline' || lead.reminderKind === 'manual' ? openLeadCard(lead.id) : openReminder(lead)}
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
      {leadHorizontalScrollbar}
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
              <Link href={leadHref(activeReminder.id)} className="btn btn-secondary">{lt('open_card')}</Link>
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
