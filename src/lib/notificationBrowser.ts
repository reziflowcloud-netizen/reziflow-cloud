'use client'
const emptyStatus = { available: false, unread: 0 }
let notificationStatus = emptyStatus
const statusListeners = new Set<() => void>()
export const getNotificationStatus = () => notificationStatus
export const getServerNotificationStatus = () => emptyStatus
export function subscribeNotificationStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => { statusListeners.delete(listener) }
}
export function publishNotificationStatus(status: typeof emptyStatus) {
  if (notificationStatus.available === status.available && notificationStatus.unread === status.unread) return
  notificationStatus = status
  statusListeners.forEach(listener => listener())
}
export async function updateAppBadge(count: number) {
  const api = navigator as Navigator & { setAppBadge?: (value: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try { if (count && api.setAppBadge) await api.setAppBadge(count); else if (api.clearAppBadge) await api.clearAppBadge() } catch { /* graceful fallback */ }
}
export function handleNotificationOpen(event: MessageEvent) {
  const source = event.source as ServiceWorker | null
  if (!source || typeof source.scriptURL !== 'string' || event.data?.type !== 'legalhub:notification-open') return
  try {
    const worker = new URL(source.scriptURL)
    if (worker.origin !== window.location.origin || worker.pathname !== '/notification-sw.js') return
  } catch { return }
  const path = event.data.path
  if (typeof path !== 'string' || (path !== '/dashboard' && !/^\/notifications\/open\/[\w-]{1,100}$/.test(path))) return
  // Only an actual worker click opens the resolver. Receiving a push merely
  // refreshes the unread count, and never marks the notification read.
  try { window.location.assign(path) } catch { return }
  // ACK means the navigation request was issued, not that a message arrived.
  // A refused assignment must leave the worker's openWindow fallback usable.
  event.ports[0]?.postMessage('notification-open-accepted')
}
export async function disconnectPushDevice() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/notification-sw.js')
  const subscription = await registration?.pushManager?.getSubscription()
  if (subscription) {
    const response = await fetch('/api/notifications/subscriptions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
    if (!response.ok && response.status !== 401) throw new Error('Unable to disconnect')
    await subscription.unsubscribe()
  }
  await updateAppBadge(0)
}
export function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
export async function browserEndpointHash(endpoint: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))).map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export function vapidBytes(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}
