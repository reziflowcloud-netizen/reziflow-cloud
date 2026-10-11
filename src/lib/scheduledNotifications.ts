import { Prisma } from '@prisma/client'
import { notificationEventAllowed } from './notificationEventGate.ts'
import { canReceiveTeam, entityLink, notificationPreferences, type NotificationType } from './notificationPolicy.ts'
import { notificationText } from './notificationI18n.ts'
import { entityContext } from './notifications.ts'
import { lockedOrganizationAutomation } from './notificationOrganization.ts'
import { occurrenceTriggerAt } from './notificationOccurrence.ts'

// Only the short entity transaction client is used, never global Prisma.
// Phase 3A's assignment emitter keeps its existing behavior.
export type ScheduledMetrics = { skippedUnlinkedEmployees: number; duplicatesPrevented: number; deliveriesCreated: number; recipientsEvaluated: number }
export async function emitScheduledNotifications(db: any, entityType: string, record: any, events: { type: NotificationType; occurrence: string }[], metrics?: ScheduledMetrics) {
  if (!record.assignedToId || !events.length) return 0
  const organizationId = record.organizationId
  const automation = await lockedOrganizationAutomation(db, organizationId)
  if (!automation.enabled) return 0
  events = events.filter(event => occurrenceTriggerAt(event) >= Date.parse(automation.activatedAt!))
  if (!events.length) return 0
  const linked = record.employeeId || entityType === 'lead' ? await db.employee.findFirst({
    where: { organizationId, active: true, ...(record.employeeId ? { id: record.employeeId } : { userId: record.assignedToId }) }, select: { userId: true },
  }) : null
  if ((record.employeeId || entityType === 'lead') && linked?.userId !== record.assignedToId) { if (metrics) metrics.skippedUnlinkedEmployees++; return 0 }
  const users = await db.user.findMany({
    where: { organizationId, OR: [{ id: record.assignedToId }, { role: { in: ['owner', 'admin'] }, notificationPreference: { scope: 'team' } }] },
    select: { id: true, role: true, restrictedAccess: true, notificationPreference: true }, take: 101,
  })
  if (users.length > 100) throw new Error('Scheduled recipient scope exceeds bounds')
  const responsible = users.find((user: any) => user.id === record.assignedToId) || await db.user.findFirst({ where: { id: record.assignedToId, organizationId }, select: { id: true } })
  if (!responsible) return 0
  const rows = users.flatMap((user: any) => {
    const preference = notificationPreferences(user.notificationPreference, canReceiveTeam(user))
    if (user.id !== record.assignedToId && (!canReceiveTeam(user) || preference.scope !== 'team')) return []
    return events.flatMap(event => {
      if (!notificationEventAllowed(event.type, organizationId, user.id)) return []
      const toggle = preference.events[event.type], pushRequested = toggle.push && preference.pushEnabled
      if (!toggle.inApp && !pushRequested) return []
      const copy = notificationText[preference.language]
      const date = event.type === 'case_date' ? event.occurrence.match(/^(.*):(\d{4}-\d{2}-\d{2}):(1d|7d)$/) : null
      const label = date ? (copy.dates as Record<string, string>)[date[1].startsWith('custom:') ? 'custom' : date[1]] : ''
      const context = [entityContext(entityType, record), date ? `${label} · ${date[2]}` : event.occurrence.match(/\d{4}-\d{2}-\d{2}/)?.[0]].filter(Boolean).join(' · ')
      return [{ organizationId, userId: user.id, type: event.type, title: copy.events[event.type], body: context, entityType, entityId: record.id, deepLink: entityLink(entityType, record.id), dedupeKey: `${event.type}:${entityType}:${record.id}:${event.occurrence}`, inApp: toggle.inApp, pushRequested }]
    })
  })
  if (!rows.length) return 0
  const pushRows = rows.filter((row: any) => row.pushRequested)
  const pushUsers = Array.from(new Set(pushRows.map((row: any) => row.userId)))
  // Bound outbox fan-out without changing subscription registration/ownership.
  // Reject an oversized pilot atomically; never silently drop active devices.
  if (pushUsers.length && await db.pushSubscription.count({ where: { organizationId, userId: { in: pushUsers }, disabledAt: null } }) > 100) throw new Error('Scheduled pilot device scope exceeds bounds')
  let created = 0
  for (let offset = 0; offset < rows.length; offset += 500) created += (await db.notification.createMany({ data: rows.slice(offset, offset + 500), skipDuplicates: true })).count
  if (metrics) { metrics.duplicatesPrevented += rows.length - created; metrics.recipientsEvaluated += new Set(rows.map((row: any) => row.userId)).size }
  if (!pushRows.length) return created
  // The durable outbox is written atomically with notifications. Composite FKs
  // and uniqueness remain the final ownership/concurrent retry protection.
  const deliveries = await db.$executeRaw(Prisma.sql`INSERT INTO "NotificationPushDelivery" (id, "organizationId", "userId", "notificationId", "subscriptionId")
    SELECT gen_random_uuid()::text, n."organizationId", n."userId", n.id, s.id
    FROM "Notification" n JOIN "PushSubscription" s ON s."organizationId" = n."organizationId" AND s."userId" = n."userId"
    WHERE n."organizationId" = ${organizationId} AND n."entityId" = ${record.id} AND n."entityType" = ${entityType}
      AND n."userId" IN (${Prisma.join(pushUsers)})
      AND n."dedupeKey" IN (${Prisma.join(Array.from(new Set(pushRows.map((row: any) => row.dedupeKey))))})
      AND n."pushRequested" = true AND n."readAt" IS NULL AND n."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '1 day'
      AND s."disabledAt" IS NULL AND s."createdAt" <= n."createdAt"
    ON CONFLICT ("notificationId", "subscriptionId") DO NOTHING`)
  if (metrics) metrics.deliveriesCreated += deliveries
  return created
}
