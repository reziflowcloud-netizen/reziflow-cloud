// General rollout is explicit and fail-closed. Pilot semantics remain unchanged
// unless both the switch and a canonical UTC activation boundary are present.
export function notificationGlobalSince(): Date | null {
  const value = process.env.NOTIFICATION_EVENTS_GLOBAL_SINCE || ''
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : null
}
export function notificationGlobalEnabled() {
  return process.env.NOTIFICATION_EVENTS_GLOBAL_ENABLED === 'true' && notificationGlobalSince() !== null
}
export function notificationGlobalRequested() {
  return process.env.NOTIFICATION_EVENTS_GLOBAL_ENABLED === 'true'
}
