import { prisma } from '@/lib/prisma'
import type { DataAccessScope } from '@/lib/apiScope'

export type StaffScopeValue = 'all' | 'mine' | `employee:${number}`

export type ResolvedStaffScope =
  | { kind: 'all' }
  | { kind: 'mine'; employeeId: number | null; userId: number }
  | { kind: 'employee'; employeeId: number; userId: number | null }

export class StaffScopeError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StaffScopeError'
    this.status = status
  }
}

export function staffScopeValue(scope: ResolvedStaffScope): StaffScopeValue {
  return scope.kind === 'employee' ? `employee:${scope.employeeId}` : scope.kind
}

export async function resolveStaffScope(
  rawValue: unknown,
  user: any,
  organizationId: string,
  access: DataAccessScope,
): Promise<ResolvedStaffScope> {
  const raw = String(rawValue || '').trim().toLowerCase()
  const requested = raw || (access.restricted ? 'mine' : 'all')
  const userId = Number(user?.id)
  if (!Number.isInteger(userId) || userId <= 0) throw new StaffScopeError('Unauthorized', 401)

  if (access.restricted && requested !== 'mine') {
    throw new StaffScopeError('Staff scope cannot expand access', 403)
  }

  if (requested === 'all') return { kind: 'all' }

  if (requested === 'mine') {
    const employee = await (prisma as any).employee.findFirst({
      where: { organizationId, userId, active: true },
      select: { id: true },
    })
    return { kind: 'mine', employeeId: employee?.id || null, userId }
  }

  const match = requested.match(/^employee:(\d+)$/)
  if (!match) throw new StaffScopeError('Invalid staff scope')
  const employeeId = Number(match[1])
  const employee = await (prisma as any).employee.findFirst({
    where: { id: employeeId, organizationId, active: true },
    select: { id: true, userId: true },
  })
  if (!employee) throw new StaffScopeError('Employee not found', 404)
  return { kind: 'employee', employeeId: employee.id, userId: employee.userId || null }
}

export function applyEmployeeStaffScope(baseWhere: Record<string, any>, scope: ResolvedStaffScope) {
  if (scope.kind === 'all') return baseWhere
  return {
    AND: [
      baseWhere,
      { employeeId: scope.employeeId || -1 },
    ],
  }
}

export function applyUserStaffScope(baseWhere: Record<string, any>, scope: ResolvedStaffScope) {
  if (scope.kind === 'all') return baseWhere
  return {
    AND: [
      baseWhere,
      { assignedToId: scope.userId || -1 },
    ],
  }
}
