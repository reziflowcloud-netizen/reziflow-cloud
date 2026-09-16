'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { CompactMobileHeader, MobileChipRail, MobileEmptyState, MobilePageShell } from '@/components/mobile'
import type { Lang } from '@/lib/translations'
import styles from './TasksMobile.module.css'

export interface MobileTask {
  id: string
  title: string
  priority: string
  dueDate?: string
  clientName?: string
  description?: string
  status?: string
  assignedTo?: { id?: number; name?: string | null } | null
}

export interface MobileTaskPriority { id: number; name: string; color: string; order: number }
export interface MobileTaskClient { id: string; firstName: string; lastName: string; phone?: string }
export interface MobileTaskService { id: number; name: string; color?: string; active?: boolean }
export interface MobileTaskCase {
  id: string
  caseNumber?: string | null
  clientId: string
  serviceId?: number | null
  service?: { id: number; name: string; color?: string } | null
}

type ClientPickerConfig = {
  value: string
  onSelect: (clientId: string) => void
  allowEmpty?: boolean
  placeholder?: string
  emptyLabel?: string
  notFoundLabel?: string
}

type TasksMobileProps = {
  lang: Lang
  t: (key: string) => string
  tasks: MobileTask[]
  priorities: MobileTaskPriority[]
  clients: MobileTaskClient[]
  services: MobileTaskService[]
  activeTab: 'all' | 'byClient'
  selectedClientId: string
  selectedServiceId: string
  filteredClientTasks: MobileTask[]
  clientCases: MobileTaskCase[]
  serviceCases: MobileTaskCase[]
  selectedService?: MobileTaskService
  showForm: boolean
  showPriorityManager: boolean
  form: { title: string; clientId: string; priority: string; dueDate: string; reminderAt: string; reminderNote: string }
  selectedTask: MobileTask | null
  editForm: any
  editTaskCaseId: string
  editTaskClientId: string
  newPriorityName: string
  newPriorityColor: string
  editingPriority: any
  tutorialAction: ReactNode
  renderClientPicker: (config: ClientPickerConfig) => ReactNode
  getRelatedCase: (task: MobileTask) => MobileTaskCase | undefined
  getRelatedClient: (task: MobileTask) => MobileTaskClient | undefined
  onTabChange: (tab: 'all' | 'byClient') => void
  onClientChange: (clientId: string) => void
  onServiceChange: (serviceId: string) => void
  onToggleForm: () => void
  onTogglePriorityManager: () => void
  onFormChange: (key: string, value: string) => void
  onCreateTask: () => void
  onOpenTask: (task: MobileTask) => void
  onCloseTask: () => void
  onEditChange: (key: string, value: string) => void
  onEditClient: (clientId: string) => void
  onSaveTask: () => void
  onDeleteTask: (id: string) => void
  onMovePriority: (task: MobileTask, priority: string) => Promise<void>
  onNewPriorityName: (value: string) => void
  onNewPriorityColor: (value: string) => void
  onAddPriority: () => void
  onSetEditingPriority: (priority: any) => void
  onEditingPriorityChange: (value: any) => void
  onSavePriority: (priority: MobileTaskPriority) => void
  onDeletePriority: (id: number) => void
}

const COPY: Record<Lang, {
  all: string
  byClient: string
  total: string
  create: string
  actions: string
  sections: string
  currentGroup: string
  noTasks: string
  noTasksPriority: string
  noClientTasks: string
  chooseClient: string
  allClientTasks: string
  taskName: string
  client: string
  priority: string
  deadline: string
  createTask: string
  cancel: string
  edit: string
  reminder: string
  note: string
  save: string
  delete: string
  goToCase: string
  openClient: string
  noClient: string
  overdue: string
  today: string
  tomorrow: string
  completed: string
  noDeadline: string
  caseLabel: string
  responsible: string
  manageSections: string
  sectionName: string
  add: string
  noCaseForService: string
}> = {
  ru: {
    all: 'Все задачи', byClient: 'По клиенту', total: 'Всего', create: 'Новая задача', actions: 'Действия',
    sections: 'Разделы', currentGroup: 'задач', noTasks: 'Задач пока нет', noTasksPriority: 'В этом разделе задач пока нет',
    noClientTasks: 'Для выбранного клиента или дела задач пока нет', chooseClient: 'Все клиенты или начните вводить имя',
    allClientTasks: 'Все задачи клиента', taskName: 'Название', client: 'Клиент', priority: 'Приоритет', deadline: 'Срок',
    createTask: 'Создать задачу', cancel: 'Отмена', edit: 'Редактировать задачу', reminder: 'Напоминание', note: 'Примечание',
    save: 'Сохранить', delete: 'Удалить', goToCase: 'Перейти к делу', openClient: 'Открыть клиента', noClient: 'Без клиента', overdue: 'Просрочено',
    today: 'Сегодня', tomorrow: 'Завтра', completed: 'Завершено', noDeadline: 'Без срока', caseLabel: 'Дело',
    responsible: 'Ответственный', manageSections: 'Управление разделами', sectionName: 'Название раздела', add: 'Добавить',
    noCaseForService: 'У выбранного клиента пока нет дела по этой услуге.',
  },
  uk: {
    all: 'Усі завдання', byClient: 'За клієнтом', total: 'Усього', create: 'Нове завдання', actions: 'Дії',
    sections: 'Розділи', currentGroup: 'завдань', noTasks: 'Завдань поки немає', noTasksPriority: 'У цьому розділі завдань поки немає',
    noClientTasks: 'Для вибраного клієнта або справи завдань поки немає', chooseClient: 'Усі клієнти або почніть вводити ім’я',
    allClientTasks: 'Усі завдання клієнта', taskName: 'Назва', client: 'Клієнт', priority: 'Пріоритет', deadline: 'Термін',
    createTask: 'Створити завдання', cancel: 'Скасувати', edit: 'Редагувати завдання', reminder: 'Нагадування', note: 'Примітка',
    save: 'Зберегти', delete: 'Видалити', goToCase: 'Перейти до справи', openClient: 'Відкрити клієнта', noClient: 'Без клієнта', overdue: 'Прострочено',
    today: 'Сьогодні', tomorrow: 'Завтра', completed: 'Завершено', noDeadline: 'Без терміну', caseLabel: 'Справа',
    responsible: 'Відповідальний', manageSections: 'Керування розділами', sectionName: 'Назва розділу', add: 'Додати',
    noCaseForService: 'У вибраного клієнта поки немає справи за цією послугою.',
  },
  pl: {
    all: 'Wszystkie zadania', byClient: 'Według klienta', total: 'Wszystkich', create: 'Nowe zadanie', actions: 'Działania',
    sections: 'Sekcje', currentGroup: 'zadań', noTasks: 'Brak zadań', noTasksPriority: 'Brak zadań w tej sekcji',
    noClientTasks: 'Brak zadań dla wybranego klienta lub sprawy', chooseClient: 'Wszyscy klienci albo zacznij wpisywać imię',
    allClientTasks: 'Wszystkie zadania klienta', taskName: 'Nazwa', client: 'Klient', priority: 'Priorytet', deadline: 'Termin',
    createTask: 'Utwórz zadanie', cancel: 'Anuluj', edit: 'Edytuj zadanie', reminder: 'Przypomnienie', note: 'Notatka',
    save: 'Zapisz', delete: 'Usuń', goToCase: 'Przejdź do sprawy', openClient: 'Otwórz klienta', noClient: 'Bez klienta', overdue: 'Po terminie',
    today: 'Dzisiaj', tomorrow: 'Jutro', completed: 'Zakończone', noDeadline: 'Bez terminu', caseLabel: 'Sprawa',
    responsible: 'Odpowiedzialny', manageSections: 'Zarządzanie sekcjami', sectionName: 'Nazwa sekcji', add: 'Dodaj',
    noCaseForService: 'Wybrany klient nie ma jeszcze sprawy dla tej usługi.',
  },
}

function withAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : `color-mix(in srgb, ${color} ${parseInt(alpha, 16) / 2.55}%, transparent)`
}

function normalizedDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

function deadlineInfo(task: MobileTask, lang: Lang, copy: typeof COPY[Lang]) {
  if (task.status === 'done') return { tone: 'completed', label: copy.completed }
  if (!task.dueDate) return null
  const due = new Date(task.dueDate)
  if (Number.isNaN(due.getTime())) return null
  const today = normalizedDay(new Date())
  const dueDay = normalizedDay(due)
  const diff = Math.round((dueDay - today) / 86400000)
  const locale = lang === 'uk' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'ru-RU'
  const date = due.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: due.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
  if (diff < 0) return { tone: 'danger', label: `${copy.overdue} · ${date}` }
  if (diff === 0) return { tone: 'warning', label: `${copy.today} · ${date}` }
  if (diff === 1) return { tone: 'warning', label: `${copy.tomorrow} · ${date}` }
  return { tone: 'neutral', label: date }
}

function noteForTask(task: MobileTask) {
  try {
    const value = JSON.parse(task.description || '{}')
    return typeof value.reminderNote === 'string' ? value.reminderNote : ''
  } catch {
    return ''
  }
}

function initials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || '—').toUpperCase()
}

function TaskIcon({ type }: { type: 'person' | 'case' | 'calendar' | 'more' | 'chevron' | 'add' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (type === 'person') return <svg {...common}><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
  if (type === 'case') return <svg {...common}><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>
  if (type === 'calendar') return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
  if (type === 'add') return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>
  if (type === 'chevron') return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>
  return <svg {...common}><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>
}

export default function TasksMobile(props: TasksMobileProps) {
  const copy = COPY[props.lang]
  const [selectedPriority, setSelectedPriority] = useState('')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [priorityMenuTaskId, setPriorityMenuTaskId] = useState<string | null>(null)

  const priorities = useMemo(() => [...props.priorities].sort((a, b) => a.order - b.order), [props.priorities])
  useEffect(() => {
    if (!priorities.some(priority => priority.name === selectedPriority)) setSelectedPriority(priorities[0]?.name || '')
  }, [priorities, selectedPriority])

  const openTasks = props.tasks.filter(task => task.status !== 'done')
  const modeTasks = props.activeTab === 'byClient' ? props.filteredClientTasks : openTasks
  const listedTasks = selectedPriority ? modeTasks.filter(task => task.priority === selectedPriority) : modeTasks
  const activePriority = priorities.find(priority => priority.name === selectedPriority)
  const selectedClient = props.clients.find(client => client.id === props.selectedClientId)
  function relatedCase(task: MobileTask) {
    return props.getRelatedCase(task)
  }

  function chipStyle(priority: MobileTaskPriority, selected: boolean): CSSProperties {
    return {
      '--priority-color': priority.color,
      borderColor: withAlpha(priority.color, selected ? 'e6' : 'a6'),
      background: withAlpha(priority.color, selected ? '24' : '12'),
      color: priority.color,
    } as CSSProperties
  }

  return (
    <MobilePageShell className={styles.shell}>
      <CompactMobileHeader
        className={styles.header}
        title={props.t('tasks_title')}
        subtitle={`${copy.total}: ${openTasks.length}`}
        primaryAction={(
          <button type="button" className={styles.createButton} onClick={props.onToggleForm} aria-expanded={props.showForm}>
            <TaskIcon type="add" />
            <span>{copy.create}</span>
          </button>
        )}
        overflowAction={(
          <div className={styles.headerMenuWrap}>
            <button type="button" className={styles.roundButton} aria-label={copy.actions} aria-expanded={headerMenuOpen} onClick={() => setHeaderMenuOpen(value => !value)}><TaskIcon type="more" /></button>
            {headerMenuOpen && (
              <div className={styles.headerMenu}>
                <button type="button" onClick={() => { props.onTogglePriorityManager(); setHeaderMenuOpen(false) }}>{copy.sections}</button>
                <div className={styles.videoAction}>{props.tutorialAction}</div>
              </div>
            )}
          </div>
        )}
      />

      <div className={styles.modeSwitch} role="tablist" aria-label={copy.actions}>
        <button type="button" role="tab" aria-selected={props.activeTab === 'all'} className={props.activeTab === 'all' ? styles.modeActive : ''} onClick={() => props.onTabChange('all')}>{copy.all}</button>
        <button type="button" role="tab" aria-selected={props.activeTab === 'byClient'} className={props.activeTab === 'byClient' ? styles.modeActive : ''} onClick={() => props.onTabChange('byClient')}>{copy.byClient}</button>
      </div>

      {props.showForm && (
        <section className={styles.formPanel} aria-label={copy.create}>
          <div className={styles.formHeading}><strong>{copy.create}</strong><button type="button" onClick={props.onToggleForm} aria-label={copy.cancel}>×</button></div>
          <label>{copy.taskName}<input value={props.form.title} onChange={event => props.onFormChange('title', event.target.value)} /></label>
          <label>{copy.client}{props.renderClientPicker({ value: props.form.clientId, onSelect: clientId => props.onFormChange('clientId', clientId), placeholder: copy.chooseClient, emptyLabel: copy.noClient, notFoundLabel: props.t('not_found') })}</label>
          <div className={styles.formColumns}>
            <label>{copy.priority}<select value={props.form.priority} onChange={event => props.onFormChange('priority', event.target.value)}>{priorities.map(priority => <option key={priority.id} value={priority.name}>{priority.name}</option>)}</select></label>
            <label>{copy.deadline}<input type="date" value={props.form.dueDate} onChange={event => props.onFormChange('dueDate', event.target.value)} /></label>
          </div>
          <div className={styles.formActions}><button type="button" className={styles.primaryButton} onClick={props.onCreateTask}>{copy.createTask}</button><button type="button" className={styles.secondaryButton} onClick={props.onToggleForm}>{copy.cancel}</button></div>
        </section>
      )}

      {props.showPriorityManager && (
        <section className={styles.formPanel} aria-label={copy.manageSections}>
          <div className={styles.formHeading}><strong>{copy.manageSections}</strong><button type="button" onClick={props.onTogglePriorityManager} aria-label={copy.cancel}>×</button></div>
          <div className={styles.priorityAddRow}>
            <input value={props.newPriorityName} onChange={event => props.onNewPriorityName(event.target.value)} placeholder={copy.sectionName} />
            <input type="color" value={props.newPriorityColor} onChange={event => props.onNewPriorityColor(event.target.value)} aria-label={copy.priority} />
            <button type="button" onClick={props.onAddPriority} disabled={!props.newPriorityName.trim()}>{copy.add}</button>
          </div>
          <div className={styles.priorityManagerList}>
            {priorities.map(priority => props.editingPriority?.id === priority.id ? (
              <div key={priority.id} className={styles.priorityManagerRow}>
                <input type="color" value={props.editingPriority.color} onChange={event => props.onEditingPriorityChange({ ...props.editingPriority, color: event.target.value })} aria-label={copy.priority} />
                <input value={props.editingPriority.name} onChange={event => props.onEditingPriorityChange({ ...props.editingPriority, name: event.target.value })} />
                <button type="button" onClick={() => props.onSavePriority(priority)}>✓</button>
                <button type="button" onClick={() => props.onSetEditingPriority(null)}>×</button>
              </div>
            ) : (
              <div key={priority.id} className={styles.priorityManagerRow}>
                <span className={styles.priorityDot} style={{ background: priority.color }} />
                <strong>{priority.name}</strong>
                <span>{openTasks.filter(task => task.priority === priority.name).length}</span>
                <button type="button" onClick={() => props.onSetEditingPriority({ ...priority })}>✎</button>
                <button type="button" className={styles.deleteMini} onClick={() => props.onDeletePriority(priority.id)}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {props.activeTab === 'byClient' && (
        <section className={styles.clientFilters}>
          <label>{copy.client}{props.renderClientPicker({ value: props.selectedClientId, allowEmpty: true, onSelect: props.onClientChange, placeholder: copy.chooseClient, emptyLabel: props.t('all_clients'), notFoundLabel: props.t('not_found') })}</label>
          <label>{props.t('service')}<select value={props.selectedServiceId} onChange={event => props.onServiceChange(event.target.value)} disabled={!props.selectedClientId}>
            <option value="">{copy.allClientTasks}</option>
            {props.services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select></label>
          {selectedClient && <div className={styles.clientHint}>{selectedClient.firstName} {selectedClient.lastName}</div>}
        </section>
      )}

      <MobileChipRail label={copy.priority} className={styles.priorityRail}>
        {priorities.map(priority => {
          const count = modeTasks.filter(task => task.priority === priority.name).length
          const selected = selectedPriority === priority.name
          return <button key={priority.id} type="button" className={`${styles.priorityChip} ${selected ? styles.priorityChipActive : ''}`} style={chipStyle(priority, selected)} aria-pressed={selected} onClick={() => setSelectedPriority(priority.name)}><span>{priority.name}</span><strong>{count}</strong></button>
        })}
      </MobileChipRail>

      <div className={styles.listHeading}>
        <h2>{activePriority?.name || props.t('tasks_title')}</h2>
        <span>· {listedTasks.length}</span>
      </div>

      {props.activeTab === 'byClient' && props.selectedService && props.serviceCases.length === 0 ? (
        <MobileEmptyState title={copy.noCaseForService} />
      ) : listedTasks.length === 0 ? (
        <MobileEmptyState title={modeTasks.length ? copy.noTasksPriority : props.activeTab === 'byClient' ? copy.noClientTasks : copy.noTasks} />
      ) : (
        <div className={styles.cards}>
          {listedTasks.map(task => {
            const priority = priorities.find(item => item.name === task.priority)
            const color = priority?.color || '#64748b'
            const deadline = deadlineInfo(task, props.lang, copy)
            const client = props.getRelatedClient(task)
            const taskCase = relatedCase(task)
            const note = noteForTask(task)
            return (
              <article key={task.id} className={styles.taskCard} style={{ '--task-color': color } as CSSProperties}>
                <div className={styles.cardTop}>
                  <button type="button" className={styles.cardTitleButton} onClick={() => props.onOpenTask(task)}><strong>{task.title}</strong></button>
                  <button type="button" className={styles.priorityBadge} style={{ borderColor: withAlpha(color, 'c2'), background: withAlpha(color, '18'), color }} onClick={() => setPriorityMenuTaskId(value => value === task.id ? null : task.id)} aria-expanded={priorityMenuTaskId === task.id}>{task.priority}</button>
                  <button type="button" className={styles.cardMenuButton} aria-label={copy.priority} onClick={() => setPriorityMenuTaskId(value => value === task.id ? null : task.id)}><TaskIcon type="more" /></button>
                  {priorityMenuTaskId === task.id && (
                    <div className={styles.priorityMenu}>
                      {priorities.map(option => <button key={option.id} type="button" style={{ color: option.color }} onClick={async () => { await props.onMovePriority(task, option.name); setPriorityMenuTaskId(null); setSelectedPriority(option.name) }}><span style={{ background: option.color }} />{option.name}{option.name === task.priority ? ' ✓' : ''}</button>)}
                    </div>
                  )}
                </div>

                <div className={styles.cardBody}>
                  {client ? (
                    <Link className={styles.relationRow} href={`/clients/${client.id}`} onClick={event => event.stopPropagation()} aria-label={`${copy.openClient}: ${client.firstName} ${client.lastName}`}>
                      <TaskIcon type="person" /><span>{client.firstName} {client.lastName}</span><TaskIcon type="chevron" />
                    </Link>
                  ) : task.clientName ? <div className={styles.metaRow}><TaskIcon type="person" /><span>{task.clientName}</span></div> : null}
                  {taskCase && (
                    <Link className={styles.relationRow} href={`/cases/${taskCase.id}`} onClick={event => event.stopPropagation()} aria-label={`${copy.goToCase}: ${taskCase.service?.name || copy.caseLabel}`}>
                      <TaskIcon type="case" /><span>{taskCase.service?.name || copy.caseLabel}{taskCase.caseNumber ? ` · ${taskCase.caseNumber}` : ''}</span><TaskIcon type="chevron" />
                    </Link>
                  )}
                  {deadline && <div className={`${styles.deadline} ${styles[`deadline_${deadline.tone}`]}`}><TaskIcon type="calendar" /><span>{deadline.label}</span></div>}
                  {task.assignedTo?.name && <div className={styles.assignee}><span>{initials(task.assignedTo.name)}</span><span>{task.assignedTo.name}</span></div>}
                  {note && <p className={styles.note}>{note}</p>}
                </div>
                <button type="button" className={styles.openCardButton} onClick={() => props.onOpenTask(task)} aria-label={copy.edit}><TaskIcon type="chevron" /></button>
              </article>
            )
          })}
        </div>
      )}

      {props.selectedTask && props.editForm && (
        <div className={styles.modalLayer} onClick={event => { if (event.target === event.currentTarget) props.onCloseTask() }}>
          <section className={styles.editSheet} role="dialog" aria-modal="true" aria-label={copy.edit}>
            <span className={styles.dragHandle} />
            <div className={styles.formHeading}><strong>{copy.edit}</strong><button type="button" onClick={props.onCloseTask} aria-label={copy.cancel}>×</button></div>
            <div className={styles.editBody}>
              <label>{copy.taskName}<input value={props.editForm.title || ''} onChange={event => props.onEditChange('title', event.target.value)} /></label>
              <label>{copy.client}{props.renderClientPicker({ value: props.editForm.clientId || '', onSelect: props.onEditClient, placeholder: copy.chooseClient, emptyLabel: copy.noClient, notFoundLabel: props.t('not_found') })}</label>
              <label>{copy.priority}<div className={styles.editPriorityRail}>{priorities.map(priority => <button key={priority.id} type="button" style={chipStyle(priority, props.editForm.priority === priority.name)} aria-pressed={props.editForm.priority === priority.name} onClick={() => props.onEditChange('priority', priority.name)}>{priority.name}</button>)}</div></label>
              <div className={styles.formColumns}>
                <label>{copy.deadline}<input type="date" value={props.editForm.dueDate || ''} onChange={event => props.onEditChange('dueDate', event.target.value)} /></label>
                <label>{copy.reminder}<input type="datetime-local" value={props.editForm.reminderAt || ''} onChange={event => props.onEditChange('reminderAt', event.target.value)} /></label>
              </div>
              <label>{copy.note}<input value={props.editForm.reminderNote || ''} onChange={event => props.onEditChange('reminderNote', event.target.value)} /></label>
              {(props.editTaskClientId || props.editTaskCaseId) && (
                <div className={styles.editNavigation}>
                  {props.editTaskClientId && <Link href={`/clients/${props.editTaskClientId}`}><TaskIcon type="person" /><span>{copy.openClient}</span><TaskIcon type="chevron" /></Link>}
                  {props.editTaskCaseId && <Link href={`/cases/${props.editTaskCaseId}`}><TaskIcon type="case" /><span>{copy.goToCase}</span><TaskIcon type="chevron" /></Link>}
                </div>
              )}
              <button type="button" className={styles.editDeleteAction} onClick={() => props.onDeleteTask(props.selectedTask!.id)}>{copy.delete}</button>
            </div>
            <div className={styles.editFooter}><button type="button" className={styles.primaryButton} onClick={props.onSaveTask}><span aria-hidden="true">✓</span>{copy.save}</button><button type="button" className={styles.secondaryButton} onClick={props.onCloseTask}>{copy.cancel}</button></div>
          </section>
        </div>
      )}
    </MobilePageShell>
  )
}
