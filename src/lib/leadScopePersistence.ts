import type { StaffScopeValue } from './staffScope'

export type LeadScopeMetadata = {
  userId: number
  organizationId: string
  restricted: boolean
  controlVisible: boolean
  mineAvailable: boolean
  employees: { id: number; name: string }[]
}

export function leadScopeOwner(userId: number, organizationId: string) {
  return JSON.stringify([userId, organizationId])
}

export function leadScopeStorageKey(owner: string) {
  return `legalhub:leads:responsible:v1:${owner}`
}

export function parseLeadScope(value: unknown): StaffScopeValue | null {
  if (value === 'all' || value === 'mine') return value
  if (typeof value !== 'string' || !/^employee:[1-9]\d*$/.test(value)) return null
  return Number.isSafeInteger(Number(value.slice(9))) ? value as StaffScopeValue : null
}

export function validateLeadScope(value: unknown, metadata: LeadScopeMetadata): StaffScopeValue {
  if (metadata.restricted) return 'mine'
  if (!metadata.controlVisible) return 'all'
  const scope = parseLeadScope(value)
  if (scope === 'mine') return metadata.mineAvailable ? 'mine' : 'all'
  if (scope?.startsWith('employee:')) {
    return metadata.employees.some(employee => `employee:${employee.id}` === scope) ? scope : 'all'
  }
  return 'all'
}

// Unbound/foreign URLs must never import another account's selection.
export function restoreLeadScope(params: URLSearchParams, owner: string, saved: unknown, metadata: LeadScopeMetadata) {
  const candidate = params.get('staffScopeOwner') === owner && params.has('staffScope')
    ? params.get('staffScope')
    : saved
  return validateLeadScope(candidate, metadata)
}

export function readLeadScope(owner: string, storage: Pick<Storage, 'getItem'>) {
  try { return parseLeadScope(storage.getItem(leadScopeStorageKey(owner))) } catch { return null }
}

export function writeLeadScope(owner: string, value: StaffScopeValue, storage: Pick<Storage, 'setItem'>) {
  try { storage.setItem(leadScopeStorageKey(owner), value) } catch { /* Storage is optional. */ }
}
