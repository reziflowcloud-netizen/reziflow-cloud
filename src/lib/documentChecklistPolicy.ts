export const CHECKLIST_STATUSES = ['NEEDED', 'RECEIVED', 'SUBMITTED_TO_MOS'] as const
export function documentNameKey(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
}
export function checklistProgress(items: Array<{ active: boolean; required: boolean; status: string }>) {
  const active = items.filter(item => item.active)
  const required = active.filter(item => item.required)
  const complete = (item: { status: string }) => item.status === 'RECEIVED' || item.status === 'SUBMITTED_TO_MOS'
  const received = required.filter(complete).length
  return { required: required.length, received, total: active.length, totalReceived: active.filter(complete).length,
    waiting: required.length - received, percent: required.length ? Math.round(received / required.length * 100) : 0,
    // Empty/optional-only lists have no blocking requirements, but do not emit readiness events.
    ready: required.every(complete), actionable: required.length > 0 }
}
export class ChecklistError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
export function checklistName(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new ChecklistError('Invalid document name')
  return value.trim().replace(/\s+/g, ' ')
}
export function checklistDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ChecklistError('Invalid submission date')
  const date = new Date(value + 'T00:00:00.000Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > new Date().toISOString().slice(0, 10)) throw new ChecklistError('Invalid submission date')
  return date
}
