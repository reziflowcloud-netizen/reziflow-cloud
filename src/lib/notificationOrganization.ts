import { Prisma } from '@prisma/client'

export function canManageNotificationAutomation(user: any) {
  return ['owner', 'admin'].includes(user?.role) && user?.restrictedAccess !== true
}
export function organizationAutomation(record: any) {
  const since = record?.notificationAutomationActivatedAt ? new Date(record.notificationAutomationActivatedAt) : null
  const enabled = record?.notificationAutomationEnabled === true && since !== null && Number.isFinite(since.getTime())
  return { enabled, activatedAt: enabled ? since!.toISOString() : null }
}
// Always use the supplied transaction client. Lock also serializes toggle against
// generation; OFF/re-enable cannot leave new copies from the old activation.
export async function lockedOrganizationAutomation(db: any, organizationId: string) {
  const rows = await db.$queryRaw(Prisma.sql`SELECT "notificationAutomationEnabled", "notificationAutomationActivatedAt"
    FROM "Organization" WHERE id = ${organizationId} FOR SHARE`)
  return organizationAutomation(rows[0])
}
export async function setOrganizationAutomation(db: any, actor: { id: number; organizationId: string }, enabled: boolean) {
  return db.$transaction(async (tx: any) => {
    const user = await tx.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId }, select: { role: true, restrictedAccess: true } })
    if (!canManageNotificationAutomation(user)) throw new Error('Forbidden')
    const rows = await tx.$queryRaw(Prisma.sql`SELECT "notificationAutomationEnabled", "notificationAutomationActivatedAt"
      FROM "Organization" WHERE id = ${actor.organizationId} FOR UPDATE`)
    if (!rows.length) throw new Error('Forbidden')
    const current = organizationAutomation(rows[0])
    if (current.enabled === enabled) return current
    const updated = await tx.$queryRaw(Prisma.sql`UPDATE "Organization" SET
      "notificationAutomationEnabled" = ${enabled},
      "notificationAutomationActivatedAt" = CASE WHEN ${enabled} THEN clock_timestamp() AT TIME ZONE 'UTC' ELSE "notificationAutomationActivatedAt" END,
      "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
      WHERE id = ${actor.organizationId} RETURNING "notificationAutomationEnabled", "notificationAutomationActivatedAt"`)
    return organizationAutomation(updated[0])
  }, { maxWait: 10000, timeout: 10000 })
}
