import { warsawTimestamp } from './warsawDateTime.ts'
import { taskOccurrences, caseOccurrences, leadContactOccurrence, type NotificationType } from './notificationPolicy.ts'

export type ScheduledOccurrence = { type: NotificationType; occurrence: string }
function calendarTrigger(day: string, offset: number) {
  const instant = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(instant)) return NaN
  const triggerDay = new Date(instant + offset * 86400000).toISOString().slice(0, 10)
  return warsawTimestamp(`${triggerDay}T00:00`)
}
// Occurrence identities/dedupe keys stay unchanged. Only their original trigger
// instant determines whether a general rollout may create a new copy.
export function occurrenceTriggerAt(event: ScheduledOccurrence) {
  if (event.type === 'lead_contact') return Date.parse(event.occurrence)
  if (event.type === 'task_overdue') return calendarTrigger(event.occurrence, 1)
  if (event.type === 'task_due') {
    const match = event.occurrence.match(/^(\d{4}-\d{2}-\d{2})?:(default|\d{4}-\d{2}-\d{2}T.*)$/)
    return match ? match[2] === 'default' ? calendarTrigger(match[1], -1) : Date.parse(match[2]) : NaN
  }
  if (event.type === 'case_date') {
    const match = event.occurrence.match(/^.+:(\d{4}-\d{2}-\d{2}):(1d|7d)$/)
    return match ? calendarTrigger(match[1], match[2] === '1d' ? -1 : -7) : NaN
  }
  return NaN
}
export function scheduledOccurrences(kind: 'task' | 'case' | 'lead', record: any, now: Date, since?: Date | null): ScheduledOccurrence[] {
  const contact = kind === 'lead' ? leadContactOccurrence(record, now) : null
  const events = kind === 'task' ? taskOccurrences(record, now) : kind === 'case' ? caseOccurrences(record, now) : contact ? [{ type: 'lead_contact' as const, occurrence: contact }] : []
  return since ? events.filter(event => occurrenceTriggerAt(event) >= since.getTime()) : events
}
