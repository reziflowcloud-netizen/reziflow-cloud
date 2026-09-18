import type { DataAccessScope } from '@/lib/apiScope'
import { caseWhereForScope, leadWhereForScope } from '@/lib/apiScope'
import { isArchiveCaseStatus } from '@/lib/caseI18n'
import { applyEmployeeStaffScope, type ResolvedStaffScope } from '@/lib/staffScope'

export const BULK_ACTIONS = ['assign_employee', 'unassign_employee', 'change_status'] as const
export type BulkAction = typeof BULK_ACTIONS[number]

export type BulkSelection =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filtered'; filters: Record<string, unknown>; excludedIds: string[] }

export class BulkRequestError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'BulkRequestError'
    this.status = status
  }
}

function cleanString(value: unknown, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function cleanIdList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  const ids = Array.from(new Set(value.map(item => cleanString(item, 80)).filter(Boolean)))
  if (ids.length > limit) throw new BulkRequestError(`Too many record IDs (maximum ${limit})`)
  return ids
}

export function parseBulkAction(value: unknown): BulkAction {
  if (!BULK_ACTIONS.includes(value as BulkAction)) throw new BulkRequestError('Unsupported bulk action')
  return value as BulkAction
}

export function parseBulkSelection(value: unknown): BulkSelection {
  const selection = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (selection.mode === 'ids') {
    const ids = cleanIdList(selection.ids, 2_000)
    if (!ids.length) throw new BulkRequestError('Select at least one record')
    return { mode: 'ids', ids }
  }
  if (selection.mode === 'filtered') {
    const filters = selection.filters && typeof selection.filters === 'object'
      ? selection.filters as Record<string, unknown>
      : {}
    return {
      mode: 'filtered',
      filters,
      excludedIds: cleanIdList(selection.excludedIds, 2_000),
    }
  }
  throw new BulkRequestError('Invalid selection mode')
}

function validDate(value: unknown) {
  const raw = cleanString(value, 40)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function leadNotConvertedWhere() {
  return {
    AND: [
      { convertedClientId: null },
      { NOT: { status: { contains: 'клиент', mode: 'insensitive' } } },
      { NOT: { status: { contains: 'клієнт', mode: 'insensitive' } } },
      { NOT: { status: { contains: 'client', mode: 'insensitive' } } },
      { NOT: { status: { contains: 'klient', mode: 'insensitive' } } },
    ],
  }
}

export function buildLeadFilteredWhere(
  scope: DataAccessScope,
  organizationId: string,
  filters: Record<string, unknown>,
  excludedIds: string[] = [],
  staffScope?: ResolvedStaffScope,
) {
  const where: any = leadWhereForScope(scope, organizationId)
  const and: any[] = []
  const search = cleanString(filters.search)
  const status = cleanString(filters.status)
  const statusReason = cleanString(filters.statusReason)
  const source = cleanString(filters.source)
  const interest = cleanString(filters.interest)
  const temperature = cleanString(filters.temperature)
  const quickFilter = cleanString(filters.quickFilter)
  const createdStart = validDate(filters.createdStart)
  const createdEnd = validDate(filters.createdEnd)

  if (status) where.status = status
  if (statusReason) where.statusReason = statusReason
  if (source) where.source = source
  if (interest) where.serviceInterest = interest
  if (temperature) where.urgency = temperature
  if (createdStart || createdEnd) {
    where.createdAt = {
      ...(createdStart ? { gte: createdStart } : {}),
      ...(createdEnd ? { lt: createdEnd } : {}),
    }
  }
  if (excludedIds.length) where.id = { notIn: excludedIds }

  if (search) {
    const contains = { contains: search, mode: 'insensitive' }
    and.push({
      OR: [
        { fullName: contains },
        { firstName: contains },
        { lastName: contains },
        { phone: contains },
        { email: contains },
        { instagram: contains },
        { facebook: contains },
        { serviceInterest: contains },
        { nextContactNote: contains },
        { city: contains },
        { voivodeship: contains },
        { notes: contains },
        { employee: { is: { name: contains } } },
      ],
    })
  }

  if (quickFilter === 'today') {
    const start = validDate(filters.nextContactStart)
    const end = validDate(filters.nextContactEnd)
    if (!start || !end) throw new BulkRequestError('Invalid current-day filter')
    and.push(leadNotConvertedWhere(), { nextContactAt: { gte: start, lt: end } })
  } else if (quickFilter === 'overdue') {
    const before = validDate(filters.nextContactBefore)
    if (!before) throw new BulkRequestError('Invalid overdue filter')
    and.push(leadNotConvertedWhere(), { nextContactAt: { lt: before } })
  } else if (quickFilter === 'unassigned') {
    and.push(leadNotConvertedWhere(), { employeeId: null })
  } else if (quickFilter === 'no_next_contact') {
    and.push(leadNotConvertedWhere(), { nextContactAt: null })
  } else if (quickFilter && quickFilter !== 'all') {
    throw new BulkRequestError('Unsupported lead filter')
  }

  if (and.length) where.AND = and
  return staffScope ? applyEmployeeStaffScope(where, staffScope) : where
}

const CLOSED_CASE_TOKENS = [
  'архив', 'архів', 'archive', 'archiw', 'отказ', 'відмова', 'odmowa',
  'refusal', 'rejected', 'закрыт', 'закрит', 'closed', 'zamkni',
]

export function buildCaseFilteredWhere(
  scope: DataAccessScope,
  organizationId: string,
  filters: Record<string, unknown>,
  excludedIds: string[] = [],
  staffScope?: ResolvedStaffScope,
) {
  const where: any = caseWhereForScope(scope, organizationId)
  const and: any[] = []
  const search = cleanString(filters.search)
  const activeFilter = cleanString(filters.activeFilter)

  if (excludedIds.length) where.id = { notIn: excludedIds }
  if (activeFilter === 'active') {
    for (const token of CLOSED_CASE_TOKENS) {
      and.push({ NOT: { status: { contains: token, mode: 'insensitive' } } })
    }
  } else if (activeFilter === 'no_pay') {
    and.push({ contractSigned: true }, { totalPaid: 0 }, { totalValue: { gt: 0 } })
  } else if (activeFilter && activeFilter !== 'all' && activeFilter !== 'Все') {
    if (isArchiveCaseStatus(activeFilter)) {
      and.push({
        OR: ['архив', 'архів', 'archive', 'archiw'].map(token => ({
          status: { contains: token, mode: 'insensitive' },
        })),
      })
    } else {
      where.status = activeFilter
    }
  }

  if (search) {
    const contains = { contains: search, mode: 'insensitive' }
    and.push({
      OR: [
        { client: { is: { firstName: contains } } },
        { client: { is: { lastName: contains } } },
        { client: { is: { phone: contains } } },
        { employee: { is: { name: contains } } },
      ],
    })
  }

  if (and.length) where.AND = and
  return staffScope ? applyEmployeeStaffScope(where, staffScope) : where
}

export function buildLeadSelectionWhere(
  selection: BulkSelection,
  scope: DataAccessScope,
  organizationId: string,
  staffScope?: ResolvedStaffScope,
) {
  return selection.mode === 'ids'
    ? (staffScope
        ? applyEmployeeStaffScope(leadWhereForScope(scope, organizationId, { id: { in: selection.ids } }), staffScope)
        : leadWhereForScope(scope, organizationId, { id: { in: selection.ids } }))
    : buildLeadFilteredWhere(scope, organizationId, selection.filters, selection.excludedIds, staffScope)
}

export function buildCaseSelectionWhere(
  selection: BulkSelection,
  scope: DataAccessScope,
  organizationId: string,
  staffScope?: ResolvedStaffScope,
) {
  return selection.mode === 'ids'
    ? (staffScope
        ? applyEmployeeStaffScope(caseWhereForScope(scope, organizationId, { id: { in: selection.ids } }), staffScope)
        : caseWhereForScope(scope, organizationId, { id: { in: selection.ids } }))
    : buildCaseFilteredWhere(scope, organizationId, selection.filters, selection.excludedIds, staffScope)
}
