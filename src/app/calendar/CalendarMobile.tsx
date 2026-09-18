'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import TutorialVideoButton from '@/components/TutorialVideoButton'
import MobileEntityIcon from '@/components/mobile/MobileEntityIcon'
import styles from './CalendarMobile.module.css'

export type CalendarPriority = {
  id: number
  name: string
  color: string
  order?: number
}

export type CalendarClient = {
  id: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

export type CalendarCase = {
  id: string
  clientId?: string | null
  caseNumber?: string | null
  service?: { name?: string | null } | null
}

export type CalendarTask = {
  id: string
  title: string
  description?: string | null
  priority: string
  status?: string | null
  dueDate?: string | null
  clientName?: string | null
  assignedTo?: { id?: number; name?: string | null } | null
}

export type CalendarCell = {
  day: number
  month: number
  year: number
  isCurrentMonth: boolean
}

type Translate = (key: string) => string

type CalendarMobileProps = {
  t: Translate
  locale: string
  year: number
  month: number
  monthLabel: string
  daysShort: string[]
  cells: CalendarCell[]
  tasks: CalendarTask[]
  priorities: CalendarPriority[]
  clients: CalendarClient[]
  cases: CalendarCase[]
  selectedClientId: string
  onSelectedClientIdChange: (clientId: string) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onNewTask: (date?: string) => void
  onEditTask: (task: CalendarTask) => void
  getAllForDate: (year: number, month: number, day: number) => CalendarTask[]
  getTasksForDate: (year: number, month: number, day: number) => CalendarTask[]
  getPriorityColor: (priority: string) => string
  taskMeta: (task: CalendarTask) => Record<string, any>
  getDirectCaseId: (task: CalendarTask) => string
  scopeControl: ReactNode
  showResponsible: boolean
}

type CalendarEvent = {
  key: string
  dateKey: string
  timeLabel: string | null
  timeMinutes: number | null
  kind: 'due' | 'reminder'
  task: CalendarTask
}

function keyForDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function clientLabel(client: CalendarClient) {
  return `${client.firstName || ''} ${client.lastName || ''}`.trim()
}

function explicitTime(value: string) {
  const match = value.match(/[T\s](\d{2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { label: `${match[1]}:${match[2]}`, minutes: hours * 60 + minutes }
}

function isPassportDateOnlyReminder(
  task: CalendarTask,
  reminderAt: string,
  meta: Record<string, any>,
) {
  if (!reminderAt || explicitTime(reminderAt)?.minutes !== 0) return false

  const dueKey = String(task.dueDate || '').slice(0, 10)
  const reminderKey = reminderAt.slice(0, 10)
  if (!dueKey || !reminderKey) return false

  const title = String(task.title || '')
  const note = String(meta.reminderNote || '')
  const isGeneratedPassportReminder = title.startsWith('Окончание паспорта: ')
    && note.startsWith('Паспорт клиента ')
    && note.endsWith(' истекает через 90 дней')
  if (!isGeneratedPassportReminder) return false

  return reminderKey <= dueKey
}

function withAlpha(color: string, alpha: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : '#64748b'
  return `${normalized}${alpha}`
}

function Chevron() {
  return <span aria-hidden="true" className={styles.chevron}>›</span>
}

export default function CalendarMobile(props: CalendarMobileProps) {
  const today = new Date()
  const todayKey = keyForDate(today.getFullYear(), today.getMonth(), today.getDate())
  const [mode, setMode] = useState<'month' | 'list'>('month')
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const isCurrentMonth = props.year === today.getFullYear() && props.month === today.getMonth()
    setSelectedKey(isCurrentMonth ? todayKey : keyForDate(props.year, props.month, 1))
  }, [props.year, props.month, todayKey])

  useEffect(() => {
    function close(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) setActionsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = []
    for (const task of props.tasks) {
      const dueDate = String(task.dueDate || '')
      const dueKey = dueDate.slice(0, 10)
      const meta = props.taskMeta(task)
      const reminderAt = String(meta.reminderAt || '')
      const reminderKey = reminderAt.slice(0, 10)
      const reminderTime = isPassportDateOnlyReminder(task, reminderAt, meta)
        ? null
        : explicitTime(reminderAt)
      const sameDateReminderTime = reminderKey && reminderKey === dueKey ? reminderTime : null

      if (dueKey) {
        result.push({
          key: `${task.id}:due`,
          dateKey: dueKey,
          timeLabel: sameDateReminderTime?.label || null,
          timeMinutes: sameDateReminderTime?.minutes ?? null,
          kind: 'due',
          task,
        })
      }
      if (reminderKey && reminderKey !== dueKey) {
        result.push({
          key: `${task.id}:reminder`,
          dateKey: reminderKey,
          timeLabel: reminderTime?.label || null,
          timeMinutes: reminderTime?.minutes ?? null,
          kind: 'reminder',
          task,
        })
      }
    }
    return result.sort((a, b) => {
      const dateOrder = a.dateKey.localeCompare(b.dateKey)
      if (dateOrder) return dateOrder
      if (a.timeMinutes === null && b.timeMinutes !== null) return -1
      if (a.timeMinutes !== null && b.timeMinutes === null) return 1
      if (a.timeMinutes !== null && b.timeMinutes !== null && a.timeMinutes !== b.timeMinutes) {
        return a.timeMinutes - b.timeMinutes
      }
      return a.task.title.localeCompare(b.task.title)
    })
  }, [props.tasks, props.taskMeta])

  const selectedEvents = events.filter(event => event.dateKey === selectedKey)
  const listGroups = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>()
    for (const event of events) groups.set(event.dateKey, [...(groups.get(event.dateKey) || []), event])
    return Array.from(groups.entries())
  }, [events])

  const priorityByName = useMemo(
    () => new Map(props.priorities.map(priority => [priority.name, priority])),
    [props.priorities],
  )

  function selectToday() {
    setSelectedKey(todayKey)
    props.onToday()
  }

  function dateHeading(dateKey: string, includeYear = true) {
    if (dateKey === todayKey) return props.t('today')
    const date = new Date(`${dateKey}T12:00:00`)
    return new Intl.DateTimeFormat(props.locale, {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
    }).format(date)
  }

  function eventTime(event: CalendarEvent) {
    return event.timeLabel || props.t('calendar_all_day')
  }

  function isOverdue(event: CalendarEvent) {
    return event.dateKey < todayKey && event.task.status !== 'done'
  }

  function eventColor(event: CalendarEvent) {
    if (isOverdue(event)) return '#dc2626'
    if (event.kind === 'reminder') return '#7c3aed'
    return priorityByName.get(event.task.priority)?.color || props.getPriorityColor(event.task.priority)
  }

  function eventRelations(task: CalendarTask) {
    const caseId = props.getDirectCaseId(task)
    const caseRecord = caseId ? props.cases.find(item => item.id === caseId) : undefined
    const clientId = caseRecord?.clientId || ''
    const client = clientId ? props.clients.find(item => item.id === clientId) : undefined
    return { caseId, caseRecord, clientId, client }
  }

  function renderEvent(event: CalendarEvent) {
    const color = eventColor(event)
    const priority = priorityByName.get(event.task.priority)
    const meta = props.taskMeta(event.task)
    const note = String(meta.reminderNote || '').trim()
    const relations = eventRelations(event.task)
    const relationClientName = relations.client ? clientLabel(relations.client) : String(event.task.clientName || '').trim()
    const caseLabel = relations.caseRecord?.service?.name || relations.caseRecord?.caseNumber || ''
    const eventStyle = {
      '--event-color': color,
      '--event-tint': withAlpha(color, '14'),
    } as CSSProperties

    return (
      <article
        key={event.key}
        className={styles.eventCard}
        style={eventStyle}
        onClick={() => props.onEditTask(event.task)}
        tabIndex={0}
        onKeyDown={eventKey => {
          if (eventKey.target !== eventKey.currentTarget) return
          if (eventKey.key === 'Enter' || eventKey.key === ' ') {
            eventKey.preventDefault()
            props.onEditTask(event.task)
          }
        }}
      >
        <div className={styles.eventTime}>{eventTime(event)}</div>
        <div className={styles.eventMain}>
          <strong className={styles.eventTitle} title={event.task.title}>{event.task.title}</strong>
          {relationClientName && (
            relations.clientId ? (
              <Link href={`/clients/${relations.clientId}`} className={styles.relation} onClick={click => click.stopPropagation()}>
                <MobileEntityIcon type="person" /><span title={relationClientName}>{relationClientName}</span><Chevron />
              </Link>
            ) : (
              <div className={styles.contextLine}><MobileEntityIcon type="person" /><span title={relationClientName}>{relationClientName}</span></div>
            )
          )}
          {relations.caseId && (
            <Link href={`/cases/${relations.caseId}`} className={styles.relation} onClick={click => click.stopPropagation()}>
              <MobileEntityIcon type="case" /><span title={caseLabel || props.t('cases_title')}>{caseLabel || props.t('cases_title')}</span><Chevron />
            </Link>
          )}
          {note && <div className={styles.note} title={note}>{note}</div>}
          <div className={styles.badges}>
            {isOverdue(event) && <span className={styles.overdueBadge}>{props.t('calendar_overdue')}</span>}
            <span className={styles.priorityBadge} style={{ color, borderColor: withAlpha(color, 'a8'), background: withAlpha(color, '12') }}>
              {event.kind === 'reminder' ? props.t('reminder_plain') : (priority?.name || event.task.priority)}
            </span>
          </div>
          {props.showResponsible && event.task.assignedTo?.name && <div className={styles.note} style={{ textAlign: 'right' }}>👤 {event.task.assignedTo.name}</div>}
        </div>
        <span className={styles.editGlyph} aria-hidden="true">✎</span>
      </article>
    )
  }

  return (
    <section className={styles.mobileOnly} aria-label={props.t('calendar_title')} data-mobile-calendar>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1>{props.t('calendar_title')}</h1>
            <p>{props.t('calendar_sub')}</p>
          </div>
          <button type="button" className={styles.newTaskButton} onClick={() => props.onNewTask(selectedKey)}>
            <span aria-hidden="true">＋</span>{props.t('new_task').replace(/^\+\s*/, '')}
          </button>
          <div className={styles.actionsWrap} ref={actionsRef}>
            <button type="button" className={styles.actionsButton} aria-label={props.t('mobile_actions')} aria-expanded={actionsOpen} onClick={() => setActionsOpen(value => !value)}>•••</button>
            {actionsOpen && (
              <div className={styles.actionsMenu}>
                <TutorialVideoButton videoKey="calendar" className={styles.actionItem} />
                <button type="button" className={styles.actionItem} onClick={() => { selectToday(); setActionsOpen(false) }}>{props.t('today')}</button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.modeSwitch} role="tablist" aria-label={props.t('calendar_view')}>
          <button type="button" role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? styles.modeActive : ''} onClick={() => setMode('month')}>{props.t('calendar_month')}</button>
          <button type="button" role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? styles.modeActive : ''} onClick={() => setMode('list')}>{props.t('calendar_list')}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{props.scopeControl}</div>

        <div className={styles.controls}>
          <button type="button" className={styles.monthButton} onClick={props.onPreviousMonth} aria-label={props.t('calendar_previous_month')}>‹</button>
          <button type="button" className={styles.monthLabel} onClick={selectToday}>{props.monthLabel}</button>
          <button type="button" className={styles.monthButton} onClick={props.onNextMonth} aria-label={props.t('calendar_next_month')}>›</button>
          <label className={styles.clientFilter}>
            <MobileEntityIcon type="person" />
            <span className={styles.srOnly}>{props.t('filter_by_client')}</span>
            <select value={props.selectedClientId} onChange={event => props.onSelectedClientIdChange(event.target.value)}>
              <option value="">{props.t('all_clients')}</option>
              {props.clients.map(client => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.legend} aria-label={props.t('priority')}>
          {props.priorities.map(priority => (
            <span key={priority.id} className={styles.legendItem} style={{ '--priority-color': priority.color } as CSSProperties}>
              <i />{priority.name}
            </span>
          ))}
          <span className={styles.legendItem} style={{ '--priority-color': '#7c3aed' } as CSSProperties}>
            <i />{props.t('reminder_plain')}
          </span>
        </div>

        {mode === 'month' ? (
          <>
            <div className={styles.monthGrid}>
              <div className={styles.weekdays}>
                {props.daysShort.map((day, index) => <span key={day} className={index >= 5 ? styles.weekend : ''}>{day}</span>)}
              </div>
              <div className={styles.days}>
                {props.cells.map((cell, index) => {
                  const cellKey = keyForDate(cell.year, cell.month, cell.day)
                  const cellEvents = props.getAllForDate(cell.year, cell.month, cell.day)
                  const selected = cellKey === selectedKey
                  const currentDay = cellKey === todayKey
                  return (
                    <button
                      key={`${cellKey}:${index}`}
                      type="button"
                      className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.otherMonth : ''} ${selected ? styles.selectedDay : ''} ${currentDay ? styles.todayDay : ''}`}
                      aria-pressed={selected}
                      aria-label={`${cell.day} ${cellEvents.length ? `· ${cellEvents.length}` : ''}`}
                      onClick={() => setSelectedKey(cellKey)}
                    >
                      <span className={styles.dayNumber}>{cell.day}</span>
                      <span className={styles.markers}>
                        {cellEvents.slice(0, 3).map((task, markerIndex) => {
                          const isDue = props.getTasksForDate(cell.year, cell.month, cell.day).some(item => item.id === task.id)
                          const markerColor = isDue ? props.getPriorityColor(task.priority) : '#7c3aed'
                          return <i key={`${task.id}:${markerIndex}`} style={{ background: markerColor }} />
                        })}
                        {cellEvents.length > 3 && <em>+{cellEvents.length - 3}</em>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <section className={styles.agenda} aria-label={dateHeading(selectedKey)}>
              <div className={styles.agendaHeading}>
                <h2>{dateHeading(selectedKey, false)}</h2>
                <span>{selectedEvents.length} {props.t('calendar_events_count')}</span>
              </div>
              {selectedEvents.length ? (
                <div className={styles.eventList}>{selectedEvents.map(renderEvent)}</div>
              ) : (
                <div className={styles.emptyState}><span aria-hidden="true">▦</span><strong>{props.t('no_events')}</strong></div>
              )}
            </section>
          </>
        ) : (
          <section className={styles.listMode}>
            {listGroups.length ? listGroups.map(([dateKey, group]) => (
              <div className={styles.listGroup} key={dateKey}>
                <div className={styles.listHeading}>
                  <h2>{dateHeading(dateKey)}</h2><span>{group.length} {props.t('calendar_events_count')}</span>
                </div>
                <div className={styles.eventList}>{group.map(renderEvent)}</div>
              </div>
            )) : <div className={styles.emptyState}><span aria-hidden="true">▦</span><strong>{props.t('calendar_no_results')}</strong></div>}
          </section>
        )}
      </div>
    </section>
  )
}
