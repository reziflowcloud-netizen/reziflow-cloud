'use client'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface Task { id: string; title: string; priority: string; dueDate?: string; clientName?: string; description?: string; status?: string }
interface Priority { id: number; name: string; color: string; order: number }
interface Client { id: string; firstName: string; lastName: string; phone?: string }
interface Service { id: number; name: string; color?: string; active?: boolean }
interface CaseItem { id: string; caseNumber?: string | null; clientId: string; serviceId?: number | null; service?: { id: number; name: string; color?: string } | null }

function ClientCombobox({
  clients,
  value,
  onSelect,
  placeholder = 'Начните вводить имя или фамилию',
  allowEmpty = true,
  emptyLabel = 'Без клиента',
  notFoundLabel = 'Клиенты не найдены',
}: {
  clients: Client[]
  value: string
  onSelect: (clientId: string) => void
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
  notFoundLabel?: string
}) {
  const selectedClient = clients.find(client => client.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}`.trim() : '')
  }, [selectedClient?.id])

  const q = query.trim().toLowerCase()
  const results = q
    ? clients.filter(client => `${client.firstName || ''} ${client.lastName || ''} ${client.phone || ''}`.toLowerCase().includes(q))
    : clients

  function choose(clientId: string) {
    onSelect(clientId)
    const client = clients.find(item => item.id === clientId)
    setQuery(client ? `${client.firstName} ${client.lastName}`.trim() : '')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value.trim() && allowEmpty) onSelect('')
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 50,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {allowEmpty && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose('')}
              style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
            >
              {emptyLabel}
            </button>
          )}
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>{notFoundLabel}</div>
          ) : results.map(client => (
            <button
              key={client.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(client.id)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderTop: '1px solid var(--border)', background: client.id === value ? 'var(--bg)' : 'transparent', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</div>
              {client.phone && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{client.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function parseReminder(task: Task): { at: string | null; note: string } {
  try {
    const d = JSON.parse(task.description || '{}')
    return { at: d.reminderAt || null, note: d.reminderNote || '' }
  } catch { return { at: null, note: '' } }
}

function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

export default function TasksPage() {
  const { t } = useLanguage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cases, setCases] = useState<CaseItem[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'byClient'>('all')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPriorityManager, setShowPriorityManager] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [form, setForm] = useState({ title: '', clientId: '', priority: '', dueDate: '', reminderAt: '', reminderNote: '' })
  const [newPriorityName, setNewPriorityName] = useState('')
  const [newPriorityColor, setNewPriorityColor] = useState('#6b7280')
  const [editingPriority, setEditingPriority] = useState<any>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverPriority, setDragOverPriority] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const dragTask = useRef<Task | null>(null)
  // Touch drag state
  const touchDragTask = useRef<Task | null>(null)
  const touchGhost = useRef<HTMLDivElement | null>(null)
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768)
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : []))
    fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    fetch('/api/cases').then(r => r.json()).then(d => setCases(Array.isArray(d) ? d : []))
    fetch('/api/services').then(r => r.json()).then(d => setServices(Array.isArray(d) ? d.filter((s: Service) => s.active !== false) : []))
    fetch('/api/task-priorities').then(r => r.json()).then(d => {
      const list: Priority[] = Array.isArray(d) ? d : []
      setPriorities(list)
      if (list.length > 0) setForm(f => ({ ...f, priority: list[0].name }))
    })
  }, [])

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function setE(k: string, v: string) { setEditForm((p: any) => ({ ...p, [k]: v })) }
  function clientName(client: Client | undefined) {
    return client ? `${client.firstName} ${client.lastName}`.trim() : ''
  }
  function taskMeta(task: Task): any {
    try { return JSON.parse(task.description || '{}') } catch { return {} }
  }
  function taskMatchesCase(task: Task, item: CaseItem) {
    const meta = taskMeta(task)
    const refs = [meta.paymentPlan, meta.mosDocument, meta.autoReminder, meta.customCaseReminder, meta.quickCaseTask, meta.fingerprintsAppointment, meta.predictedDecision]
    if (refs.some((ref: any) => ref?.caseId === item.id)) return true
    const number = String(item.caseNumber || '')
    return !!number && (String(task.title || '').includes(number) || String(task.description || '').includes(number))
  }
  function taskMatchesClient(task: Task, client: Client) {
    const name = clientName(client).toLowerCase()
    if (!name) return false
    if (String(task.clientName || '').toLowerCase() === name) return true
    const clientCases = cases.filter(c => c.clientId === client.id)
    return clientCases.some(item => taskMatchesCase(task, item))
  }
  function taskRelatedCase(task: Task, sourceCases: CaseItem[]) {
    return sourceCases.find(item => taskMatchesCase(task, item))
  }
  function taskRelatedCaseId(task: Task | null) {
    if (!task) return ''
    const meta = taskMeta(task)
    const refs = [meta.paymentPlan, meta.mosDocument, meta.autoReminder, meta.customCaseReminder, meta.quickCaseTask, meta.fingerprintsAppointment, meta.predictedDecision]
    const metaCaseId = refs.find((ref: any) => ref?.caseId)?.caseId
    if (metaCaseId) return metaCaseId
    const byNumber = cases.find(item => taskMatchesCase(task, item))?.id
    if (byNumber) return byNumber

    const taskClientName = String(task.clientName || '').trim().toLowerCase()
    if (!taskClientName) return ''
    const matchingClients = clients.filter(client => clientName(client).toLowerCase() === taskClientName)
    if (matchingClients.length !== 1) return ''
    const clientCases = cases.filter(item => item.clientId === matchingClients[0].id)
    return clientCases.length === 1 ? clientCases[0].id : ''
  }

  // ─── Mouse Drag & Drop ─────────────────────────────────────
  function onDragStart(e: React.DragEvent<HTMLDivElement>, task: Task) {
    dragTask.current = task
    setDraggingId(task.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnd() {
    setDraggingId(null)
    setDragOverPriority(null)
    dragTask.current = null
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>, priority: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPriority(priority)
  }
  function onDragLeave() { setDragOverPriority(null) }
  async function onDrop(e: React.DragEvent<HTMLDivElement>, targetPriority: string) {
    e.preventDefault()
    setDragOverPriority(null)
    const task = dragTask.current
    if (!task || task.priority === targetPriority) return
    await moveToPriority(task, targetPriority)
  }

  // ─── Touch Drag & Drop ─────────────────────────────────────
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>, task: Task) {
    touchDragTask.current = task
    setDraggingId(task.id)

    // Create ghost element
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      background: white; border-radius: 10px; padding: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      font-size: 13px; font-weight: 500;
      max-width: 180px; opacity: 0.95;
      border-left: 3px solid ${priorities.find(p => p.name === task.priority)?.color || '#ccc'};
    `
    ghost.textContent = task.title
    document.body.appendChild(ghost)
    touchGhost.current = ghost

    const touch = e.touches[0]
    ghost.style.left = (touch.clientX - 90) + 'px'
    ghost.style.top = (touch.clientY - 30) + 'px'
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!touchDragTask.current) return
    e.preventDefault()
    const touch = e.touches[0]

    // Move ghost
    if (touchGhost.current) {
      touchGhost.current.style.left = (touch.clientX - 90) + 'px'
      touchGhost.current.style.top = (touch.clientY - 30) + 'px'
    }

    // Find which column we're over
    let found: string | null = null
    columnRefs.current.forEach((el, name) => {
      const rect = el.getBoundingClientRect()
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        found = name
      }
    })
    setDragOverPriority(found)
  }

  async function onTouchEnd() {
    const task = touchDragTask.current
    // Remove ghost
    if (touchGhost.current) {
      document.body.removeChild(touchGhost.current)
      touchGhost.current = null
    }
    if (task && dragOverPriority && task.priority !== dragOverPriority) {
      await moveToPriority(task, dragOverPriority)
    }
    touchDragTask.current = null
    setDraggingId(null)
    setDragOverPriority(null)
  }

  async function moveToPriority(task: Task, targetPriority: string) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: targetPriority } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        priority: targetPriority,
        dueDate: task.dueDate || null,
        clientName: task.clientName || '',
        description: task.description || '',
        status: task.status || 'todo',
      }),
    })
  }

  // ─── Task CRUD ────────────────────────────────────────
  async function createTask() {
    if (!form.title.trim()) return alert('Введите название задачи')
    const client = clients.find(c => c.id === form.clientId)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        priority: form.priority || (priorities[0]?.name ?? 'Нормально'),
        dueDate: form.dueDate || null,
        clientName: client ? `${client.firstName} ${client.lastName}` : '',
        description: JSON.stringify({ reminderAt: form.reminderAt || null, reminderNote: form.reminderNote || '' }),
      }),
    })
    const task = await res.json()
    setTasks(p => [task, ...p])
    setForm(f => ({ ...f, title: '', clientId: '', dueDate: '', reminderAt: '', reminderNote: '' }))
    setShowForm(false)
  }

  async function saveTask() {
    if (!editForm) return
    const meta = taskMeta(editForm)
    const res = await fetch(`/api/tasks/${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        priority: editForm.priority,
        dueDate: editForm.dueDate || null,
        clientName: editForm.clientName || '',
        description: JSON.stringify({ ...meta, reminderAt: editForm.reminderAt || null, reminderNote: editForm.reminderNote || '' }),
        status: editForm.status || 'todo',
      }),
    })
    const updated = await res.json()
    setTasks(p => p.map(t => t.id === updated.id ? updated : t))
    setSelectedTask(null)
  }

  async function deleteTask(id: string) {
    if (!confirm('Удалить задачу?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(p => p.filter(t => t.id !== id))
    setSelectedTask(null)
  }

  // ─── Priority CRUD ────────────────────────────────────
  async function addPriority() {
    if (!newPriorityName.trim()) return
    const res = await fetch('/api/task-priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPriorityName, color: newPriorityColor, order: priorities.length }),
    })
    const p = await res.json()
    setPriorities(prev => [...prev, p])
    setNewPriorityName('')
    setNewPriorityColor('#6b7280')
  }

  async function savePriority(p: Priority) {
    const res = await fetch(`/api/task-priorities/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingPriority.name, color: editingPriority.color }),
    })
    const updated = await res.json()
    setPriorities(prev => prev.map(x => x.id === updated.id ? updated : x))
    setEditingPriority(null)
  }

  async function deletePriority(id: number) {
    if (!confirm('Удалить раздел?')) return
    await fetch(`/api/task-priorities/${id}`, { method: 'DELETE' })
    setPriorities(prev => prev.filter(p => p.id !== id))
  }

  function openTask(task: Task) {
    const rem = parseReminder(task)
    setSelectedTask(task)
    setEditForm({
      ...task,
      dueDate: task.dueDate?.slice(0, 10) ?? '',
      reminderAt: rem.at ? rem.at.slice(0, 16) : '',
      reminderNote: rem.note,
    })
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const clientCases = cases.filter(item => item.clientId === selectedClientId)
  const selectedService = services.find(item => item.id.toString() === selectedServiceId)
  const serviceCases = selectedService
    ? clientCases.filter(item => item.serviceId === selectedService.id || item.service?.id === selectedService.id)
    : clientCases
  const visibleTasks = tasks.filter(task => task.status !== 'done')
  const filteredClientTasks = selectedService
    ? visibleTasks.filter(task => serviceCases.some(item => taskMatchesCase(task, item)))
    : selectedClient
      ? visibleTasks.filter(task => taskMatchesClient(task, selectedClient))
      : []
  const editTaskCaseId = taskRelatedCaseId(editForm)

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="fade-in">
      <style>{`
        .kanban-scroll {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(${Math.max(priorities.length, 1)}, minmax(200px, 1fr));
        }
        @media (max-width: 768px) {
          .kanban-scroll {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            padding-bottom: 12px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .kanban-col {
            min-width: 72vw;
            scroll-snap-align: start;
            flex-shrink: 0;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">{t('tasks_title')}</div>
          <div className="page-subtitle">{t('kanban')} · {t('total_tasks')}: {tasks.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPriorityManager(v => !v)} className="btn btn-secondary">{t('sections')}</button>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-primary">{showForm ? '✕ ' + t('close') : t('new_task')}</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('all')}
            className={activeTab === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            {t('all_tasks_tab')}
          </button>
          <button
            onClick={() => setActiveTab('byClient')}
            className={activeTab === 'byClient' ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            {t('by_client')}
          </button>
        </div>

        {/* Priority manager */}
        {showPriorityManager && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title"><span>⚙</span>Управление разделами</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input className="input" value={newPriorityName}
                onChange={e => setNewPriorityName(e.target.value)}
                placeholder="Название раздела" style={{ maxWidth: 260, flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') addPriority() }} />
              <input type="color" value={newPriorityColor}
                onChange={e => setNewPriorityColor(e.target.value)}
                style={{ height: 38, width: 52, padding: 3, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
              <button onClick={addPriority} className="btn btn-primary" disabled={!newPriorityName.trim()}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {priorities.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {editingPriority?.id === p.id ? (
                    <>
                      <input type="color" value={editingPriority.color}
                        onChange={e => setEditingPriority((ep: any) => ({ ...ep, color: e.target.value }))}
                        style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                      <input className="input" value={editingPriority.name}
                        onChange={e => setEditingPriority((ep: any) => ({ ...ep, name: e.target.value }))}
                        style={{ flex: 1, maxWidth: 240 }} autoFocus />
                      <button onClick={() => savePriority(p)} className="btn btn-primary" style={{ fontSize: 13, padding: '5px 12px' }}>💾</button>
                      <button onClick={() => setEditingPriority(null)} className="btn btn-secondary" style={{ fontSize: 13, padding: '5px 10px' }}>✕</button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color }} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 8 }}>{tasks.filter(t => t.priority === p.name).length} задач</span>
                      <button onClick={() => setEditingPriority({ ...p })}
                        style={{ background: '#e5e7eb', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                      <button onClick={() => deletePriority(p.id)}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>🗑</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New task form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title"><span>➕</span>{t('new_task')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0, gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                <label className="label">{t('task_name')} *</label>
                <input className="input" value={form.title}
                  onChange={e => setF('title', e.target.value)}
                  placeholder={t('task_name')}
                  onKeyDown={e => { if (e.key === 'Enter') createTask() }} />
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                <label className="label">{t('task_client')}</label>
                <ClientCombobox
                  clients={clients}
                  value={form.clientId}
                  placeholder={t('all_clients_placeholder')}
                  emptyLabel={t('no_client')}
                  notFoundLabel={t('not_found')}
                  onSelect={clientId => setF('clientId', clientId)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">{t('priority')}</label>
                <select className="select" value={form.priority} onChange={e => setF('priority', e.target.value)}>
                  {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">{t('deadline')}</label>
                <input className="input" type="date" value={form.dueDate} onChange={e => setF('dueDate', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createTask} className="btn btn-primary">{t('create_task')}</button>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        )}

        {activeTab === 'all' ? (
          <>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          {t('drag_task_hint')}
        </div>

        {/* Kanban columns */}
        <div className="kanban-scroll">
          {priorities.map(prio => {
            const pTasks = visibleTasks.filter(t => t.priority === prio.name)
            const isDragOver = dragOverPriority === prio.name

            return (
              <div key={prio.id}
                className="kanban-col"
                ref={el => { if (el) columnRefs.current.set(prio.name, el) }}
                onDragOver={e => onDragOver(e, prio.name)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, prio.name)}
                style={{
                  background: isDragOver ? prio.color + '18' : 'color-mix(in srgb, var(--surface) 82%, transparent)',
                  borderRadius: 10,
                  padding: 14,
                  minHeight: 200,
                  border: isDragOver ? `2px dashed ${prio.color}` : '1px solid var(--border)',
                  transition: 'all 0.15s',
                }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{
                    background: prio.color + '22',
                    color: prio.color,
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: `1px solid ${prio.color}44`,
                  }}>{prio.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pTasks.length}</span>
                </div>

                {isDragOver && (
                  <div style={{
                    border: `2px dashed ${prio.color}`,
                    borderRadius: 8,
                    padding: '12px 8px',
                    textAlign: 'center',
                    color: prio.color,
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 8,
                    background: prio.color + '08',
                  }}>
                    {t('drag_here')}
                  </div>
                )}

                {pTasks.length === 0 && !isDragOver && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>{t('no_tasks')}</div>
                )}

                {pTasks.map(task => {
                  const reminder = parseReminder(task)
                  const isDragging = draggingId === task.id
                  const overdueTask = isOverdue(task.dueDate)

                  return (
                    <div key={task.id}
                      draggable={!isMobile}
                      onDragStart={!isMobile ? e => onDragStart(e, task) : undefined}
                      onDragEnd={!isMobile ? onDragEnd : undefined}
                      onTouchStart={isMobile ? e => onTouchStart(e, task) : undefined}
                      onTouchMove={isMobile ? onTouchMove : undefined}
                      onTouchEnd={isMobile ? onTouchEnd : undefined}
                      onClick={() => { if (!isDragging) openTask(task) }}
                      className="kanban-card"
                      style={{
                        opacity: isDragging ? 0.4 : 1,
                        cursor: isMobile ? 'pointer' : 'grab',
                        transform: isDragging ? 'scale(0.97)' : 'none',
                        transition: 'opacity 0.15s, transform 0.15s',
                        userSelect: 'none',
                        borderLeft: `3px solid ${prio.color}`,
                        touchAction: isMobile ? 'none' : 'auto',
                      }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.4, flex: 1 }}>{task.title}</div>
                        <span style={{ color: '#d1d5db', fontSize: 14, marginLeft: 6, flexShrink: 0 }}>⠿</span>
                      </div>

                      {task.clientName && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>👤 {task.clientName}</div>
                      )}

                      {reminder.at && (
                        <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 2 }}>
                          ⏰ {new Date(reminder.at).toLocaleString('ru')}
                          {reminder.note && <span style={{ color: '#6b7280' }}> · {reminder.note}</span>}
                        </div>
                      )}

                      {task.dueDate && (
                        <div style={{ fontSize: 11, color: overdueTask ? '#dc2626' : 'var(--muted)', fontWeight: overdueTask ? 600 : 400 }}>
                          {overdueTask ? '⚠️ ' : '📅 '}{new Date(task.dueDate).toLocaleDateString('ru')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
          </>
        ) : (
          <div className="card">
            <div className="section-title"><span>👤</span>{t('by_client')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">{t('task_client')}</label>
                <ClientCombobox
                  clients={clients}
                  value={selectedClientId}
                  allowEmpty={false}
                  placeholder={t('all_clients_placeholder')}
                  emptyLabel={t('no_client')}
                  notFoundLabel={t('not_found')}
                  onSelect={clientId => {
                    setSelectedClientId(clientId)
                    setSelectedServiceId('')
                  }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">{t('service')}</label>
                <select
                  className="select"
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                  disabled={!selectedClientId}
                >
                  <option value="">{t('all_client_tasks')}</option>
                  {services.map(service => {
                    const count = clientCases.filter(item => item.serviceId === service.id || item.service?.id === service.id).length
                    return (
                    <option key={service.id} value={service.id}>
                      {service.name}{count > 0 ? ` · дел: ${count}` : ''}
                    </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {!selectedClientId ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '18px 0' }}>{t('select_client_to_see_tasks')}</div>
            ) : selectedService && serviceCases.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '18px 0' }}>
                У выбранного клиента пока нет дела по услуге «{selectedService.name}».
              </div>
            ) : filteredClientTasks.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '18px 0' }}>Для выбранного клиента или дела задач пока нет.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredClientTasks.map(task => {
                  const reminder = parseReminder(task)
                  const prio = priorities.find(p => p.name === task.priority)
                  const relatedCase = taskRelatedCase(task, selectedService ? serviceCases : clientCases)
                  return (
                    <button
                      key={task.id}
                      onClick={() => openTask(task)}
                      className="kanban-card"
                      style={{ textAlign: 'left', border: '1px solid var(--border)', borderLeft: `4px solid ${prio?.color || '#6b7280'}`, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
                        <span className="badge" style={{ background: (prio?.color || '#6b7280') + '22', color: prio?.color || '#6b7280' }}>{task.priority}</span>
                      </div>
                      {task.clientName && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>👤 {task.clientName}</div>}
                      {relatedCase && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          {relatedCase.service && (
                            <span className="badge" style={{ background: `${relatedCase.service.color || '#64748b'}20`, color: relatedCase.service.color || '#475569' }}>
                              {relatedCase.service.name}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
                            {relatedCase.caseNumber || 'номер не указан'}
                          </span>
                        </div>
                      )}
                      {task.dueDate && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📅 {new Date(task.dueDate).toLocaleDateString('ru')}</div>}
                      {reminder.at && <div style={{ fontSize: 12, color: '#7c3aed' }}>⏰ {new Date(reminder.at).toLocaleString('ru')}</div>}
                      {reminder.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{reminder.note}</div>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task edit modal */}
      {selectedTask !== null && editForm !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedTask(null) }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: isMobile ? '16px 16px 0 0' : 12,
            padding: isMobile ? '20px 16px 0' : 28,
            width: isMobile ? '100%' : 580,
            maxHeight: '85vh',
            overflowY: 'auto',
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 80px)' : 28,
          }}>
            {/* Drag handle on mobile */}
            {isMobile && (
              <div style={{ width: 40, height: 4, background: '#d1d5db', borderRadius: 2, margin: '0 auto 16px' }} />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{t('edit_task')}</div>
              <button onClick={() => setSelectedTask(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="label">{t('task_name')}</label>
              <input className="input" value={editForm.title} onChange={e => setE('title', e.target.value)} />
            </div>

            {/* Priority quick-switch on mobile */}
            {isMobile && (
              <div className="form-group">
                <label className="label">{t('priority')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {priorities.map(p => (
                    <button key={p.id}
                      onClick={() => setE('priority', p.name)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: `2px solid ${p.color}`,
                        background: editForm.priority === p.name ? p.color : 'transparent',
                        color: editForm.priority === p.name ? 'white' : p.color,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="label">{t('priority')} / {t('section')}</label>
                  <select className="select" value={editForm.priority} onChange={e => setE('priority', e.target.value)}>
                    {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">{t('task_client')}</label>
                  <ClientCombobox
                    clients={clients}
                    value={editForm.clientId || ''}
                    placeholder={t('all_clients_placeholder')}
                    emptyLabel={t('no_client')}
                    notFoundLabel={t('not_found')}
                    onSelect={clientId => {
                      const c = clients.find(cl => cl.id === clientId)
                      setEditForm((p: any) => ({ ...p, clientId, clientName: c ? `${c.firstName} ${c.lastName}` : '' }))
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">{t('deadline')}</label>
                <input className="input" type="date" value={editForm.dueDate || ''} onChange={e => setE('dueDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">⏰ {t('reminder_plain')}</label>
                <input className="input" type="datetime-local" value={editForm.reminderAt || ''} onChange={e => setE('reminderAt', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">{t('note')}</label>
              <input className="input" value={editForm.reminderNote || ''} onChange={e => setE('reminderNote', e.target.value)} placeholder={t('task_placeholder')} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveTask} className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
              {editTaskCaseId && (
                <button
                  onClick={() => { window.location.href = `/cases/${editTaskCaseId}` }}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {t('go_to_case')}
                </button>
              )}
              <button onClick={() => setSelectedTask(null)} className="btn btn-secondary">{t('cancel')}</button>
              <button onClick={() => deleteTask(selectedTask.id)}
                style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 500 }}>
                🗑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
