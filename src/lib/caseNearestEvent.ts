export type CaseSummaryEventSource = 'important-date' | 'reminder' | 'task'

export type CaseSummaryEvent = {
  key: string
  label: string
  date: string
  time: string
  note?: string
  source: CaseSummaryEventSource
  timestamp: number
  overdue: boolean
}

type ImportantDateInput = {
  label: string
  date: unknown
  time?: unknown
  note?: string
}

type CaseTaskInput = {
  id: string | number
  title: string
  status?: string
  dueDate?: unknown
  deadlineAt?: unknown
  reminderAt?: unknown
  eventKind?: 'reminder' | 'task'
  note?: string
}

function dateValue(value: unknown) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function eventTime(value: unknown) {
  const match = String(value || '').match(/T(\d{2}:\d{2})/)
  return match?.[1] || ''
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeEvent(input: Omit<CaseSummaryEvent, 'timestamp' | 'overdue'>, now: Date): CaseSummaryEvent | null {
  if (!input.date) return null
  const hasTime = Boolean(input.time)
  const parsed = new Date(`${input.date}T${input.time || '23:59'}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const overdue = hasTime ? parsed.getTime() < now.getTime() : input.date < localDateKey(now)
  return { ...input, timestamp: parsed.getTime(), overdue }
}

export function selectNearestCaseEvent(
  importantDates: ImportantDateInput[],
  caseTasks: CaseTaskInput[],
  now = new Date()
): CaseSummaryEvent | null {
  const events: CaseSummaryEvent[] = []

  importantDates.forEach((item, index) => {
    const event = normalizeEvent({
      key: `important-${index}-${dateValue(item.date)}`,
      label: item.label,
      date: dateValue(item.date),
      time: String(item.time || ''),
      note: item.note,
      source: 'important-date',
    }, now)
    if (event) events.push(event)
  })

  caseTasks.forEach(task => {
    const normalizedStatus = String(task.status || '').toLowerCase()
    if (['done', 'completed', 'cancelled', 'canceled', 'inactive'].includes(normalizedStatus)) return

    const source: CaseSummaryEventSource = task.eventKind === 'reminder' ? 'reminder' : 'task'
    const value = source === 'reminder'
      ? task.reminderAt || task.deadlineAt || task.dueDate
      : task.deadlineAt || task.dueDate
    const event = normalizeEvent({
      key: `${source}-${task.id}`,
      label: task.title,
      date: dateValue(value),
      time: eventTime(task.reminderAt),
      note: task.note,
      source,
    }, now)
    if (event) events.push(event)
  })

  const overdue = events.filter(item => item.overdue).sort((a, b) => a.timestamp - b.timestamp)
  if (overdue.length > 0) return overdue[0]
  return events.sort((a, b) => a.timestamp - b.timestamp)[0] || null
}
