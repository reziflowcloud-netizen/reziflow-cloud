import { prisma } from '@/lib/prisma'

// New Users get an explicit Employee identity. Existing unlinked Employees are
// never guessed by display name here; only the migration/dry-run backfill may
// link an already-existing pair after proving it is unambiguous.
export async function ensureUserEmployees(organizationId: string) {
  if (!organizationId) return []

  const [users, employees] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
    }),
    (prisma as any).employee.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    }),
  ])

  const byUserId = new Map<number, any>()
  for (const employee of employees as any[]) {
    if (employee.userId) byUserId.set(Number(employee.userId), employee)
  }

  const toCreate: Array<{ organizationId: string; name: string; active: boolean; userId: number }> = []
  const toReactivate: number[] = []
  for (const user of users) {
    const linked = byUserId.get(user.id)
    if (linked) {
      if (linked.active === false) toReactivate.push(linked.id)
      continue
    }
    toCreate.push({
      organizationId,
      name: String(user.name || user.email || '').trim() || user.email,
      active: true,
      userId: user.id,
    })
  }

  if (toCreate.length) await (prisma as any).employee.createMany({ data: toCreate, skipDuplicates: true })
  if (toReactivate.length) {
    await (prisma as any).employee.updateMany({
      where: { organizationId, id: { in: toReactivate } },
      data: { active: true },
    })
  }

  return toCreate.length || toReactivate.length
    ? (prisma as any).employee.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    : employees
}

export async function resolveUserIdForEmployee(organizationId: string, employeeId?: number | null) {
  if (!organizationId || !employeeId) return null

  const employee = await (prisma as any).employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { userId: true },
  })
  return employee?.userId || null
}
