import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export type DataAccessScope = {
  restricted: boolean
  userId: number | null
}

function isPrivilegedRole(role?: string | null) {
  return role === 'admin' || role === 'owner'
}

export async function getDataAccessScope(user: any, organizationId: string): Promise<DataAccessScope> {
  const userId = Number(user?.id)
  if (!Number.isFinite(userId)) return { restricted: false, userId: null }

  const dbUser = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { role: true, restrictedAccess: true },
  } as any)
  const role = dbUser?.role || user?.role
  if (isPrivilegedRole(role)) return { restricted: false, userId }
  const restricted = dbUser?.restrictedAccess === true
  return { restricted, userId }
}

export function caseWhereForScope(scope: DataAccessScope, organizationId: string, extra: Record<string, any> = {}) {
  return {
    organizationId,
    ...extra,
    ...(scope.restricted && scope.userId ? { assignedToId: scope.userId } : {}),
  }
}

export function clientWhereForScope(scope: DataAccessScope, organizationId: string, extra: Record<string, any> = {}) {
  const base = { organizationId, ...extra }
  if (!scope.restricted || !scope.userId) return base
  return {
    ...base,
    OR: [
      { assignedToId: scope.userId },
      { cases: { some: { organizationId, assignedToId: scope.userId } } },
    ],
  }
}

export function leadWhereForScope(scope: DataAccessScope, organizationId: string, extra: Record<string, any> = {}) {
  return {
    organizationId,
    ...extra,
    ...(scope.restricted && scope.userId ? { assignedToId: scope.userId } : {}),
  }
}

export function taskWhereForScope(scope: DataAccessScope, organizationId: string, extra: Record<string, any> = {}) {
  return {
    organizationId,
    ...extra,
    ...(scope.restricted && scope.userId ? { assignedToId: scope.userId } : {}),
  }
}

async function getCurrentRequestScope(organizationId: string) {
  const user = await getUser()
  return getDataAccessScope(user, organizationId)
}

export async function findScopedCase(caseId: string, organizationId: string, select?: any) {
  const scope = await getCurrentRequestScope(organizationId)
  return prisma.case.findFirst({
    where: caseWhereForScope(scope, organizationId, { id: caseId }),
    ...(select ? { select } : {}),
  } as any)
}

export async function findScopedClient(clientId: string, organizationId: string, select?: any) {
  const scope = await getCurrentRequestScope(organizationId)
  return prisma.client.findFirst({
    where: clientWhereForScope(scope, organizationId, { id: clientId }),
    ...(select ? { select } : {}),
  } as any)
}

export async function findScopedLead(leadId: string, organizationId: string, select?: any) {
  const scope = await getCurrentRequestScope(organizationId)
  return (prisma as any).lead.findFirst({
    where: leadWhereForScope(scope, organizationId, { id: leadId }),
    ...(select ? { select } : {}),
  } as any)
}

export async function findScopedTask(taskId: string, organizationId: string, select?: any) {
  const scope = await getCurrentRequestScope(organizationId)
  return prisma.task.findFirst({
    where: taskWhereForScope(scope, organizationId, { id: taskId }),
    ...(select ? { select } : {}),
  } as any)
}
