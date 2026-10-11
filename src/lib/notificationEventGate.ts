import type { NotificationType } from './notificationPolicy.ts'

// Global emergency gates. Tenant eligibility comes from persisted organization opt-in.
export function assignmentEventsEnabled(_organizationId?: string) {
  return process.env.NOTIFICATIONS_ENABLED === 'true' && process.env.NOTIFICATION_EVENTS_ENABLED === 'true'
}
export function scheduledEventsEnabled() {
  return assignmentEventsEnabled() && process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED === 'true'
}
export function notificationEventAllowed(type: NotificationType, organizationId: string, userId?: number) {
  return assignmentEventsEnabled(organizationId)
    && enabledAutomaticEventTypes().includes(type)
    && !!organizationId && (userId === undefined || Number.isSafeInteger(userId) && userId > 0)
}
export function enabledAutomaticEventTypes() {
  return scheduledEventsEnabled()
    ? ['lead_assigned', 'task_assigned', 'task_due', 'task_overdue', 'case_date', 'lead_contact']
    : ['lead_assigned', 'task_assigned']
}
