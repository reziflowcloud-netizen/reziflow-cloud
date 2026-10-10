import { Prisma } from '@prisma/client'
import { prisma } from './prisma.ts'
import { assignmentOccurrence, canReceiveTeam, entityLink, notificationPreferences, type NotificationType } from './notificationPolicy.ts'
import { notificationText } from './notificationI18n.ts'

export function notificationsEnabled() { return process.env.NOTIFICATIONS_ENABLED === 'true' }
export function notificationEventsEnabled() { return notificationsEnabled() && process.env.NOTIFICATION_EVENTS_ENABLED === 'true' }

export async function notificationUser(userId: number, organizationId: string, db: any = prisma) {
  return db.user.findFirst({ where: { id: userId, organizationId }, select: { id: true, role: true, restrictedAccess: true, organizationId: true, notificationPreference: true } })
}
// Bind every lookup to the authenticated User/tenant and current entity access.
// EXISTS also removes deleted/reassigned entities from both list and unread count.
export function visibleNotificationSql(user: any, inAppOnly = true) {
  const restricted = !canReceiveTeam(user) && user.restrictedAccess === true
  const access = restricted ? Prisma.sql`AND e."assignedToId" = ${user.id}` : Prisma.empty
  return Prisma.sql`n."organizationId" = ${user.organizationId} AND n."userId" = ${user.id}
    ${inAppOnly ? Prisma.sql`AND n."inApp" = true` : Prisma.empty}
    AND (
      (n."entityType" = 'lead' AND EXISTS (SELECT 1 FROM "Lead" e WHERE e.id = n."entityId" AND e."organizationId" = n."organizationId" ${access})) OR
      (n."entityType" = 'case' AND EXISTS (SELECT 1 FROM "Case" e WHERE e.id = n."entityId" AND e."organizationId" = n."organizationId" ${access})) OR
      (n."entityType" = 'task' AND EXISTS (SELECT 1 FROM "Task" e WHERE e.id = n."entityId" AND e."organizationId" = n."organizationId" ${access})) OR
      (n."type" = 'push_test' AND n."entityType" = 'push_test' AND n."entityId" = n.id AND n."deepLink" = '/dashboard' AND n."dedupeKey" ~ '^push-pilot:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    )`
}
export async function unreadNotificationCount(user: any, db: any = prisma) {
  const rows = await db.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS count FROM "Notification" n WHERE ${visibleNotificationSql(user)} AND n."readAt" IS NULL`)
  return rows[0].count as number
}
export async function listNotifications(user: any, cursor?: string | null, db: any = prisma) {
  let boundary = Prisma.empty
  if (cursor) {
    const row = await db.notification.findFirst({ where: { id: cursor, organizationId: user.organizationId, userId: user.id }, select: { createdAt: true, id: true } })
    if (!row) throw new Error('Invalid cursor')
    boundary = Prisma.sql`AND (n."createdAt", n.id) < (${row.createdAt}, ${row.id})`
  }
  const ids = await db.$queryRaw(Prisma.sql`SELECT n.id FROM "Notification" n WHERE ${visibleNotificationSql(user)} ${boundary} ORDER BY n."createdAt" DESC, n.id DESC LIMIT 31`)
  const items = await db.notification.findMany({ where: { id: { in: ids.slice(0, 30).map((row: any) => row.id) }, organizationId: user.organizationId, userId: user.id }, select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  return { items, nextCursor: ids.length > 30 ? items[items.length - 1].id : null, unread: await unreadNotificationCount(user, db) }
}
export async function markNotificationsRead(user: any, id?: string, db: any = prisma) {
  return db.$executeRaw(Prisma.sql`UPDATE "Notification" n SET "readAt" = NOW() WHERE ${visibleNotificationSql(user)} AND n."readAt" IS NULL ${id ? Prisma.sql`AND n.id = ${id}` : Prisma.empty}`)
}
export async function authorizedNotification(user: any, id: string, db: any = prisma) {
  const ids = await db.$queryRaw(Prisma.sql`SELECT n.id FROM "Notification" n WHERE ${visibleNotificationSql(user, false)} AND n.id = ${id} LIMIT 1`)
  if (!ids.length) return null
  return db.notification.findFirst({ where: { id, organizationId: user.organizationId, userId: user.id } })
}
export function entityContext(entityType: string, record: any) {
  if (entityType === 'lead') return String(record.fullName || `${record.firstName || ''} ${record.lastName || ''}`.trim()).slice(0, 120)
  if (entityType === 'case') {
    const client = record.client?.organizationId === record.organizationId ? record.client : null
    return [record.caseNumber, client?.firstName, client?.lastName].filter(Boolean).join(' ').slice(0, 120)
  }
  return String(record.title || '').slice(0, 120)
}
export async function emitNotification(db: any, type: NotificationType, entityType: string, record: any, occurrence: string) {
  if (!notificationEventsEnabled() || !record.organizationId) return
  const organizationId = record.organizationId
  const linked = record.employeeId ? await db.employee.findFirst({ where: { id: record.employeeId, organizationId, active: true }, select: { userId: true } }) : null
  const ownIds = Array.from(new Set([record.assignedToId, linked?.userId].filter(Boolean)))
  const recipients = await db.user.findMany({
    where: { organizationId, OR: [{ id: { in: ownIds } }, { role: { in: ['owner', 'admin'] }, notificationPreference: { scope: 'team' } }] },
    select: { id: true, role: true, restrictedAccess: true, notificationPreference: true },
  })
  for (const user of recipients) {
    const preference = notificationPreferences(user.notificationPreference, canReceiveTeam(user))
    const own = ownIds.includes(user.id)
    if (!own && preference.scope !== 'team') continue
    if (!canReceiveTeam(user) && user.restrictedAccess && record.assignedToId !== user.id) continue
    const event = preference.events[type]
    if (!event.inApp && !(event.push && preference.pushEnabled)) continue
    const dedupeKey = `${type}:${entityType}:${record.id}:${occurrence}`
    const copy = notificationText[preference.language]
    const date = type === 'case_date' ? occurrence.match(/^(.*):(\d{4}-\d{2}-\d{2}):(1d|7d)$/) : null
    const dateLabel = date ? (copy.dates as Record<string, string>)[date[1].startsWith('custom:') ? 'custom' : date[1]] : ''
    const context = [entityContext(entityType, record), date ? `${dateLabel} · ${date[2]}` : ['task_due', 'task_overdue', 'lead_contact'].includes(type) ? occurrence.match(/\d{4}-\d{2}-\d{2}/)?.[0] : ''].filter(Boolean).join(' · ')
    await db.notification.createMany({ data: [{ organizationId, userId: user.id, type, title: copy.events[type], body: context, entityType, entityId: record.id, deepLink: entityLink(entityType, record.id), dedupeKey, inApp: event.inApp, pushRequested: event.push && preference.pushEnabled }], skipDuplicates: true })
    const notification = await db.notification.findUnique({ where: { organizationId_userId_dedupeKey: { organizationId, userId: user.id, dedupeKey } }, select: { id: true, pushRequested: true, createdAt: true } })
    if (!notification?.pushRequested || Date.now() - notification.createdAt.getTime() > 86400000) continue
    const subscriptions = await db.pushSubscription.findMany({ where: { organizationId, userId: user.id, disabledAt: null, createdAt: { lte: notification.createdAt } }, select: { id: true } })
    if (subscriptions.length) await db.notificationPushDelivery.createMany({ data: subscriptions.map((sub: any) => ({ organizationId, userId: user.id, notificationId: notification.id, subscriptionId: sub.id })), skipDuplicates: true })
  }
}
export async function notifyAssignment(db: any, entityType: 'lead' | 'task', current: any, previous?: any) {
  const occurrence = assignmentOccurrence(current, previous)
  if (occurrence) await emitNotification(db, entityType === 'lead' ? 'lead_assigned' : 'task_assigned', entityType, current, occurrence)
}

// Bulk assignments share recipient/preferences reads and write records in bounded chunks.
export async function notifyLeadAssignmentBatch(db: any, organizationId: string, updated: any[], previous: any[]) {
  if (!notificationEventsEnabled()) return
  const old = new Map(previous.map(record => [record.id, record]))
  const changed = updated.filter(record => assignmentOccurrence(record, old.get(record.id)))
  if (!changed.length) return
  const recipients = await db.user.findMany({ where: { organizationId, OR: [{ id: { in: Array.from(new Set(changed.map(record => record.assignedToId))) } }, { role: { in: ['owner', 'admin'] }, notificationPreference: { scope: 'team' } }] }, select: { id: true, role: true, restrictedAccess: true, notificationPreference: true } })
  const rows: any[] = []
  for (const record of changed) for (const user of recipients) {
    const preference = notificationPreferences(user.notificationPreference, canReceiveTeam(user))
    if (record.assignedToId !== user.id && preference.scope !== 'team') continue
    if (!canReceiveTeam(user) && user.restrictedAccess && record.assignedToId !== user.id) continue
    const event = preference.events.lead_assigned
    if (!event.inApp && !(event.push && preference.pushEnabled)) continue
    rows.push({ organizationId, userId: user.id, type: 'lead_assigned', title: notificationText[preference.language].events.lead_assigned, body: entityContext('lead', record), entityType: 'lead', entityId: record.id, deepLink: entityLink('lead', record.id), dedupeKey: `lead_assigned:lead:${record.id}:${assignmentOccurrence(record, old.get(record.id))}`, inApp: event.inApp, pushRequested: event.push && preference.pushEnabled })
  }
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500)
    await db.notification.createMany({ data: chunk, skipDuplicates: true })
    const notifications = await db.notification.findMany({ where: { organizationId, dedupeKey: { in: chunk.map(row => row.dedupeKey) }, userId: { in: recipients.map((user: any) => user.id) }, pushRequested: true, createdAt: { gte: new Date(Date.now() - 86400000) } }, select: { id: true, userId: true, createdAt: true } })
    const subscriptions = notifications.length ? await db.pushSubscription.findMany({ where: { organizationId, userId: { in: notifications.map((notification: any) => notification.userId) }, disabledAt: null }, select: { id: true, userId: true, createdAt: true } }) : []
    const deliveries = notifications.flatMap((notification: any) => subscriptions.filter((sub: any) => sub.userId === notification.userId && sub.createdAt <= notification.createdAt).map((sub: any) => ({ organizationId, userId: notification.userId, notificationId: notification.id, subscriptionId: sub.id })))
    for (let index = 0; index < deliveries.length; index += 500) await db.notificationPushDelivery.createMany({ data: deliveries.slice(index, index + 500), skipDuplicates: true })
  }
}
