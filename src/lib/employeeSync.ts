import { prisma } from '@/lib/prisma'

export async function resolveUserIdForEmployee(organizationId: string, employeeId?: number | null) {
  if (!organizationId || !employeeId) return null

  const employee = await (prisma as any).employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { userId: true },
  })
  return employee?.userId || null
}
