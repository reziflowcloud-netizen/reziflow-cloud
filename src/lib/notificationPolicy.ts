// Pure policy shared by server, UI and tests. Settings never grant entity access.
import { isClosedCaseStatus } from './caseI18n.ts'
import { shouldRetirePersonalAppearTask } from './caseImportantDateTasks.ts'
export const NOTIFICATION_TYPES = ['lead_assigned', 'task_assigned', 'task_due', 'task_overdue', 'case_date', 'lead_contact'] as const
export type NotificationType = typeof NOTIFICATION_TYPES[number]
export type NotificationPreferences = {
  scope: 'mine' | 'team'
  events: Record<NotificationType, { inApp: boolean; push: boolean }>
  pushEnabled: boolean
  showClientName: boolean
  language: 'ru' | 'uk' | 'pl'
}
export function canReceiveTeam(user: { role: string; restrictedAccess?: boolean }) {
  return user.role === 'owner' || user.role === 'admin'
}
export function notificationPreferences(raw?: any, teamAllowed = false): NotificationPreferences {
  return {
    scope: teamAllowed && raw?.scope === 'team' ? 'team' : 'mine',
    events: Object.fromEntries(NOTIFICATION_TYPES.map(type => [type, {
      inApp: raw?.events?.[type]?.inApp !== false,
      push: raw?.events?.[type]?.push !== false,
    }])) as NotificationPreferences['events'],
    pushEnabled: raw?.pushEnabled === true,
    showClientName: raw?.showClientName === true,
    language: ['ru', 'uk', 'pl'].includes(raw?.language) ? raw.language : 'uk',
  }
}
export function entityLink(entityType: string, entityId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(entityId)) throw new Error('Invalid entity')
  if (entityType === 'lead') return `/leads/${entityId}`
  if (entityType === 'case') return `/cases/${entityId}`
  if (entityType === 'task') return `/tasks?notificationTask=${entityId}`
  throw new Error('Invalid entity')
}
export function safeNotificationReturn(value: unknown) {
  return typeof value === 'string' && /^\/notifications\/open\/[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : '/dashboard'
}
export function assignmentOccurrence(current: any, previous?: any) {
  if (!current.assignedToId || previous?.assignedToId === current.assignedToId) return null
  return `${current.assignedToId}:${new Date(current.updatedAt || current.createdAt).toISOString()}`
}
export function dateKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}
export function warsawDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
// Existing datetime-local reminder values are Poland wall time; explicit offsets stay exact.
export function reminderTimestamp(value: string) {
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) return new Date(value).getTime()
  const base = Date.parse(value + 'Z')
  if (!Number.isFinite(base)) return NaN
  let candidate = base
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate))
    const p = (type: string) => parts.find(part => part.type === type)?.value
    const represented = Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`)
    candidate += base - represented
  }
  return candidate
}
export function taskOccurrences(task: any, now: Date) {
  if (['done', 'completed', 'cancelled', 'canceled', 'inactive'].includes(task.status)) return []
  let meta: any = {}
  try { meta = JSON.parse(task.description || '{}') } catch { /* plain description */ }
  if (meta.leadReminder || meta.caseImportantDate || meta.fingerprintsAppointment || meta.predictedDecision) return []
  const due = task.dueDate ? dateKey(task.dueDate) : null
  const today = warsawDay(now)
  const reminder = typeof meta.reminderAt === 'string' ? reminderTimestamp(meta.reminderAt) : NaN
  const deadline = due ? Date.parse(due + 'T00:00:00Z') : NaN
  const dayDelta = due ? (deadline - Date.parse(today + 'T00:00:00Z')) / 86400000 : NaN
  if (due && due < today) return [{ type: 'task_overdue' as const, occurrence: due }]
  if (Number.isFinite(reminder) ? reminder <= now.getTime() : dayDelta >= 0 && dayDelta <= 1) {
    return [{ type: 'task_due' as const, occurrence: `${due || ''}:${Number.isFinite(reminder) ? new Date(reminder).toISOString() : 'default'}` }]
  }
  return []
}
export const CASE_NOTIFICATION_DATE_FIELDS = ['fingerprintsDate', 'predictedDecisionDate', 'personalAppearDate', 'cardPickupDate', 'legalStayDeadline', 'workContractEndDate'] as const
export function caseOccurrences(record: any, now: Date) {
  if (isClosedCaseStatus(record.status)) return []
  const today = Date.parse(warsawDay(now) + 'T00:00:00Z')
  const dates = [
    ...CASE_NOTIFICATION_DATE_FIELDS.map(kind => ({ kind, date: record[kind] })),
    ...(record.customDates || []).map((item: any) => ({ kind: `custom:${item.id}`, date: item.date })),
  ]
  return dates.flatMap(item => {
    if (!item.date) return []
    if (item.kind === 'personalAppearDate' && shouldRetirePersonalAppearTask(item.date, record.statusHistory || [], now)) return []
    const day = dateKey(item.date)
    const days = (Date.parse(day + 'T00:00:00Z') - today) / 86400000
    if (days < 0 || days > 7) return []
    // Catch up a missed scheduled run within the window without repeating each day.
    const window = days <= 1 ? '1d' : '7d'
    return [{ type: 'case_date' as const, occurrence: `${item.kind}:${day}:${window}` }]
  })
}
export function leadContactOccurrence(lead: any, now: Date) {
  const status = String(lead.status || '').trim().toLowerCase()
  if (!lead.nextContactAt || lead.convertedAt || lead.convertedClientId || ['не подходит', 'не підходить', 'nie pasuje'].includes(status) || ['клиент', 'клієнт', 'client', 'klient'].some(value => status.includes(value))) return null
  const next = new Date(lead.nextContactAt)
  if (next > now || (lead.lastContactAt && new Date(lead.lastContactAt) >= next)) return null
  return next.toISOString()
}

export function notificationStillActionable(notification: any, record: any, now: Date) {
  if (!record) return false
  const prefix = `${notification.type}:${notification.entityType}:${notification.entityId}:`
  if (!notification.dedupeKey.startsWith(prefix)) return false
  const occurrence = notification.dedupeKey.slice(prefix.length)
  if (notification.type === 'task_assigned' && ['done', 'completed', 'cancelled', 'canceled', 'inactive'].includes(record.status)) return false
  if (notification.type === 'task_assigned' || notification.type === 'lead_assigned') return String(record.assignedToId || '') === occurrence.split(':')[0]
  if (notification.type === 'task_due' || notification.type === 'task_overdue') return taskOccurrences(record, now).some(event => event.type === notification.type && event.occurrence === occurrence)
  if (notification.type === 'case_date') return caseOccurrences(record, now).some(event => event.occurrence === occurrence)
  if (notification.type === 'lead_contact') return leadContactOccurrence(record, now) === occurrence
  return false
}
