type Handler = { load: () => Promise<unknown>; ready: () => boolean }
const handlers = new Set<Handler>()
let pending: Promise<'refreshed' | 'blocked'> | null = null
let lastFetched = 0
export const RESUME_STALE_MS = 45_000
export function supportsScreenRefresh(pathname: string) {
  return /^\/(dashboard|leads|cases|clients|tasks|calendar)(?:\/|$)/.test(pathname) && !pathname.endsWith('/new')
}

export function markScreenFetched() { lastFetched = Date.now() }
export function isScreenStale() { return Date.now() - lastFetched >= RESUME_STALE_MS }
export function registerScreenRefresh(handler: Handler) {
  handlers.add(handler)
  return () => { handlers.delete(handler) }
}
export function refreshScreen(fallback: () => Promise<unknown>): Promise<'refreshed' | 'blocked'> {
  if (pending) return pending
  const current = Array.from(handlers)
  if (current.some(handler => !handler.ready())) return Promise.resolve('blocked')
  pending = (async () => {
    await Promise.all(current.length ? current.map(handler => handler.load()) : [fallback()])
    markScreenFetched()
    return 'refreshed' as const
  })().finally(() => { pending = null })
  return pending
}

export async function freshJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}
