const guards = new Map<() => Promise<boolean>, () => boolean>()
let pending: Promise<boolean> | null = null
export function registerScreenLeave(next: () => Promise<boolean>, dirty: () => boolean = () => false) {
  guards.set(next, dirty)
  return () => { guards.delete(next) }
}
export function screenLeavePending() { return Array.from(guards.values()).some(dirty => dirty()) }
export async function prepareScreenLeave() {
  if (pending) return pending
  pending = (async () => { for (const guard of Array.from(guards.keys())) if (!await guard()) return false; return true })()
  try { return await pending } finally { pending = null }
}
