let guard: (() => Promise<boolean>) | null = null
export function registerScreenLeave(next: () => Promise<boolean>) {
  guard = next
  return () => { if (guard === next) guard = null }
}
export async function prepareScreenLeave() { return guard ? guard() : true }
