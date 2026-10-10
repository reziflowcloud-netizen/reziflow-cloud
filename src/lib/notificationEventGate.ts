import type { NotificationType } from './notificationPolicy.ts'

// Every malformed/empty gate denies all. Assignment and scheduled events have
// separate switches; enabling Phase 3A must never enable a scheduled evaluator.
function ids(value: string | undefined, valid: (value: string) => boolean) {
  if (!value?.trim()) return []
  const values = value.split(',').map(item => item.trim())
  return values.every(valid) ? Array.from(new Set(values)) : []
}
export function notificationEventOrgIds() {
  return ids(process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS, value => /^[a-zA-Z0-9_-]{1,100}$/.test(value))
}
export function notificationEventUserIds() {
  return ids(process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS, value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))).map(Number)
}
export function assignmentEventsEnabled(organizationId?: string) {
  return process.env.NOTIFICATIONS_ENABLED === 'true' && process.env.NOTIFICATION_EVENTS_ENABLED === 'true'
    && notificationEventOrgIds().length > 0 && notificationEventUserIds().length > 0
    && (!organizationId || notificationEventOrgIds().includes(organizationId))
}
export function scheduledEventsEnabled() {
  return assignmentEventsEnabled() && process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED === 'true'
}
export function notificationEventAllowed(type: NotificationType, organizationId: string, userId?: number) {
  return assignmentEventsEnabled(organizationId)
    && enabledAutomaticEventTypes().includes(type)
    && (userId === undefined || notificationEventUserIds().includes(userId))
}
export function enabledAutomaticEventTypes() {
  return scheduledEventsEnabled()
    ? ['lead_assigned', 'task_assigned', 'task_due', 'task_overdue', 'case_date', 'lead_contact']
    : ['lead_assigned', 'task_assigned']
}
