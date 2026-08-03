'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import CollapsibleCardsBehavior from '@/components/CollapsibleCardsBehavior'
import SectionVisibilityBehavior from '@/components/SectionVisibilityBehavior'
import CustomSectionsRenderer, { type CustomSectionsHandle } from '@/components/CustomSectionsRenderer'
import { caseStatusLabel, isArchiveCaseStatus } from '@/lib/caseI18n'
import { VOIVODESHIP_OFFICE_GROUPS } from '@/lib/voivodeshipOffices'

const WORK_TYPE = 'Выконывание пацы (Работа)'
const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL' } as const

function VoivodeshipOfficeOptions() {
  return <>
    {VOIVODESHIP_OFFICE_GROUPS.map(group => (
      <optgroup key={group.voivodeship} label={group.voivodeship}>
        {group.offices.map(office => <option key={office} value={office}>{office}</option>)}
      </optgroup>
    ))}
  </>
}

export default function CaseDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t, lang } = useLanguage()
  const locale = LOCALES[lang] || 'ru-RU'
  const [c, setC] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [statuses, setStatuses] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [caseOptions, setCaseOptions] = useState<any[]>([])
  const [customDates, setCustomDates] = useState<any[]>([])
  const [docUpdates, setDocUpdates] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [documentTemplates, setDocumentTemplates] = useState<any[]>([])
  const [mosDocuments, setMosDocuments] = useState<any[]>([])
  const [caseTasks, setCaseTasks] = useState<any[]>([])
  const [tab, setTab] = useState('details')
  const [saving, setSaving] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paySpecialMethod, setPaySpecialMethod] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [paymentPlan, setPaymentPlan] = useState([{ amount: '', dueDate: '' }])
  const [plannedPayments, setPlannedPayments] = useState<any[]>([])
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [mosId, setMosId] = useState('')
  const [initialMosId, setInitialMosId] = useState('')
  const [selectedMosDocNames, setSelectedMosDocNames] = useState<string[]>([])
  const [submittingMosDocuments, setSubmittingMosDocuments] = useState(false)
  const [newMosDocName, setNewMosDocName] = useState('')
  const [newMosDocDueDate, setNewMosDocDueDate] = useState('')
  const [customReminderTitle, setCustomReminderTitle] = useState('')
  const [customReminderDate, setCustomReminderDate] = useState('')
  const [customReminderSaving, setCustomReminderSaving] = useState(false)
  const [mosAutoRemindersEnabled, setMosAutoRemindersEnabled] = useState(true)
  const [mosEmailFieldEnabled, setMosEmailFieldEnabled] = useState(false)
  const [comment, setComment] = useState('')
  const [form, setForm] = useState<any>({})
  const [uploading, setUploading] = useState(false)
  const [generatingTemplate, setGeneratingTemplate] = useState<number | null>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const customSectionsRef = useRef<CustomSectionsHandle>(null)
  const mosSelectionAnchorRef = useRef<number | null>(null)

  // Новые даты
  const [newDateLabel, setNewDateLabel] = useState('')
  const [newDateValue, setNewDateValue] = useState('')

  // Актуализация документов
  const [newDocDate, setNewDocDate] = useState('')
  const [newDocDesc, setNewDocDesc] = useState('')

  useEffect(() => {
    fetch('/api/organization-settings', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setMosAutoRemindersEnabled(data?.settings?.mosAutoRemindersEnabled !== false)
        setMosEmailFieldEnabled(data?.settings?.mosEmailFieldEnabled === true)
      })
      .catch(() => {
        setMosAutoRemindersEnabled(true)
        setMosEmailFieldEnabled(false)
      })

    fetch(`/api/cases/${id}`).then(r => r.json()).then(data => {
      setC(data)
      loadPlannedPayments(data)
      loadMosDocuments(data)
      loadCaseTasks(data)
      setCustomDates(data.customDates || [])
      setDocUpdates((data.docUpdates || []).filter((d: any) => !String(d.description || '').startsWith('__MOS_ID__:')))
      const loadedMosId = ((data.docUpdates || []).find((d: any) => String(d.description || '').startsWith('__MOS_ID__:'))?.description || '').replace('__MOS_ID__:', '')
      setMosId(loadedMosId)
      setInitialMosId(loadedMosId)
      setDocuments(data.caseDocuments || [])
      setForm({
        caseNumber: data.caseNumber || '',
        status: data.status || '',
        serviceId: data.serviceId?.toString() || '',
        stayPurpose: data.stayPurpose || '',
        stayType: data.stayType || '',
        contractType: data.contractType || '',
        contractDate: data.contractDate?.slice(0, 10) || '',
        contractNumber: data.contractNumber || '',
        contractSigned: data.contractSigned || false,
        totalValue: data.totalValue || 0,
        mosNumber: data.mosNumber || '',
        mosSentAt: data.mosSentAt?.slice(0, 10) || '',
        mosSentByPost: data.mosSentByPost || false,
        predictedDecisionDate: data.predictedDecisionDate?.slice(0, 10) || '',
        fingerprintsDate: data.fingerprintsDate?.slice(0, 10) || '',
        cabinetLogin: data.cabinetLogin || '',
        cabinetPassword: data.cabinetPassword || '',
        mosEmail: data.mosEmail || '',
        filingDate: data.filingDate?.slice(0, 10) || '',
        personalAppearDate: data.personalAppearDate?.slice(0, 10) || '',
        personalAppearLocation: data.personalAppearLocation || '',
        cardPickupDate: data.cardPickupDate?.slice(0, 10) || '',
        cardPickupTime: data.cardPickupTime || '',
        cardPickupLocation: data.cardPickupLocation || '',
        legalStayDeadline: data.legalStayDeadline?.slice(0, 10) || '',
        notes: data.notes || '',
        // Новые поля
        trustee: data.trustee || '',
        employeeId: data.employeeId?.toString() || '',
        workContractType: data.workContractType || '',
        workContractNumber: data.workContractNumber || '',
        workContractDate: data.workContractDate?.slice(0, 10) || '',
        workContractEndDate: data.workContractEndDate?.slice(0, 10) || '',
        workContractSigned: data.workContractSigned || false,
        staySubPurpose: data.staySubPurpose || '',
      })
    })
    fetch('/api/statuses').then(r => r.json()).then(d => setStatuses(Array.isArray(d) ? d : []))
    fetch('/api/services').then(r => r.json()).then(d => setServices(Array.isArray(d) ? d.filter((s: any) => s.active) : []))
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d.filter((e: any) => e.active) : []))
    fetch('/api/case-options').then(r => r.json()).then(d => setCaseOptions(Array.isArray(d) ? d : []))
    fetch('/api/document-templates').then(r => r.json()).then(d => setDocumentTemplates(Array.isArray(d.templates) ? d.templates : [])).catch(() => setDocumentTemplates([]))
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => setCurrentUser(data)).catch(() => setCurrentUser(null))
  }, [id])

  useEffect(() => {
    if (!c?.assignedTo || form.employeeId || employees.length === 0) return
    const assignedName = normalizePersonName(c.assignedTo.name || c.assignedTo.email)
    const matchingEmployee = employees.find((employee: any) => normalizePersonName(employee.name) === assignedName)
    if (matchingEmployee?.id) {
      setForm((prev: any) => prev.employeeId ? prev : { ...prev, employeeId: String(matchingEmployee.id) })
    }
  }, [c?.assignedTo?.id, employees, form.employeeId])

  function normalizePersonName(value: unknown) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  }

  function optionsByType(type: string) {
    const opts = caseOptions.filter((o: any) => o.type === type).sort((a: any, b: any) => a.order - b.order)
    return opts
  }

  function mosDocumentType(serviceId?: string | number | null) {
    return serviceId ? `mosDocument:${serviceId}` : 'mosDocument'
  }

  function mosDocumentsForService(serviceId?: string | number | null) {
    const serviceDocs = serviceId
      ? caseOptions.filter((o: any) => o.type === mosDocumentType(serviceId)).sort((a: any, b: any) => a.order - b.order)
      : []
    if (serviceDocs.length > 0) return serviceDocs
    return optionsByType('mosDocument')
  }

  function renderOptions(type: string, fallback: string[]) {
    const loaded = optionsByType(type)
    if (loaded.length > 0) return loaded.map((o: any) => <option key={o.id} value={o.value}>{o.value}</option>)
    return fallback.map(v => <option key={v} value={v}>{v}</option>)
  }

  function set(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })) }

  function dateOnly(value: any) {
    if (!value) return ''
    if (typeof value === 'string') return value.slice(0, 10)
    return new Date(value).toISOString().slice(0, 10)
  }

  function localDateKey(value: any) {
    if (!value) return ''
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const raw = String(value)
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return ''
    return localDateKey(date)
  }

  function formatDateForNote(value: string) {
    if (!value) return ''
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(locale)
  }

  function buildPlannedPaymentNote(plan: any, plannedDate: string, transferredDate: string) {
    const parts = [
      plan.note ? String(plan.note) : '',
      plannedDate ? `${t('payment_scheduled_for')}: ${formatDateForNote(plannedDate)}` : '',
      `${t('payment_transferred_on')}: ${formatDateForNote(transferredDate)}`,
    ].filter(Boolean)
    return parts.join(' | ')
  }

  async function save() {
    setSaving(true)
    try {
      const previous = c || {}
      const res = await fetch(`/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, employeeId: form.employeeId ? parseInt(form.employeeId) : null, staySubPurpose: form.staySubPurpose || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      const nextCase = { ...previous, ...updated, service: services.find(s => s.id === parseInt(form.serviceId)) || null }
      setC((prev: any) => ({ ...prev, ...nextCase }))
      const followUpTasks: Promise<any>[] = []
      if (mosId.trim() !== initialMosId.trim()) followUpTasks.push(saveMosId())
      const reminderBaseDate = form.filingDate || form.mosSentAt
      const filingDateChanged = dateOnly(previous.filingDate) !== form.filingDate || dateOnly(previous.mosSentAt) !== form.mosSentAt
      if (reminderBaseDate && mosAutoRemindersEnabled && filingDateChanged) {
        followUpTasks.push(createFilingReminders(reminderBaseDate))
      }
      if (dateOnly(previous.fingerprintsDate) !== form.fingerprintsDate) {
        followUpTasks.push(syncFingerprintsReminder(form.fingerprintsDate, nextCase))
      }
      if (dateOnly(previous.predictedDecisionDate) !== form.predictedDecisionDate) {
        followUpTasks.push(syncPredictedDecisionReminder(form.predictedDecisionDate, nextCase))
      }
      const customSave = customSectionsRef.current?.save() || Promise.resolve(true)
      const [customOk] = await Promise.all([customSave, ...followUpTasks])
      await loadCaseTasks(nextCase)
      if (customOk === false) alert(t('custom_fields_save_failed'))
    } catch (err: any) {
      alert(`${t('save_error') || 'Ошибка сохранения'}: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function refreshCase() {
    const data = await fetch(`/api/cases/${id}`).then(r => r.json())
    setC(data)
    await loadPlannedPayments(data)
    await loadMosDocuments(data)
    await loadCaseTasks(data)
    return data
  }

  function parseTaskDescription(description: string | null | undefined) {
    try { return JSON.parse(description || '{}') } catch { return {} }
  }

  function getTaskPaymentAmount(task: any, meta: any) {
    if (meta.paymentPlan?.amount) return String(meta.paymentPlan.amount)
    const match = String(task.title || '').match(/([\d.,]+)\s*zł/i)
    return match ? match[1].replace(',', '.') : ''
  }

  async function loadPlannedPayments(caseData = c) {
    if (!caseData?.id) {
      setPlannedPayments([])
      return
    }
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    if (!Array.isArray(tasks)) return
    const caseNumber = String(caseData.caseNumber || '')

    const planned = tasks
      .map((task: any) => ({ task, meta: parseTaskDescription(task.description) }))
      .filter(({ task, meta }: any) => {
        if (task.status === 'done') return false
        if (meta.paymentPlan?.caseId === caseData.id) return true
        return !!caseNumber
          && (String(task.title || '').startsWith('Получить платеж') || String(task.title || '').startsWith(t('receive_payment')))
          && String(meta.reminderNote || '').includes(caseNumber)
      })
      .map(({ task, meta }: any) => ({
        id: task.id,
        title: task.title,
        amount: getTaskPaymentAmount(task, meta),
        dueDate: task.dueDate?.slice(0, 10) || meta.reminderAt?.slice(0, 10) || '',
        note: meta.reminderNote || '',
      }))
      .sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)))

    setPlannedPayments(planned)
  }

  function addDays(date: string, days: number) {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  async function createTaskWithMeta(title: string, dueDate: string, reminderNote: string, extraMeta: any) {
    const clientName = `${c?.client?.firstName || ''} ${c?.client?.lastName || ''}`.trim()
    return fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        priority: 'Нормально',
        dueDate,
        clientName,
        description: JSON.stringify({
          reminderAt: dueDate ? `${dueDate}T09:00` : null,
          reminderNote,
          ...extraMeta,
        }),
      }),
    })
  }

  async function loadMosDocuments(caseData = c) {
    if (!caseData?.id) return
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    if (!Array.isArray(tasks)) return
    const docs = tasks
      .map((task: any) => ({ task, meta: parseTaskDescription(task.description) }))
      .filter(({ meta }: any) => meta.mosDocument?.caseId === caseData.id)
      .map(({ task, meta }: any) => ({
        id: task.id,
        title: task.title,
        status: task.status || 'todo',
        dueDate: task.dueDate?.slice(0, 10) || meta.reminderAt?.slice(0, 10) || '',
        sentAt: meta.mosDocument?.sentAt || '',
        note: meta.reminderNote || '',
      }))
      .sort((a: any, b: any) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    setMosDocuments(docs)
  }

  async function loadCaseTasks(caseData = c) {
    if (!caseData?.id) return
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    if (!Array.isArray(tasks)) return
    const caseNumber = String(caseData.caseNumber || '')
    const related = tasks
      .map((task: any) => ({ task, meta: parseTaskDescription(task.description) }))
      .filter(({ task, meta }: any) => {
        if (task.status === 'done' && meta.paymentPlan?.caseId === caseData.id) return false
        const metaValues = [
          meta.paymentPlan,
          meta.mosDocument,
          meta.autoReminder,
          meta.customCaseReminder,
          meta.quickCaseTask,
          meta.fingerprintsAppointment,
          meta.predictedDecision,
          meta.caseImportantDate,
        ]
        if (metaValues.some((item: any) => item?.caseId === caseData.id)) return true
        return caseNumber && (
          String(task.title || '').includes(caseNumber) ||
          String(task.description || '').includes(caseNumber)
        )
      })
      .map(({ task, meta }: any) => ({
        id: task.id,
        title: task.title,
        status: task.status || 'todo',
        priority: task.priority || '',
        dueDate: task.dueDate?.slice(0, 10) || meta.reminderAt?.slice(0, 10) || '',
        note: meta.reminderNote || '',
      }))
      .sort((a: any, b: any) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1
        return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'))
      })
    setCaseTasks(related)
  }

  async function addMosDocument() {
    if (!newMosDocName.trim()) return
    await createTaskWithMeta(
      `MOS: ${newMosDocName.trim()}`,
      newMosDocDueDate,
      `${t('send_document_to_mos')} ${c.caseNumber}`,
      { mosDocument: { caseId: c.id, caseNumber: c.caseNumber, sentAt: null } }
    )
    setNewMosDocName('')
    setNewMosDocDueDate('')
    await loadMosDocuments()
  }

  function toggleMosDocumentSelection(name: string, index: number, shiftKey: boolean) {
    setSelectedMosDocNames(current => {
      const next = new Set(current)
      const shouldSelect = !next.has(name)

      if (shiftKey && mosSelectionAnchorRef.current !== null) {
        const start = Math.min(mosSelectionAnchorRef.current, index)
        const end = Math.max(mosSelectionAnchorRef.current, index)
        availableMosDocuments.slice(start, end + 1).forEach((option: any) => {
          if (shouldSelect) next.add(option.value)
          else next.delete(option.value)
        })
      } else if (shouldSelect) {
        next.add(name)
      } else {
        next.delete(name)
      }

      mosSelectionAnchorRef.current = index
      return Array.from(next)
    })

    const today = new Date().toISOString().slice(0, 10)
    setNewMosDocDueDate(current => current || (form.mosSentAt && form.mosSentAt <= today ? form.mosSentAt : today))
  }

  function clearMosDocumentSelection() {
    setSelectedMosDocNames([])
    setNewMosDocDueDate('')
    mosSelectionAnchorRef.current = null
  }

  async function submitSelectedMosDocuments() {
    if (selectedMosDocNames.length === 0 || !newMosDocDueDate || submittingMosDocuments) return
    const today = new Date().toISOString().slice(0, 10)
    if (newMosDocDueDate > today) return alert(t('mos_future_date_error'))

    setSubmittingMosDocuments(true)
    try {
      const response = await fetch(`/api/cases/${c.id}/mos-documents/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          names: selectedMosDocNames,
          submittedAt: newMosDocDueDate,
          serviceId: form.serviceId || null,
          reminderNote: `${t('document_submitted_to_mos')} ${c.caseNumber || ''}`.trim(),
        }),
      })
      if (!response.ok) throw new Error('MOS documents submit failed')

      await Promise.all([loadMosDocuments(), loadCaseTasks()])
      clearMosDocumentSelection()
    } catch {
      alert(t('mos_documents_submit_failed'))
    } finally {
      setSubmittingMosDocuments(false)
    }
  }

  async function updateMosDocument(doc: any, updates: any) {
    const next = { ...doc, ...updates }
    await fetch(`/api/tasks/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: next.title,
        dueDate: next.dueDate || null,
        status: next.status,
        description: JSON.stringify({
          reminderAt: next.dueDate ? `${next.dueDate}T09:00` : null,
          reminderNote: next.note || `${t('send_document_to_mos')} ${c.caseNumber}`,
          mosDocument: { caseId: c.id, caseNumber: c.caseNumber, sentAt: next.sentAt || null },
        }),
      }),
    })
    await loadMosDocuments()
    await loadCaseTasks()
  }

  async function markMosDocumentSent(doc: any) {
    const today = new Date().toISOString().slice(0, 10)
    await updateMosDocument(doc, { status: 'done', sentAt: today })
  }

  async function deleteMosDocument(docId: string) {
    if (!confirm(t('delete_mos_document_confirm'))) return
    await fetch(`/api/tasks/${docId}`, { method: 'DELETE' })
    await loadMosDocuments()
    await loadCaseTasks()
  }

  async function createFilingReminders(filingDate: string) {
    if (!filingDate || !c?.id || !mosAutoRemindersEnabled) return
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    const existing = new Set(
      Array.isArray(tasks)
        ? tasks
          .map((task: any) => parseTaskDescription(task.description)?.autoReminder)
          .filter((meta: any) => meta?.caseId === c.id)
          .map((meta: any) => meta.kind)
        : []
    )
    const reminders = [
      { kind: 'documents_2w', days: 14, title: t('deliver_documents'), note: `${t('after_filing_2w')} ${c.caseNumber}` },
      { kind: 'id_1m', days: 30, title: t('get_id_to_mos'), note: `${t('after_filing_1m')} ${c.caseNumber}` },
      { kind: 'cabinet_login_2m', days: 60, title: t('ask_cabinet_credentials'), note: `${t('after_filing_2m')} ${c.caseNumber}` },
      { kind: 'check_status_4m', days: 120, title: t('check_cabinet_status'), note: `${t('after_filing_4m')} ${c.caseNumber}` },
    ]
    for (const reminder of reminders) {
      if (existing.has(reminder.kind)) continue
      await createTaskWithMeta(
        reminder.title,
        addDays(filingDate, reminder.days),
        reminder.note,
        { autoReminder: { caseId: c.id, caseNumber: c.caseNumber, kind: reminder.kind } }
      )
    }
  }

  async function syncPredictedDecisionReminder(decisionDate: string, caseData = c) {
    if (!caseData?.id) return
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    const parsedTasks = Array.isArray(tasks)
      ? tasks.map((task: any) => ({ task, meta: parseTaskDescription(task.description) }))
      : []
    const existing = parsedTasks.find(({ meta }: any) => meta.predictedDecision?.caseId === caseData.id)
    const existingDocumentsReminder = parsedTasks.find(({ meta }: any) => meta.predictedDecisionDocuments?.caseId === caseData.id)

    if (!decisionDate) {
      if (existing?.task?.id) await fetch(`/api/tasks/${existing.task.id}`, { method: 'DELETE' })
      if (existingDocumentsReminder?.task?.id) await fetch(`/api/tasks/${existingDocumentsReminder.task.id}`, { method: 'DELETE' })
      return
    }

    const clientName = `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim()
    const caseLabel = caseData.caseNumber || t('no_number')
    const payload = {
      title: 'Przewidywana data wydania decyzji',
      priority: existing?.task?.priority || 'Нормально',
      dueDate: decisionDate,
      clientName,
      status: existing?.task?.status || 'todo',
      description: JSON.stringify({
        reminderAt: `${decisionDate}T09:00`,
        reminderNote: `${t('expected_decision_note')} ${caseLabel}`,
        predictedDecision: { caseId: caseData.id, caseNumber: caseData.caseNumber || null },
      }),
    }

    if (existing?.task?.id) {
      await fetch(`/api/tasks/${existing.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    const documentsReminderDate = new Date(`${decisionDate}T00:00:00`)
    documentsReminderDate.setDate(documentsReminderDate.getDate() - 45)
    const documentsReminderDateOnly = documentsReminderDate.toISOString().slice(0, 10)
    const documentsPayload = {
      title: t('deliver_extra_documents_office'),
      priority: existingDocumentsReminder?.task?.priority || 'Нормально',
      dueDate: documentsReminderDateOnly,
      clientName,
      status: existingDocumentsReminder?.task?.status || 'todo',
      description: JSON.stringify({
        reminderAt: `${documentsReminderDateOnly}T09:00`,
        reminderNote: `${t('deliver_extra_documents_note')} ${caseLabel}`,
        predictedDecisionDocuments: {
          caseId: caseData.id,
          caseNumber: caseData.caseNumber || null,
          predictedDecisionDate: decisionDate,
          daysBefore: 45,
        },
      }),
    }

    if (existingDocumentsReminder?.task?.id) {
      await fetch(`/api/tasks/${existingDocumentsReminder.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentsPayload),
      })
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentsPayload),
      })
    }
  }

  async function syncFingerprintsReminder(fingerprintsDate: string, caseData = c) {
    if (!caseData?.id) return
    const tasks = await fetch('/api/tasks').then(r => r.json()).catch(() => [])
    const existing = Array.isArray(tasks)
      ? tasks
        .map((task: any) => ({ task, meta: parseTaskDescription(task.description) }))
        .find(({ meta }: any) => meta.fingerprintsAppointment?.caseId === caseData.id)
      : null

    if (!fingerprintsDate) {
      if (existing?.task?.id) await fetch(`/api/tasks/${existing.task.id}`, { method: 'DELETE' })
      return
    }

    const clientName = `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim()
    const caseLabel = caseData.caseNumber || t('no_number')
    const payload = {
      title: t('fingerprints_task_title'),
      priority: existing?.task?.priority || 'Нормально',
      dueDate: fingerprintsDate,
      clientName,
      status: existing?.task?.status || 'todo',
      description: JSON.stringify({
        reminderAt: `${fingerprintsDate}T09:00`,
        reminderNote: `${t('fingerprints_task_note')} ${caseLabel}`,
        fingerprintsAppointment: { caseId: caseData.id, caseNumber: caseData.caseNumber || null },
      }),
    }

    if (existing?.task?.id) {
      await fetch(`/api/tasks/${existing.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
  }

  async function createCustomReminder(e?: any) {
    e?.preventDefault()
    const title = customReminderTitle.trim()
    if (!title || !customReminderDate || customReminderSaving) return
    setCustomReminderSaving(true)
    try {
      const res = await createTaskWithMeta(
        title,
        customReminderDate,
      `${t('case_reminder_title')} ${c.caseNumber}`,
        { customCaseReminder: { caseId: c.id, caseNumber: c.caseNumber } }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setCustomReminderTitle('')
      setCustomReminderDate('')
      await loadCaseTasks()
      alert(t('reminder_added'))
    } catch (err: any) {
      alert(`${t('reminder_add_failed')}: ${err.message}`)
    }
    setCustomReminderSaving(false)
  }

  async function saveMosId() {
    const all = await fetch(`/api/cases/${id}`).then(r => r.json())
    const existing = (all.docUpdates || []).find((d: any) => String(d.description || '').startsWith('__MOS_ID__:'))
    if (existing) await fetch(`/api/cases/${id}/doc-updates/${existing.id}`, { method: 'DELETE' })
    if (mosId.trim()) {
      await fetch(`/api/cases/${id}/doc-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), description: `__MOS_ID__:${mosId.trim()}` }),
      })
    }
    setInitialMosId(mosId.trim())
  }

  async function addPayment() {
    if (!payAmount) return
    await fetch(`/api/cases/${id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: payAmount, note: payNote, specialMethod: paySpecialMethod }) })
    await refreshCase(); setPayAmount(''); setPayNote(''); setPaySpecialMethod(false)
  }

  function startEditPayment(p: any) {
    setEditingPayment({
      id: p.id,
      amount: p.amount?.toString() || '',
      note: p.note || '',
      specialMethod: p.specialMethod === true,
      date: p.date?.slice(0, 10) || new Date(p.date).toISOString().slice(0, 10),
    })
  }

  async function savePaymentEdit() {
    if (!editingPayment?.amount) return
    await fetch(`/api/cases/${id}/payments/${editingPayment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPayment),
    })
    await refreshCase()
    setEditingPayment(null)
  }

  async function deletePayment(paymentId: string) {
    if (!confirm(t('delete_payment_confirm'))) return
    await fetch(`/api/cases/${id}/payments/${paymentId}`, { method: 'DELETE' })
    await refreshCase()
  }

  function updatePlanRow(index: number, key: 'amount' | 'dueDate', value: string) {
    setPaymentPlan(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }

  async function createPaymentPlanTasks() {
    const rows = paymentPlan.filter(row => row.amount && row.dueDate)
    if (rows.length === 0) return alert(t('payment_plan_missing'))
    setCreatingPlan(true)
    const clientName = `${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim()
    const caseLabel = c.caseNumber || t('no_number')
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        title: `${t('receive_payment')} ${row.amount} zł`,
          priority: 'Нормально',
          dueDate: row.dueDate,
          clientName,
          description: JSON.stringify({
            reminderAt: `${row.dueDate}T09:00`,
          reminderNote: `${t('payment_number_note')} ${i + 1} ${t('payment_from_total')} ${rows.length}: ${caseLabel}`,
            paymentPlan: {
              caseId: c.id,
              caseNumber: c.caseNumber || null,
              amount: row.amount,
              index: i + 1,
              total: rows.length,
            },
          }),
        }),
      })
    }
    setPaymentPlan([{ amount: '', dueDate: '' }])
    await loadPlannedPayments()
    await loadCaseTasks()
    setCreatingPlan(false)
    alert(t('payment_plan_added'))
  }

  async function convertPlannedPayment(plan: any) {
    if (!plan.amount) return
    const plannedDate = localDateKey(plan.dueDate)
    const today = localDateKey(new Date())
    const paymentDate = plannedDate && plannedDate < today ? plannedDate : today
    const paymentRes = await fetch(`/api/cases/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: plan.amount,
        note: buildPlannedPaymentNote(plan, plannedDate, today),
        date: paymentDate,
      }),
    })
    if (!paymentRes.ok) {
      const err = await paymentRes.json().catch(() => ({}))
      alert(`${t('payment_convert_failed')}: ${err.error || paymentRes.status}`)
      return
    }
    await fetch(`/api/tasks/${plan.id}`, { method: 'DELETE' })
    await refreshCase()
    await loadCaseTasks()
  }

  async function createClientTask() {
    if (!taskTitle.trim()) return
    setTaskSaving(true)
    const clientName = `${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim()
    const caseLabel = c.caseNumber || t('no_number')
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle.trim(),
        priority: 'Нормально',
        dueDate: taskDueDate || null,
        clientName,
        description: JSON.stringify({
          reminderAt: taskDueDate ? `${taskDueDate}T09:00` : null,
          reminderNote: `${t('case_task_note')} ${caseLabel}`,
          quickCaseTask: { caseId: c.id, caseNumber: c.caseNumber || null },
        }),
      }),
    })
    setTaskTitle('')
    setTaskDueDate('')
    await loadCaseTasks()
    setTaskSaving(false)
    alert(t('task_created'))
  }

  async function addComment() {
    if (!comment.trim()) return
    const res = await fetch(`/api/cases/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment }) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`${t('comment_save_failed')}: ${err.error || res.status}`)
      return
    }
    await refreshCase(); setComment('')
  }

  async function addCustomDate() {
    if (!newDateLabel.trim()) return
    const res = await fetch(`/api/cases/${id}/custom-dates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newDateLabel.trim(), date: newDateValue || null }),
    })
    const d = await res.json()
    if (!res.ok) {
      alert(d.error || 'Не удалось добавить запись')
      return
    }
    setCustomDates(p => [...p, d])
    setNewDateLabel(''); setNewDateValue('')
  }

  async function removeCustomDate(dateId: number) {
    await fetch(`/api/cases/${id}/custom-dates/${dateId}`, { method: 'DELETE' })
    setCustomDates(p => p.filter((d: any) => d.id !== dateId))
  }

  async function addDocUpdate() {
    if (!newDocDate || !newDocDesc.trim()) return
    const res = await fetch(`/api/cases/${id}/doc-updates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDocDate, description: newDocDesc.trim() }),
    })
    const d = await res.json()
    setDocUpdates(p => [...p, d])
    setNewDocDate(''); setNewDocDesc('')
  }

  async function removeDocUpdate(updateId: number) {
    await fetch(`/api/cases/${id}/doc-updates/${updateId}`, { method: 'DELETE' })
    setDocUpdates(p => p.filter((d: any) => d.id !== updateId))
  }

  async function uploadFile(file: File) {
    const MAX_SIZE = 150 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert(`${t('file_too_large')}: "${file.name}" (${(file.size/1024/1024).toFixed(1)}MB). ${t('max_file_size')}.`)
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const docRes = await fetch(`/api/cases/${id}/documents`, { method: 'POST', body: formData })
      if (!docRes.ok) {
        const err = await docRes.json().catch(() => ({}))
        alert(`${t('document_upload_failed')}: ${err.error || docRes.status}`)
        setUploading(false)
        return
      }
      const doc = await docRes.json()
      setDocuments(p => [doc, ...p])
    } catch (e: any) { alert(`${t('upload_failed')}: ${e.message}`) }
    setUploading(false)
  }

  async function deleteDocument(docId: number) {
    if (!confirm(t('delete_document_confirm'))) return
    await fetch(`/api/cases/${id}/documents/${docId}`, { method: 'DELETE' })
    setDocuments(p => p.filter((d: any) => d.id !== docId))
  }

  async function deleteCase() {
    if (!confirm(t('delete_case_confirm'))) return
    const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || t('delete_case_failed'))
      return
    }
    router.push('/cases')
  }

  async function generateDocument(template: any) {
    setGeneratingTemplate(template.id)
    try {
      const res = await fetch(`/api/cases/${id}/generate-document?templateId=${template.id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
      alert(data.error || t('document_generate_failed'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/)
      const fileName = match ? decodeURIComponent(match[1]) : `${template.name}.docx`
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } finally {
      setGeneratingTemplate(null)
    }
  }

  async function downloadFile(url: string, name: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      // Fallback — открыть в новой вкладке
      window.open(url, '_blank')
    }
  }

  if (!c) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{t('loading')}</div>

  const debt = Math.max(0, c.totalValue - c.totalPaid)
  const currentService = services.find(s => s.id === parseInt(form.serviceId)) || c.service
  const isWorkType = form.stayType === WORK_TYPE || form.stayType?.includes('Работа') || form.stayType?.includes('пацы')
  const selectedEmployee = employees.find(e => e.id === parseInt(form.employeeId))
  const canDeleteCases = currentUser?.role === 'admin' || currentUser?.role === 'owner'
  const todayDate = new Date().toISOString().slice(0, 10)
  const cleanMosDocTitle = (title: string) => String(title || '').replace(/^MOS:\s*/, '').trim()
  const submittedMosDocuments = mosDocuments.filter((doc: any) => doc.status === 'done' || doc.sentAt)
  const submittedMosDocNames = new Set(submittedMosDocuments.map((doc: any) => cleanMosDocTitle(doc.title)))
  const mosDocumentOptions = mosDocumentsForService(form.serviceId)
  const availableMosDocuments = mosDocumentOptions.filter((opt: any) => !submittedMosDocNames.has(opt.value))
  const selectedMosDocNameSet = new Set(selectedMosDocNames)
  const allAvailableMosDocumentsSelected = availableMosDocuments.length > 0
    && availableMosDocuments.every((opt: any) => selectedMosDocNameSet.has(opt.value))

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/cases')} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <div>
            <div className="page-title" style={{ fontFamily: 'monospace', fontSize: 17 }}>{c.caseNumber || t('no_case_number')}</div>
            <div className="page-subtitle">{c.client?.firstName} {c.client?.lastName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canDeleteCases && isArchiveCaseStatus(c.status) && (
            <button onClick={deleteCase} className="btn btn-danger">
              {t('delete_case')}
            </button>
          )}
          <button onClick={save} className="btn btn-primary" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#eff6ff' }}><span style={{ fontSize: 20 }}>💰</span></div>
            <div><div className="stat-label">{t('cost')}</div><div className="stat-value">{c.totalValue?.toFixed(2)} zł</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}><span style={{ fontSize: 20 }}>✅</span></div>
            <div><div className="stat-label">{t('case_received')}</div><div className="stat-value" style={{ color: '#16a34a' }}>{c.totalPaid?.toFixed(2)} zł</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: debt > 0 ? '#fef2f2' : '#dcfce7' }}><span style={{ fontSize: 20 }}>{debt > 0 ? '📉' : '🎉'}</span></div>
            <div><div className="stat-label">{t('case_debt')}</div><div className="stat-value" style={{ color: debt > 0 ? '#dc2626' : '#16a34a' }}>{debt > 0 ? `${debt.toFixed(2)} zł` : t('paid')}</div></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div>
            {/* Табы */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', borderRadius: '10px 10px 0 0', padding: '0 4px', overflowX: 'auto' }}>
              {[
                ['details', `📋 ${t('details_tab')}`],
                ['payments', `💳 ${t('payments_tab')} (${c.payments?.length||0})`],
                ['comments', `💬 ${t('comments_tab')} (${c.comments?.length||0})`],
                ['docs', `📁 ${t('documents_tab')} (${documents.length})`],
              ].map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? 'var(--brand)' : 'var(--muted)',
                  borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
                }}>{label}</button>
              ))}
            </div>

            {tab === 'details' && (
              <div data-collapsible-scope="case-details">
                <CollapsibleCardsBehavior scope="case-details" />
                <SectionVisibilityBehavior scope="case" />
                {/* ── ОСНОВНЫЕ ДАННЫЕ ── */}
                <div className="card" data-collapse-key="case-basic" data-section-scope="case" data-section-key="case-basic" style={{ borderRadius: '0 0 10px 10px', marginBottom: 16 }}>
                  <div className="section-title"><span>📋</span>{t('case_detail_main')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="label">{t('case_number')}</label>
                      <input className="input" value={form.caseNumber} onChange={e => set('caseNumber', e.target.value)} style={{ fontFamily: 'monospace' }} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('status')}</label>
                      <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                        {statuses.map(s => <option key={s.id} value={s.name}>{caseStatusLabel(lang, s.name)}</option>)}
                        {statuses.length === 0 && ['Новый','В работе','Ожидание документов','Решение получено','Архив','Отказ'].map(s => <option key={s} value={s}>{caseStatusLabel(lang, s)}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="label">🛠 {t('service')}</label>
                      <select className="select" value={form.serviceId} onChange={e => set('serviceId', e.target.value)}>
                        <option value="">{t('choose_service')}</option>
                        {services.map(s => <option key={s.id} value={s.id.toString()}>{s.name}{s.price ? ` · ${s.price.toFixed(0)} zł` : ''}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">{t('cost')} (zł)</label>
                      <input className="input" type="number" value={form.totalValue} onChange={e => set('totalValue', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('stay_type')}</span>
                        <a href={`/settings/case-options?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                      </label>
                      <select className="select" value={form.stayType} onChange={e => set('stayType', e.target.value)}>
                        <option value="">—</option>
                        {renderOptions('stayType', ['Выконывание пацы (Работа)','Обучение','Воссоединение семьи','Бизнес','Другое'])}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('trustee')}</span>
                        <a href={`/settings/employees?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                      </label>
                      <select className="select" value={form.trustee} onChange={e => set('trustee', e.target.value)}>
                        <option value="">{t('not_specified')}</option>
                        {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('employee')}</span>
                        <a href={`/settings/employees?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                      </label>
                      <select className="select" value={form.employeeId} onChange={e => set('employeeId', e.target.value)}>
                        <option value="">{t('not_assigned')}</option>
                        {employees.map(e => <option key={e.id} value={e.id.toString()}>{e.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div data-custom-fields-slot="case:case-basic" />
                </div>

                {/* ── ГЛАВНАЯ ЦЕЛЬ ПРЕБЫВАНИЯ ── */}
                <div className="card" data-collapse-key="case-main-goal" data-section-scope="case" data-section-key="case-main-goal" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>🎯</span>{t('main_goal')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ gridColumn: form.stayPurpose?.includes('часовый') || form.stayPurpose?.includes('Временный') ? '1' : '1/-1' }}>
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('stay_purpose')}</span>
                        <a href={`/settings/case-options?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                      </label>
                      <select className="select" value={form.stayPurpose} onChange={e => { set('stayPurpose', e.target.value); if (!e.target.value.includes('часовый') && !e.target.value.includes('Временный')) set('staySubPurpose', '') }}>
                        <option value="">—</option>
                        {renderOptions('stayPurpose', ['Побыт часовый (Временный)','Побыт сталый (Постоянный)','Побыт длуготорминовы (Долгосрочный)'])}
                      </select>
                    </div>
                    {(form.stayPurpose?.includes('часовый') || form.stayPurpose?.includes('Временный')) && (
                      <div className="form-group">
                        <label className="label">{t('stay_basis')}</label>
                        <select className="select" value={form.staySubPurpose} onChange={e => set('staySubPurpose', e.target.value)}>
                          <option value="">{t('choose_basis')}</option>
                          <option>Wykonywanie pracy (Выполнение работы)</option>
                          <option>Wykonywanie pracy w zawodzie wymagającym wysokich kwalifikacji (Высококвалифицированная работа)</option>
                          <option>Mobilność długoterminowa posiadacza Niebieskiej Karty UE (Синяя карта ЕС)</option>
                          <option>Wykonywanie pracy przez cudzoziemca delegowanego (Командированный работник)</option>
                          <option>Prowadzenie działalności gospodarczej (Ведение бизнеса)</option>
                          <option>Podjęcie lub kontynuacja stacjonarnych studiów / kształcenie się w szkole doktorskiej (Обучение / докторантура)</option>
                          <option>Prowadzenie badań naukowych lub prac rozwojowych (Научные исследования)</option>
                          <option>Mobilność długoterminowa naukowca (Мобильность исследователя)</option>
                          <option>Odbycie stażu (Стажировка)</option>
                          <option>Udział w programie wolontariatu europejskiego (Волонтёрство ЕС)</option>
                          <option>Pobyt z obywatelem Rzeczypospolitej Polskiej (Пребывание с гражданином РП)</option>
                          <option>Pobyt z cudzoziemcem (Пребывание с иностранцем)</option>
                          <option>Mobilność długoterminowa członka rodziny naukowca (Мобильность члена семьи исследователя)</option>
                          <option>Okoliczności związane z byciem ofiarą handlu ludźmi (Жертва торговли людьми)</option>
                          <option>Okoliczności wymagające krótkotrwałego pobytu na terytorium RP (Краткосрочное пребывание)</option>
                          <option>Przedłużenie pobytu ze względu na pracę sezonową (Сезонная работа)</option>
                          <option>Inne okoliczności (należy określić jakie) (Иные обстоятельства)</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div data-custom-fields-slot="case:case-main-goal" />
                </div>

                {/* ── ТРУДОВОЙ ДОГОВОР (только если тип занятости = Работа) ── */}
                {isWorkType && (
                  <div className="card" data-collapse-key="case-work-contract" data-section-scope="case" data-section-key="case-work-contract" style={{ marginBottom: 16, borderLeft: '3px solid #3b82f6' }}>
                    <div className="section-title"><span>💼</span>{t('work_contract')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t('contract_type')}</span>
                          <a href={`/settings/case-options?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                        </label>
                        <select className="select" value={form.workContractType} onChange={e => set('workContractType', e.target.value)}>
                          <option value="">—</option>
                          {renderOptions('contractType', ['Умова злецения (Договор подряда)','Умова о працу (Трудовой)','Умова о дзело (Договор)'])}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label">{t('contract_number')}</label>
                        <input className="input" value={form.workContractNumber} onChange={e => set('workContractNumber', e.target.value)} placeholder="№ 001/2026" />
                      </div>
                      <div className="form-group">
                        <label className="label">{t('contract_date')}</label>
                        <input className="input" type="date" value={form.workContractDate} onChange={e => set('workContractDate', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="label">{t('contract_end_date')}</label>
                        <input className="input" type="date" value={form.workContractEndDate} onChange={e => set('workContractEndDate', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                        <input type="checkbox" id="wc_signed" checked={form.workContractSigned} onChange={e => set('workContractSigned', e.target.checked)} style={{ width: 18, height: 18 }} />
                        <label htmlFor="wc_signed" style={{ cursor: 'pointer', fontWeight: 500 }}>{t('contract_signed')}</label>
                      </div>
                    </div>
                    <div data-custom-fields-slot="case:case-work-contract" />
                  </div>
                )}

                {/* ── ДОГОВОР С АГЕНТСТВОМ ── */}
                <div className="card" data-collapse-key="case-agency-contract" data-section-scope="case" data-section-key="case-agency-contract" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>📄</span>{t('agency_contract')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('contract_type')}</span>
                        <a href={`/settings/case-options?returnTo=/cases/${id}`} style={{ fontSize: 11, color: 'var(--brand)' }}>{t('configure')}</a>
                      </label>
                      <select className="select" value={form.contractType} onChange={e => set('contractType', e.target.value)}>
                        <option value="">—</option>
                        {renderOptions('contractType', ['Умова злецения (Договор подряда)','Умова о працу (Трудовой)','Умова о дзело (Договор)'])}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">{t('contract_number')}</label>
                      <input className="input" value={form.contractNumber} onChange={e => set('contractNumber', e.target.value)} placeholder="№ 001/2026" />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('contract_date')}</label>
                      <input className="input" type="date" value={form.contractDate} onChange={e => set('contractDate', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                      <input type="checkbox" id="signed" checked={form.contractSigned} onChange={e => set('contractSigned', e.target.checked)} style={{ width: 18, height: 18 }} />
                      <label htmlFor="signed" style={{ cursor: 'pointer', fontWeight: 500 }}>{t('contract_signed')}</label>
                    </div>
                  </div>
                  <div data-custom-fields-slot="case:case-agency-contract" />
                </div>

                {/* ── MOS ── */}
                <div className="card" data-collapse-key="case-mos" data-section-scope="case" data-section-key="case-mos" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>#</span>{t('case_mos')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="label">{t('mos_number')}</label>
                      <input className="input" value={form.mosNumber} onChange={e => set('mosNumber', e.target.value)} placeholder="MOS-12345" />
                    </div>
                    <div className="form-group">
                      <label className="label">ID</label>
                      <input className="input" value={mosId} onChange={e => setMosId(e.target.value)} placeholder={t('mos_id_placeholder')} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('mos_sent_date')}</label>
                      <input className="input" type="date" value={form.mosSentAt} onChange={e => set('mosSentAt', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 4 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>{t('mos_documents')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: 12, minHeight: 220 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('submitted_documents')}</div>
                        {submittedMosDocuments.length === 0 ? (
                          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '38px 10px' }}>
                            {t('click_doc_when_submitted')}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {submittedMosDocuments.map((doc: any) => (
                              <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{cleanMosDocTitle(doc.title)}</div>
                                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {t('submitted')}: {doc.sentAt ? new Date(doc.sentAt).toLocaleDateString(locale) : t('date_not_set')}
                                  </div>
                                </div>
                                <button onClick={() => deleteMosDocument(doc.id)} className="btn" style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626' }}>{t('delete')}</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: 12, minHeight: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{t('documents_to_deliver')}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {availableMosDocuments.length > 0 && (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={allAvailableMosDocumentsSelected}
                                  disabled={submittingMosDocuments}
                                  onChange={() => {
                                    if (allAvailableMosDocumentsSelected) clearMosDocumentSelection()
                                    else {
                                      setSelectedMosDocNames(availableMosDocuments.map((opt: any) => opt.value))
                                      setNewMosDocDueDate(current => current || (form.mosSentAt && form.mosSentAt <= todayDate ? form.mosSentAt : todayDate))
                                      mosSelectionAnchorRef.current = 0
                                    }
                                  }}
                                  style={{ width: 16, height: 16 }}
                                />
                                {t('select_all')}
                              </label>
                            )}
                            <a href={`/settings/case-options?returnTo=/cases/${id}&mosServiceId=${form.serviceId || ''}`} style={{ fontSize: 12, color: 'var(--brand)' }}>{t('configure')}</a>
                          </div>
                        </div>
                        {mosDocumentOptions.length === 0 ? (
                          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '30px 10px' }}>
                            {t('empty_mos_documents')}
                          </div>
                        ) : availableMosDocuments.length === 0 ? (
                          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '38px 10px' }}>
                            {t('all_mos_documents_submitted')}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {availableMosDocuments.map((opt: any, index: number) => {
                              const selected = selectedMosDocNameSet.has(opt.value)
                              return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={event => toggleMosDocumentSelection(opt.value, index, event.shiftKey)}
                                aria-pressed={selected}
                                className="btn btn-secondary mos-document-option"
                                disabled={submittingMosDocuments}
                                style={{
                                  justifyContent: 'flex-start',
                                  textAlign: 'left',
                                  whiteSpace: 'normal',
                                  minHeight: 42,
                                  gap: 9,
                                  borderColor: selected ? 'var(--brand)' : 'var(--border)',
                                  background: selected ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg)',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  readOnly
                                  tabIndex={-1}
                                  aria-hidden="true"
                                  style={{ width: 16, height: 16, flex: '0 0 auto', pointerEvents: 'none' }}
                                />
                                <span>{opt.value}</span>
                              </button>
                              )
                            })}
                          </div>
                        )}
                        {selectedMosDocNames.length > 0 && (
                          <div style={{ marginTop: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                              {t('selected_documents')}: {selectedMosDocNames.length}
                            </div>
                            <div className="form-group" style={{ marginBottom: 10 }}>
                              <label className="label">{t('when_submitted')}</label>
                              <input className="input" type="date" max={todayDate} value={newMosDocDueDate} onChange={e => setNewMosDocDueDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={clearMosDocumentSelection}
                                className="btn btn-secondary"
                                disabled={submittingMosDocuments}
                                style={{ padding: '7px 12px' }}
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={submitSelectedMosDocuments}
                                className="btn btn-primary"
                                disabled={!newMosDocDueDate || newMosDocDueDate > todayDate || submittingMosDocuments}
                                style={{ padding: '7px 12px' }}
                              >
                                {submittingMosDocuments ? t('saving') : t('submit_selected_documents')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>{t('client_cabinet_access')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="label">{t('cabinet_login')}</label>
                        <input className="input" value={form.cabinetLogin || ''} onChange={e => set('cabinetLogin', e.target.value)} placeholder={t('cabinet_login')} />
                      </div>
                      <div className="form-group">
                        <label className="label">{t('cabinet_password')}</label>
                        <input className="input" value={form.cabinetPassword || ''} onChange={e => set('cabinetPassword', e.target.value)} placeholder={t('cabinet_password')} />
                      </div>
                    </div>
                  </div>

                  {mosEmailFieldEnabled && (
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 14 }}>
                      <div className="form-group" style={{ maxWidth: 520 }}>
                        <label className="label">{t('mos_email_address')}</label>
                        <input
                          className="input"
                          type="email"
                          value={form.mosEmail || ''}
                          onChange={e => set('mosEmail', e.target.value)}
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>{t('fingerprints_date')}</div>
                    <div className="form-group" style={{ maxWidth: 360 }}>
                      <label className="label">{t('fingerprints_date')}</label>
                      <input className="input" type="date" value={form.fingerprintsDate || ''} onChange={e => set('fingerprintsDate', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>{t('predicted_decision_date')}</div>
                    <div className="form-group" style={{ maxWidth: 360 }}>
                      <label className="label">{t('predicted_decision_date')}</label>
                      <input className="input" type="date" value={form.predictedDecisionDate || ''} onChange={e => set('predictedDecisionDate', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <div className="section-title" style={{ marginBottom: 10 }}>{t('additional_reminder')}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input className="input" value={customReminderTitle} onChange={e => setCustomReminderTitle(e.target.value)} placeholder={t('remind_about')} style={{ flex: 1, minWidth: 220 }} />
                      <input className="input" type="date" value={customReminderDate} onChange={e => setCustomReminderDate(e.target.value)} style={{ flex: '0 0 160px' }} />
                      <button
                        type="button"
                        onClick={createCustomReminder}
                        className="btn btn-secondary"
                        disabled={!customReminderTitle.trim() || !customReminderDate || customReminderSaving}
                      >
                        {customReminderSaving ? t('reminding') : t('remind')}
                      </button>
                    </div>
                  </div>
                  <div data-custom-fields-slot="case:case-mos" />
                </div>

                {/* ── ВАЖНЫЕ ДАТЫ ── */}
                <div className="card" data-collapse-key="case-important-dates" data-section-scope="case" data-section-key="case-important-dates" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>📅</span>{t('important_dates')}</div>
                  {/* Фиксированные даты */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="label">{t('filing_date')}</label>
                      <input className="input" type="date" value={form.filingDate} onChange={e => set('filingDate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('legal_stay_deadline')}</label>
                      <input className="input" type="date" value={form.legalStayDeadline} onChange={e => set('legalStayDeadline', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="label">{t('personal_visit')}</label>
                      <input className="input" type="date" value={form.personalAppearDate} onChange={e => set('personalAppearDate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('personal_visit_location')}</label>
                      <select className="select" value={form.personalAppearLocation} onChange={e => set('personalAppearLocation', e.target.value)}>
                        <option value="">{t('select_office')}</option>
                        <VoivodeshipOfficeOptions />
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="label">{t('card_pickup_date')}</label>
                      <input className="input" type="date" value={form.cardPickupDate} onChange={e => set('cardPickupDate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('card_pickup_time')}</label>
                      <input className="input" type="time" value={form.cardPickupTime} onChange={e => set('cardPickupTime', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('card_pickup_location')}</label>
                      <select className="select" value={form.cardPickupLocation} onChange={e => set('cardPickupLocation', e.target.value)}>
                        <option value="">{t('select_office')}</option>
                        <VoivodeshipOfficeOptions />
                      </select>
                    </div>
                  </div>

                  {/* Кастомные даты */}
                  {customDates.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {customDates.map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', minWidth: 140 }}>{d.label}</span>
                          <span style={{ fontSize: 13, flex: 1 }}>{d.date ? new Date(d.date).toLocaleDateString(locale) : t('date_not_set')}</span>
                          <button onClick={() => removeCustomDate(d.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Форма добавления новой даты */}
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t('add_date')}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input className="input" value={newDateLabel} onChange={e => setNewDateLabel(e.target.value)} placeholder={t('date_name_placeholder')} style={{ flex: 2, minWidth: 180 }} />
                      <input className="input" type="date" value={newDateValue} onChange={e => setNewDateValue(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                      <button onClick={addCustomDate} className="btn btn-primary" disabled={!newDateLabel.trim()}>{t('add')}</button>
                    </div>
                  </div>
                  <div data-custom-fields-slot="case:case-important-dates" />
                </div>

                {/* ── АКТУАЛИЗАЦИЯ ДОКУМЕНТАЦИИ ── */}
                <div className="card" data-collapse-key="case-doc-updates" data-section-scope="case" data-section-key="case-doc-updates" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>📝</span>{t('documentation_update')}</div>
                  {docUpdates.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>{t('no_doc_updates')}</div>
                  )}
                  {docUpdates.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      {[...docUpdates].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ minWidth: 90, fontSize: 12, color: 'var(--muted)', fontWeight: 600, paddingTop: 1 }}>{new Date(d.date).toLocaleDateString(locale)}</div>
                          <div style={{ flex: 1, fontSize: 13 }}>{d.description}</div>
                          <button onClick={() => removeDocUpdate(d.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626', flexShrink: 0 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ borderTop: docUpdates.length > 0 ? '1px dashed var(--border)' : 'none', paddingTop: docUpdates.length > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input className="input" type="date" value={newDocDate} onChange={e => setNewDocDate(e.target.value)} style={{ flex: '0 0 150px' }} />
                      <input className="input" value={newDocDesc} onChange={e => setNewDocDesc(e.target.value)} placeholder={t('doc_update_placeholder')} style={{ flex: 1, minWidth: 200 }} onKeyDown={e => e.key === 'Enter' && addDocUpdate()} />
                      <button onClick={addDocUpdate} className="btn btn-primary" disabled={!newDocDate || !newDocDesc.trim()}>{t('add')}</button>
                    </div>
                  </div>
                  <div data-custom-fields-slot="case:case-doc-updates" />
                </div>

                {/* ── ЗАМЕТКИ ── */}
                <div className="card" data-collapse-key="case-notes" data-section-scope="case" data-section-key="case-notes">
                  <div className="section-title"><span>📝</span>{t('notes')}</div>
                  <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} placeholder={t('notes_placeholder')} />
                  <div data-custom-fields-slot="case:case-notes" />
                </div>

                <CustomSectionsRenderer ref={customSectionsRef} scope="case" recordId={String(id)} standaloneSave={false} />
              </div>
            )}

            {tab === 'payments' && (
              <div>
                <div className="card" style={{ borderRadius: '0 0 10px 10px', marginBottom: 16 }}>
                  <div className="section-title"><span>➕</span>{t('add_payment_section')}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="input" type="number" placeholder={`${t('amount')} (zł)`} value={payAmount} onChange={e => setPayAmount(e.target.value)} step="0.01" style={{ maxWidth: 150 }} />
                    <input className="input" placeholder={t('note')} value={payNote} onChange={e => setPayNote(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                    <label title={t('special_payment_method')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 48, height: 38, border: '1px solid var(--border)', borderRadius: 8, background: paySpecialMethod ? '#ecfdf5' : 'var(--surface)', color: paySpecialMethod ? '#15803d' : 'var(--muted)', cursor: 'pointer', fontWeight: 800 }}>
                      <input type="checkbox" checked={paySpecialMethod} onChange={e => setPaySpecialMethod(e.target.checked)} aria-label={t('special_payment_method')} />
                      $
                    </label>
                    <button onClick={addPayment} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>{t('add')}</button>
                  </div>
                </div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="section-title"><span>📅</span>{t('payment_plan')}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {paymentPlan.map((row, index) => (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '160px 180px 40px', gap: 8, alignItems: 'center' }}>
                        <input className="input" type="number" placeholder={`${t('amount')} (zł)`} value={row.amount} onChange={e => updatePlanRow(index, 'amount', e.target.value)} step="0.01" />
                        <input className="input" type="date" value={row.dueDate} onChange={e => updatePlanRow(index, 'dueDate', e.target.value)} />
                        <button
                          onClick={() => setPaymentPlan(rows => rows.length === 1 ? rows : rows.filter((_, i) => i !== index))}
                          className="btn btn-ghost"
                          style={{ padding: '8px 10px', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setPaymentPlan(rows => [...rows, { amount: '', dueDate: '' }])} className="btn btn-secondary">+ {t('payment')}</button>
                    <button onClick={createPaymentPlanTasks} className="btn btn-primary" disabled={creatingPlan}>
                      {creatingPlan ? t('creating') : t('add_to_calendar')}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                    {t('payment_plan_hint')}
                  </div>
                </div>
                <div className="table-container" style={{ marginBottom: 16 }}>
                  <div style={{ padding: '14px 16px 0', fontWeight: 600 }}>{t('planned_payments')}</div>
                  <table className="table">
                    <thead><tr><th>{t('date')}</th><th>{t('amount')}</th><th>{t('reminder')}</th><th></th></tr></thead>
                    <tbody>
                      {plannedPayments.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>{t('no_planned_payments')}</td></tr>
                      ) : plannedPayments.map((plan: any) => (
                        <tr key={plan.id}>
                          <td>{plan.dueDate ? new Date(plan.dueDate).toLocaleDateString(locale) : '—'}</td>
                          <td style={{ fontWeight: 700 }}>{parseFloat(plan.amount || '0').toFixed(2)} zł</td>
                          <td>{plan.note || plan.title}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => convertPlannedPayment(plan)} className="btn btn-primary" style={{ padding: '6px 12px' }}>
                              {t('convert_to_paid')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-container">
                  <div style={{ padding: '14px 16px 0', fontWeight: 600 }}>{t('received_payments')}</div>
                  <table className="table">
                    <thead><tr><th>{t('date')}</th><th>{t('amount')}</th><th>{t('note')}</th><th style={{ width: 48, textAlign: 'center' }}>$</th><th></th></tr></thead>
                    <tbody>
                      {(c.payments||[]).length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>{t('no_payments')}</td></tr>
                      ) : (c.payments||[]).map((p: any) => (
                        <tr key={p.id}>
                          {editingPayment?.id === p.id ? (
                            <>
                              <td><input className="input" type="date" value={editingPayment.date} onChange={e => setEditingPayment((prev: any) => ({ ...prev, date: e.target.value }))} /></td>
                              <td><input className="input" type="number" value={editingPayment.amount} onChange={e => setEditingPayment((prev: any) => ({ ...prev, amount: e.target.value }))} step="0.01" /></td>
                              <td><input className="input" value={editingPayment.note} onChange={e => setEditingPayment((prev: any) => ({ ...prev, note: e.target.value }))} /></td>
                              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editingPayment.specialMethod === true} onChange={e => setEditingPayment((prev: any) => ({ ...prev, specialMethod: e.target.checked }))} aria-label={t('special_payment_method')} /></td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <button onClick={savePaymentEdit} className="btn btn-primary" style={{ padding: '6px 10px', marginRight: 6 }}>{t('save')}</button>
                                <button onClick={() => setEditingPayment(null)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>{t('cancel')}</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{new Date(p.date).toLocaleDateString(locale)}</td>
                              <td style={{ color: '#16a34a', fontWeight: 600 }}>+{p.amount.toFixed(2)} zł</td>
                              <td>{p.note || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{p.specialMethod ? <span title={t('special_payment_method')} style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontWeight: 900 }}>$</span> : '—'}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <button onClick={() => startEditPayment(p)} className="btn btn-ghost" style={{ padding: '6px 10px', marginRight: 6 }}>{t('edit')}</button>
                                <button onClick={() => deletePayment(p.id)} className="btn" style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626' }}>{t('delete')}</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'comments' && (
              <div>
                <div className="card" style={{ borderRadius: '0 0 10px 10px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" placeholder={t('write_comment')} value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                    <button onClick={addComment} className="btn btn-primary">{t('send')}</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(c.comments||[]).length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>{t('no_comments')}</div>
                  ) : (c.comments||[]).map((cm: any) => (
                    <div key={cm.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{cm.author}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(cm.createdAt).toLocaleString(locale)}</span>
                      </div>
                      <div style={{ fontSize: 14 }}>{cm.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'docs' && (
              <div>
                <div className="card" style={{ borderRadius: '0 0 10px 10px', marginBottom: 16 }}>
                  <div className="section-title"><span>📁</span>{t('client_documents')}</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--bg)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('generate_document')}</div>
                    {documentTemplates.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {t('template_upload_hint')}: <Link href="/settings/document-templates" style={{ color: 'var(--brand)', fontWeight: 600 }}>{t('document_templates')}</Link>.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {documentTemplates.map((template: any) => (
                          <button
                            key={template.id}
                            className="btn btn-secondary"
                            onClick={() => generateDocument(template)}
                            disabled={generatingTemplate === template.id}
                          >
                            {generatingTemplate === template.id ? t('generating') : template.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }}
                      onChange={async e => { for (const f of Array.from(e.target.files || [])) await uploadFile(f); if (fileInputRef.current) fileInputRef.current.value = '' }} />
                    <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary" disabled={uploading}>
                      {uploading ? `⏳ ${t('uploading_file')}` : `📎 ${t('upload_file')}`}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{t('file_upload_hint')}</span>
                  </div>

                  {documents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                      <div>{t('no_uploaded_documents')}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                      {documents.map((doc: any) => (
                        <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)', transition: 'box-shadow 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                          {/* Превью — кликабельно */}
                          <div onClick={() => setPreviewDoc(doc)} style={{ cursor: 'pointer', position: 'relative' }}>
                            {doc.fileType === 'image' ? (
                              <>
                                <img src={doc.url} alt={doc.name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
                                  <span style={{ fontSize: 28, opacity: 0, transition: 'opacity 0.2s' }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>🔍</span>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, background: '#eff6ff' }}>
                                <span style={{ fontSize: 40 }}>📄</span>
                                <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginTop: 4 }}>PDF</span>
                              </div>
                            )}
                          </div>
                          {/* Нижняя панель */}
                          <div style={{ padding: '8px 10px' }}>
                            <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}
                              title={doc.name}>{doc.name}</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => setPreviewDoc(doc)}
                                style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', cursor: 'pointer', fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>
                                👁 {t('open_file')}
                              </button>
                              <button onClick={() => downloadFile(doc.url, doc.name)}
                                style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', cursor: 'pointer', fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>
                                ⬇️ {t('download')}
                              </button>
                              <button onClick={() => deleteDocument(doc.id)}
                                style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── МОДАЛЬНЫЙ ПРОСМОТР ДОКУМЕНТА ── */}
            {previewDoc && (
              <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={e => { if (e.target === e.currentTarget) setPreviewDoc(null) }}
              >
                {/* Шапка модалки */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, width: '100%', maxWidth: 900 }}>
                  <div style={{ flex: 1, fontSize: 14, color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={previewDoc.name}>📄 {previewDoc.name}</div>
                  {/* Навигация между файлами */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        const idx = documents.findIndex((d: any) => d.id === previewDoc.id)
                        if (idx > 0) setPreviewDoc(documents[idx - 1])
                      }}
                      disabled={documents.findIndex((d: any) => d.id === previewDoc.id) === 0}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', color: 'white', fontSize: 16, opacity: documents.findIndex((d: any) => d.id === previewDoc.id) === 0 ? 0.3 : 1 }}>
                      ‹
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                      {documents.findIndex((d: any) => d.id === previewDoc.id) + 1} / {documents.length}
                    </span>
                    <button
                      onClick={() => {
                        const idx = documents.findIndex((d: any) => d.id === previewDoc.id)
                        if (idx < documents.length - 1) setPreviewDoc(documents[idx + 1])
                      }}
                      disabled={documents.findIndex((d: any) => d.id === previewDoc.id) === documents.length - 1}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', color: 'white', fontSize: 16, opacity: documents.findIndex((d: any) => d.id === previewDoc.id) === documents.length - 1 ? 0.3 : 1 }}>
                      ›
                    </button>
                  </div>
                  <button onClick={() => downloadFile(previewDoc.url, previewDoc.name)}
                    style={{ background: 'var(--brand)', color: 'white', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⬇️ {t('download')}
                  </button>
                  <a href={previewDoc.fileType === 'pdf' ? `/api/documents/${previewDoc.id}/file` : previewDoc.url} target="_blank" rel="noreferrer"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    🔗 {t('open_file')}
                  </a>
                  <button onClick={() => setPreviewDoc(null)}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                    ✕
                  </button>
                </div>

                {/* Контент */}
                {previewDoc.fileType === 'image' ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
                  />
                ) : (
                  <object
                    data={`/api/documents/${previewDoc.id}/file#toolbar=1&navpanes=0`}
                    type="application/pdf"
                    style={{ width: '100%', maxWidth: 900, height: 'calc(100vh - 120px)', borderRadius: 10, border: 'none', background: 'white' }}
                    aria-label={previewDoc.name}
                  >
                    <div style={{ width: '100%', maxWidth: 520, background: 'white', borderRadius: 10, padding: 22, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('pdf_preview_failed')}</div>
                      <a href={`/api/documents/${previewDoc.id}/file`} target="_blank" rel="noreferrer" className="btn btn-primary">{t('open_in_new_tab')}</a>
                    </div>
                  </object>
                )}
              </div>
            )}
          </div>

          {/* Боковая панель */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>👤</span>{t('client')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className="avatar">{c.client?.firstName?.[0]}{c.client?.lastName?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.client?.firstName} {c.client?.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.client?.phone}</div>
                </div>
              </div>
              <Link href={`/clients/${c.client?.id}?backTo=${encodeURIComponent(`/cases/${c.id}`)}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
                {t('client_card')}
              </Link>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>✅</span>{t('quick_task')}</div>
              <div className="form-group">
                <label className="label">{t('what_to_do')}</label>
                <input
                  className="input"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder={t('task_placeholder')}
                  onKeyDown={e => e.key === 'Enter' && createClientTask()}
                />
              </div>
              <div className="form-group">
                <label className="label">{t('date')}</label>
                <input className="input" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />
              </div>
              <button onClick={createClientTask} className="btn btn-primary" disabled={!taskTitle.trim() || taskSaving} style={{ width: '100%', justifyContent: 'center' }}>
                {taskSaving ? t('creating') : t('create_task_short')}
              </button>
            </div>

            {/* Ответственный сотрудник */}
            {selectedEmployee && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title"><span>🧑‍💼</span>{t('responsible_employee')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{selectedEmployee.name[0]}</div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedEmployee.name}</span>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>🛠</span>{t('service')}</div>
              {currentService ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentService.color || '#3b82f6', flexShrink: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{currentService.name}</div>
                  </div>
                  {currentService.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{currentService.description}</div>}
                  {currentService.price > 0 && <span className="badge" style={{ background: '#dcfce7', color: '#14532d' }}>{t('base_price')}: {currentService.price?.toFixed(0)} zł</span>}
                </div>
              ) : <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t('service_not_selected')}</div>}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>🔔</span>{t('tasks_notifications')}</div>
              {caseTasks.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t('no_case_tasks')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {caseTasks.map((task: any) => (
                    <div key={task.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{task.title}</div>
                        <span className="badge" style={{
                          background: task.status === 'done' ? '#dcfce7' : '#fef3c7',
                          color: task.status === 'done' ? '#166534' : '#92400e',
                          flexShrink: 0,
                        }}>
                          {task.status === 'done' ? t('done') : t('active')}
                        </span>
                      </div>
                      {task.dueDate && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {t('date')}: {new Date(task.dueDate).toLocaleDateString(locale)}
                        </div>
                      )}
                      {task.note && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.35 }}>
                          {task.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>🕐</span>{t('history')}</div>
              {(c.statusHistory||[]).length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t('no_history')}</div>
              ) : (c.statusHistory||[]).map((h: any, i: number) => (
                <div key={h.id} style={{ fontSize: 12, paddingBottom: 10, marginBottom: 10, borderBottom: i < c.statusHistory.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontWeight: 500 }}>{caseStatusLabel(lang, h.toStatus)}</div>
                  {h.fromStatus && <div style={{ color: 'var(--muted)' }}>{t('from_status')} «{caseStatusLabel(lang, h.fromStatus)}»</div>}
                  <div style={{ color: 'var(--muted)' }}>{h.changedBy} · {new Date(h.changedAt).toLocaleString(locale)}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="section-title"><span>ℹ️</span>{t('info')}</div>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>{t('created')}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString(locale)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>{t('updated')}</span>
                  <span>{new Date(c.updatedAt).toLocaleDateString(locale)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
