'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/context/LanguageContext'

function clientLabel(client: any) {
  return `${client?.firstName || ''} ${client?.lastName || ''}`.trim()
}

function ClientCombobox({
  clients,
  value,
  onSelect,
  emptyLabel = 'Без клиента',
  placeholder = 'Начните вводить имя или фамилию',
  notFoundLabel = 'Клиенты не найдены',
}: {
  clients: any[]
  value: string
  onSelect: (clientId: string, client?: any) => void
  emptyLabel?: string
  placeholder?: string
  notFoundLabel?: string
}) {
  const selectedClient = clients.find((client: any) => client.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(selectedClient ? clientLabel(selectedClient) : '')
  }, [selectedClient?.id])

  const q = query.trim().toLowerCase()
  const results = q
    ? clients.filter((client: any) => `${client.firstName || ''} ${client.lastName || ''} ${client.phone || ''}`.toLowerCase().includes(q))
    : clients

  function choose(clientId: string) {
    const client = clients.find((item: any) => item.id === clientId)
    onSelect(clientId, client)
    setQuery(client ? clientLabel(client) : '')
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
          if (!e.target.value.trim()) onSelect('', undefined)
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 80, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)', maxHeight: 240, overflowY: 'auto' }}>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose('')} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}>
            {emptyLabel}
          </button>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>{notFoundLabel}</div>
          ) : results.map((client: any) => (
            <button key={client.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(client.id)} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderTop: '1px solid var(--border)', background: client.id === value ? 'var(--bg)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</div>
              {client.phone && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{client.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрель','Ноябрь','Декабрь']
const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL' } as const
const WEEKDAYS: Record<string, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  pl: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'],
}

export default function CalendarPage() {
  const { lang, t } = useLanguage()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [tasks, setTasks] = useState<any[]>([])
  const [priorities, setPriorities] = useState<any[]>([])
  const [selectedCell, setSelectedCell] = useState<{ day: number; month: number; year: number } | null>(null)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', clientId: '', priority: '', dueDate: '', reminderAt: '', reminderNote: '' })

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : []))
    fetch('/api/task-priorities').then(r => r.json()).then(d => setPriorities(Array.isArray(d) ? d : []))
    fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    fetch('/api/cases').then(r => r.json()).then(d => setCases(Array.isArray(d) ? d : []))
  }, [])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedCell(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedCell(null)
  }

  function getPriorityColor(priority: string) {
    return priorities.find(p => p.name === priority)?.color || '#6b7280'
  }

  function getClientName(client: any) {
    return `${client?.firstName || ''} ${client?.lastName || ''}`.trim()
  }

  const selectedClient = clients.find((client: any) => client.id === selectedClientId)
  const activeTasks = tasks.filter((task: any) => task.status !== 'done')
  const visibleTasks = selectedClient
    ? activeTasks.filter((task: any) => String(task.clientName || '').toLowerCase() === getClientName(selectedClient).toLowerCase())
    : activeTasks

  function dateStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function getTasksForDate(y: number, m: number, d: number) {
    const ds = dateStr(y, m, d)
    return visibleTasks.filter(t => t.dueDate?.slice(0, 10) === ds)
  }

  function getReminderTasksForDate(y: number, m: number, d: number) {
    const ds = dateStr(y, m, d)
    return visibleTasks.filter(t => {
      try { const desc = JSON.parse(t.description || '{}'); return desc.reminderAt?.slice(0, 10) === ds }
      catch { return false }
    })
  }

  function getAllForDate(y: number, m: number, d: number) {
    const due = getTasksForDate(y, m, d)
    const rem = getReminderTasksForDate(y, m, d).filter(r => !due.find(dt => dt.id === r.id))
    return [...due, ...rem]
  }

  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    cells.push({ day: d, month: pm, year: py, isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true })
  }
  let nextDay = 1
  while (cells.length < 42) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    cells.push({ day: nextDay++, month: nm, year: ny, isCurrentMonth: false })
  }

  const isToday = (c: typeof cells[0]) =>
    c.day === now.getDate() && c.month === now.getMonth() && c.year === now.getFullYear()

  const isSelected = (c: typeof cells[0]) =>
    selectedCell && c.day === selectedCell.day && c.month === selectedCell.month && c.year === selectedCell.year

  const selectedItems = selectedCell ? getAllForDate(selectedCell.year, selectedCell.month, selectedCell.day) : []

  function taskMeta(task: any) {
    try { return JSON.parse(task?.description || '{}') } catch { return {} }
  }

  function taskRelatedCaseId(task: any) {
    if (!task) return ''
    const meta = taskMeta(task)
    const refs = [meta.paymentPlan, meta.mosDocument, meta.autoReminder, meta.customCaseReminder, meta.quickCaseTask, meta.fingerprintsAppointment, meta.predictedDecision]
    const metaCaseId = refs.find((ref: any) => ref?.caseId)?.caseId
    if (metaCaseId) return metaCaseId
    const byNumber = cases.find((item: any) => {
      const number = String(item.caseNumber || '')
      return !!number && (
        String(task.title || '').includes(number) ||
        String(task.description || '').includes(number)
      )
    })?.id || ''
    if (byNumber) return byNumber

    const taskClientName = String(task.clientName || '').trim().toLowerCase()
    if (!taskClientName) return ''
    const matchingClients = clients.filter((client: any) => getClientName(client).toLowerCase() === taskClientName)
    if (matchingClients.length !== 1) return ''
    const clientCases = cases.filter((item: any) => item.clientId === matchingClients[0].id)
    return clientCases.length === 1 ? clientCases[0].id : ''
  }

  function openEdit(task: any) {
    let reminderAt = '', reminderNote = ''
    try { const d = JSON.parse(task.description || '{}'); reminderAt = d.reminderAt || ''; reminderNote = d.reminderNote || '' } catch {}
    setEditingTask({ ...task, dueDate: task.dueDate?.slice(0, 10) || '', reminderAt: reminderAt ? reminderAt.slice(0, 16) : '', reminderNote })
  }

  function setE(k: string, v: string) { setEditingTask((p: any) => ({ ...p, [k]: v })) }

  async function saveTask() {
    if (!editingTask) return
    setSaving(true)
    const meta = taskMeta(editingTask)
    await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editingTask.title,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate || null,
        clientName: editingTask.clientName || '',
        description: JSON.stringify({ ...meta, reminderAt: editingTask.reminderAt || null, reminderNote: editingTask.reminderNote || '' }),
      }),
    })
    const updated = await fetch('/api/tasks').then(r => r.json())
    setTasks(Array.isArray(updated) ? updated : [])
    setEditingTask(null)
    setSaving(false)
  }

  function setNF(k: string, v: string) { setNewForm(p => ({ ...p, [k]: v })) }

  function openNewTask(date?: string) {
    setNewForm({ title: '', clientId: '', priority: priorities[0]?.name || '', dueDate: date || '', reminderAt: '', reminderNote: '' })
    setShowNewTask(true)
  }

  async function createTask() {
    if (!newForm.title.trim()) return alert('Введите название задачи')
    const client = clients.find((c: any) => c.id === newForm.clientId)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newForm.title,
        priority: newForm.priority || priorities[0]?.name || 'Нормально',
        dueDate: newForm.dueDate || null,
        clientName: client ? `${(client as any).firstName} ${(client as any).lastName}` : '',
        description: JSON.stringify({ reminderAt: newForm.reminderAt || null, reminderNote: newForm.reminderNote || '' }),
      }),
    })
    const task = await res.json()
    setTasks(p => [task, ...p])
    setShowNewTask(false)
  }

  async function deleteTask(id: string) {
    if (!confirm('Удалить задачу?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
    setEditingTask(null)
  }

  const editingTaskCaseId = taskRelatedCaseId(editingTask)
  const locale = LOCALES[lang] || 'ru-RU'
  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const daysShort = WEEKDAYS[lang] || WEEKDAYS.ru

  return (
    <div className="fade-in">
      <style suppressHydrationWarning>{`
        /* ── Шапка календаря ── */
        .cal-header-nav {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cal-month-label {
          font-weight: 700;
          font-size: 17px;
          min-width: 170px;
          text-align: center;
        }

        /* ── Ячейка ── */
        .cal-cell {
          height: 96px;
          padding: 6px 6px 4px;
          cursor: pointer;
          transition: background 0.1s;
          overflow: hidden;
          box-sizing: border-box;
        }
        .cal-cell:hover { background: var(--bg) !important; }

        /* ── Чип задачи (десктоп) ── */
        .cal-chip {
          font-size: 10px;
          font-weight: 500;
          border-radius: 0 3px 3px 0;
          padding: 1px 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 2px;
        }

        /* ── Точки (мобиль) — скрыты на десктопе ── */
        .cal-dots {
          display: none;
        }

        /* ── Панель выбранного дня ── */
        .cal-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 16px;
        }
        .cal-side-panel {
          display: block;
        }

        /* ── Панель снизу на мобиле (скрыта по умолчанию) ── */
        .cal-bottom-panel {
          display: none;
        }

        /* ─── МОБИЛЬНАЯ ВЕРСИЯ ─────────────────── */
        @media (max-width: 768px) {

          /* Шапка: убираем min-width, компактнее */
          .cal-month-label {
            min-width: 120px;
            font-size: 15px;
          }

          /* Ячейки компактнее */
          .cal-cell {
            height: 64px;
            overflow: hidden;
            padding: 4px 3px 2px;
          }

          /* Чипы с текстом — скрыть */
          .cal-chip {
            display: none;
          }

          /* Точки — показать */
          .cal-dots {
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
            margin-top: 2px;
          }
          .cal-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          /* Боковая панель скрыта — используем нижнюю */
          .cal-layout {
            grid-template-columns: 1fr;
          }
          .cal-side-panel {
            display: none;
          }

          /* Нижняя панель на мобиле */
          .cal-bottom-panel {
            display: block;
            margin-top: 12px;
          }
        }

        /* ─── ТЕМНАЯ ТЕМА ─── */
        [data-theme="dark"] .cal-cell-current { background: var(--surface); }
        [data-theme="dark"] .cal-cell-other { background: var(--bg); }
        [data-theme="dark"] .cal-cell-selected { background: rgba(56,189,248,0.10) !important; }
        [data-theme="dark"] .cal-cell-today { background: rgba(56,189,248,0.07) !important; }
        [data-theme="dark"] .cal-header-bg { background: var(--bg); }
      `}</style>

      {/* Шапка страницы */}
      <div className="page-header">
        <div>
          <div className="page-title">{t('calendar_title')}</div>
          <div className="page-subtitle" style={{ display: 'none' }} id="cal-subtitle-desktop">{t('calendar_sub')}</div>
          <div className="page-subtitle">{t('calendar_sub')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => openNewTask(selectedCell ? `${selectedCell.year}-${String(selectedCell.month+1).padStart(2,'0')}-${String(selectedCell.day).padStart(2,'0')}` : '')}
            className="btn btn-primary"
            style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {t('new_task')}
          </button>
        </div>
        <div className="cal-header-nav">
          <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 16 }}>‹</button>
          <div className="cal-month-label">{monthLabel}</div>
          <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 16 }}>›</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} className="btn btn-ghost" style={{ fontSize: 13 }}>{t('today')}</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title"><span>👤</span>{t('filter_by_client')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 260px) minmax(220px, 1fr)', gap: 10 }}>
            <ClientCombobox
              clients={clients}
              value={selectedClientId}
              emptyLabel={t('all_clients')}
              placeholder={t('all_clients_placeholder')}
              notFoundLabel={t('not_found')}
              onSelect={clientId => setSelectedClientId(clientId)}
            />
          </div>
        </div>

        {/* Легенда */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          {priorities.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
              <span style={{ color: 'var(--muted)' }}>{p.name}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed' }} />
            <span style={{ color: 'var(--muted)' }}>{t('reminder_plain')}</span>
          </div>
        </div>

        {/* ── Основная сетка: десктоп — 2 колонки, мобиль — 1 ── */}
        <div className="cal-layout">

          {/* Календарная сетка */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Дни недели */}
            <div className="cal-header-bg" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {daysShort.map((d, i) => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: i >= 5 ? '#dc2626' : 'var(--muted)' }}>{d}</div>
              ))}
            </div>

            {/* Ячейки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((cell, idx) => {
                const allItems = getAllForDate(cell.year, cell.month, cell.day)
                const isCurrent = cell.isCurrentMonth
                const isTod = isToday(cell)
                const isSel = isSelected(cell)
                const dow = idx % 7
                const isWeekend = dow >= 5

                // Цвета фона ячейки
                let cellBg = isCurrent ? 'white' : '#fafafa'
                if (isTod) cellBg = '#fff9f0'
                if (isSel) cellBg = '#fff5f5'

                return (
                  <div
                    key={idx}
                    className={`cal-cell ${isSel ? 'cal-cell-selected' : isTod ? 'cal-cell-today' : isCurrent ? 'cal-cell-current' : 'cal-cell-other'}`}
                    onClick={() => setSelectedCell(isSel ? null : { day: cell.day, month: cell.month, year: cell.year })}
                    style={{
                      borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                      borderBottom: idx < 35 ? '1px solid var(--border)' : 'none',
                      borderLeft: isSel ? '2px solid var(--brand)' : '2px solid transparent',
                      background: cellBg,
                      opacity: isCurrent ? 1 : 0.6,
                    }}
                  >
                    {/* Номер дня */}
                    <div style={{
                      fontWeight: isTod ? 700 : isCurrent ? 400 : 300,
                      fontSize: 12,
                      color: isTod ? 'white' : isWeekend && isCurrent ? '#dc2626' : isCurrent ? 'var(--text)' : 'var(--muted)',
                      width: 22, height: 22, borderRadius: '50%',
                      background: isTod ? 'var(--brand)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 2,
                    }}>{cell.day}</div>

                    {/* ДЕСКТОП: чипы с текстом */}
                    <div style={{ overflow: "hidden", maxHeight: 56 }}>
                      {allItems.slice(0, 3).map((t, i) => {
                        const isDue = !!getTasksForDate(cell.year, cell.month, cell.day).find(dt => dt.id === t.id)
                        const color = !isDue ? '#7c3aed' : getPriorityColor(t.priority)
                        return (
                          <div key={t.id + i} className="cal-chip" style={{
                            background: color + '20',
                            color,
                            borderLeft: `2px solid ${color}`,
                          }}>
                            {!isDue ? '⏰ ' : ''}{t.title}
                          </div>
                        )
                      })}
                      {allItems.length > 3 && (
                        <div className="cal-chip" style={{ color: 'var(--muted)', background: 'transparent', border: 'none' }}>
                          +{allItems.length - 3} ещё
                        </div>
                      )}
                    </div>

                    {/* МОБИЛЬ: цветные точки */}
                    <div className="cal-dots">
                      {allItems.slice(0, 4).map((t, i) => {
                        const isDue = !!getTasksForDate(cell.year, cell.month, cell.day).find(dt => dt.id === t.id)
                        const color = !isDue ? '#7c3aed' : getPriorityColor(t.priority)
                        return <div key={t.id + i} className="cal-dot" style={{ background: color }} />
                      })}
                      {allItems.length > 4 && (
                        <div className="cal-dot" style={{ background: 'var(--muted)' }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ДЕСКТОП: боковая панель */}
          <div className="cal-side-panel">
            {selectedCell && <DayPanel
              selectedCell={selectedCell}
              selectedItems={selectedItems}
              year={year}
              getTasksForDate={getTasksForDate}
              getPriorityColor={getPriorityColor}
              openEdit={openEdit}
              onClose={() => setSelectedCell(null)}
              translate={t}
              locale={locale}
            />}
          </div>
        </div>

        {/* МОБИЛЬ: панель снизу */}
        {selectedCell && (
          <div className="cal-bottom-panel">
            <DayPanel
              selectedCell={selectedCell}
              selectedItems={selectedItems}
              year={year}
              getTasksForDate={getTasksForDate}
              getPriorityColor={getPriorityColor}
              openEdit={openEdit}
              onClose={() => setSelectedCell(null)}
              translate={t}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* Модалка новой задачи */}
      {showNewTask && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewTask(false) }}
        >
          <div style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{t('new_task')}</div>
              <button onClick={() => setShowNewTask(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="label">{t('task_name')} *</label>
              <input className="input" value={newForm.title} onChange={e => setNF('title', e.target.value)}
                placeholder={t('task_name')}
                onKeyDown={e => { if (e.key === 'Enter') createTask() }}
                autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">{t('priority')}</label>
                <select className="select" value={newForm.priority} onChange={e => setNF('priority', e.target.value)}>
                  {priorities.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">{t('task_client')}</label>
                <ClientCombobox
                  clients={clients}
                  value={newForm.clientId}
                  onSelect={clientId => setNF('clientId', clientId)}
                />
              </div>
              <div className="form-group">
                <label className="label">{t('deadline')}</label>
                <input className="input" type="date" value={newForm.dueDate} onChange={e => setNF('dueDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">⏰ {t('reminder_plain')}</label>
                <input className="input" type="datetime-local" value={newForm.reminderAt} onChange={e => setNF('reminderAt', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Примечание к напоминанию</label>
              <input className="input" value={newForm.reminderNote} onChange={e => setNF('reminderNote', e.target.value)} placeholder="Что нужно сделать..." />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={createTask} className="btn btn-primary">{t('create_task')}</button>
              <button onClick={() => setShowNewTask(false)} className="btn btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования */}
      {editingTask && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditingTask(null) }}
        >
          <div style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{t('edit_task')}</div>
              <button onClick={() => setEditingTask(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="label">{t('task_name')}</label>
              <input className="input" value={editingTask.title} onChange={e => setE('title', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">{t('priority')}</label>
                <select className="select" value={editingTask.priority} onChange={e => setE('priority', e.target.value)}>
                  {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">{t('task_client')}</label>
                <ClientCombobox
                  clients={clients}
                  value={editingTask.clientId || ''}
                  onSelect={(clientId, client) => {
                    setEditingTask((p: any) => ({ ...p, clientId, clientName: client ? `${client.firstName} ${client.lastName}` : '' }))
                  }}
                />
              </div>
              <div className="form-group">
                <label className="label">{t('deadline')}</label>
                <input className="input" type="date" value={editingTask.dueDate || ''} onChange={e => setE('dueDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">⏰ {t('reminder_plain')}</label>
                <input className="input" type="datetime-local" value={editingTask.reminderAt || ''} onChange={e => setE('reminderAt', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">{t('note')}</label>
              <input className="input" value={editingTask.reminderNote || ''} onChange={e => setE('reminderNote', e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveTask} className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? t('saving') : t('save')}</button>
              {editingTaskCaseId && (
                <button
                  onClick={() => { window.location.href = `/cases/${editingTaskCaseId}` }}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {t('go_to_case')}
                </button>
              )}
              <button onClick={() => setEditingTask(null)} className="btn btn-secondary">{t('cancel')}</button>
              <button onClick={() => deleteTask(editingTask.id)} className="btn" style={{ marginLeft: 'auto', background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer' }}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Компонент панели дня (переиспользуется для десктопа и мобиля) ──
function DayPanel({ selectedCell, selectedItems, year, getTasksForDate, getPriorityColor, openEdit, onClose, translate, locale }: any) {
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const monthName = new Date(selectedCell.year, selectedCell.month, 1).toLocaleDateString(locale || 'ru-RU', { month: 'long' })
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {selectedCell.day} {monthName} {selectedCell.year !== year ? selectedCell.year : ''}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>✕</button>
      </div>

      {selectedItems.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
          {translate('no_events')}
        </div>
      ) : selectedItems.map((t: any) => {
        const isDue = !!getTasksForDate(selectedCell.year, selectedCell.month, selectedCell.day).find((dt: any) => dt.id === t.id)
        const color = !isDue ? '#7c3aed' : getPriorityColor(t.priority)
        let reminderNote = ''
        try { const d = JSON.parse(t.description || '{}'); reminderNote = d.reminderNote || '' } catch {}

        return (
          <div key={t.id} onClick={() => openEdit(t)}
            style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 3, minHeight: 44, background: color, borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3, color: 'var(--text)' }}>{t.title}</div>
              {t.clientName && <div style={{ fontSize: 11, color: 'var(--muted)' }}>👤 {t.clientName}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 10, background: color + '18', color, padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                  {!isDue ? `⏰ ${translate('reminder_plain')}` : t.priority}
                </span>
                {reminderNote && !isDue && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{reminderNote}</span>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>✏️</div>
          </div>
        )
      })}
    </div>
  )
}
