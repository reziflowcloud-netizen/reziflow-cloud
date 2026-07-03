import { prisma } from '@/lib/prisma'

export function normalizePersonName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function userDisplayName(user: { name?: string | null; email?: string | null }) {
  return String(user.name || user.email || '').trim()
}

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

  const employeeByName = new Map<string, any>()
  for (const employee of employees as any[]) {
    const key = normalizePersonName(employee.name)
    if (key && !employeeByName.has(key)) employeeByName.set(key, employee)
  }

  const employeesToCreate: Array<{ organizationId: string; name: string; active: boolean }> = []
  const employeesToActivate: number[] = []

  for (const user of users) {
    const name = userDisplayName(user)
    const key = normalizePersonName(name)
    if (!key) continue

    const existing = employeeByName.get(key)
    if (existing) {
      if (existing.active === false) employeesToActivate.push(existing.id)
      continue
    }

    employeesToCreate.push({ organizationId, name, active: true })
    employeeByName.set(key, { name, pending: true })
  }

  if (employeesToCreate.length) {
    await (prisma as any).employee.createMany({ data: employeesToCreate })
  }

  if (employeesToActivate.length) {
    await (prisma as any).employee.updateMany({
      where: { organizationId, id: { in: employeesToActivate } },
      data: { active: true },
    })
  }

  const syncedEmployees = (employeesToCreate.length || employeesToActivate.length)
    ? await (prisma as any).employee.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    : employees

  const syncedByName = new Map<string, any>()
  for (const employee of syncedEmployees as any[]) {
    const key = normalizePersonName(employee.name)
    if (key && !syncedByName.has(key)) syncedByName.set(key, employee)
  }

  const backfill: Promise<any>[] = []
  for (const user of users) {
    const employee = syncedByName.get(normalizePersonName(userDisplayName(user)))
    if (!employee?.id) continue

    backfill.push((prisma as any).case.updateMany({
      where: { organizationId, assignedToId: user.id, employeeId: null },
      data: { employeeId: employee.id },
    }))
    backfill.push((prisma as any).lead.updateMany({
      where: { organizationId, assignedToId: user.id, employeeId: null },
      data: { employeeId: employee.id },
    }))
  }

  if (backfill.length) await Promise.all(backfill)
  return syncedEmployees
}

export async function resolveUserIdForEmployee(organizationId: string, employeeId?: number | null) {
  if (!organizationId || !employeeId) return null

  const employee = await (prisma as any).employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { name: true },
  })
  const employeeName = normalizePersonName(employee?.name)
  if (!employeeName) return null

  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, email: true },
  })

  const match = users.find(user => normalizePersonName(userDisplayName(user)) === employeeName)
  return match?.id || null
}
