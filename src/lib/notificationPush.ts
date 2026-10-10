import { randomUUID } from 'node:crypto'
import webPush from 'web-push'
import { prisma } from './prisma.ts'
import { authorizedNotification, notificationUser, notificationsEnabled, notificationEventsEnabled, unreadNotificationCount } from './notifications.ts'
import { CASE_NOTIFICATION_DATE_FIELDS, canReceiveTeam, notificationPreferences, notificationStillActionable, type NotificationType } from './notificationPolicy.ts'
import { notificationText } from './notificationI18n.ts'
import { decryptSubscription, pushConfigured, pushPilotUserIds, pushUserAllowed, subscriptionAAD } from './pushSecurity.ts'
import { isPushPilotNotification, pushPilotText } from './pushPilotPolicy.ts'

export function pushPayload(notification: any, preferences: ReturnType<typeof notificationPreferences>, clientName: string, unread: number) {
  const copy = notificationText[preferences.language]
  const pilotCopy = Object.values(pushPilotText).find(value => value.title === notification.title && value.body === notification.body) || pushPilotText[preferences.language]
  return {
    title: 'LegalHub CRM',
    body: isPushPilotNotification(notification) ? `${pilotCopy.title}\n${pilotCopy.body}` : `${copy.events[notification.type as NotificationType]}\n${preferences.showClientName && clientName ? clientName.slice(0, 100) : copy.open}`,
    tag: notification.id,
    url: `/notifications/open/${notification.id}`,
    unread,
  }
}
type PushSender = (subscription: any, payload: string, options: any) => Promise<unknown>
export async function deliverNotificationPush(db: any = prisma, sender: PushSender = webPush.sendNotification, now = new Date(), scope?: { deliveryId: string; userId: number; organizationId: string }) {
  if (!notificationsEnabled() || !pushConfigured()) return { processed: 0, delivered: 0 }
  if (!scope && !notificationEventsEnabled()) return { processed: 0, delivered: 0 }
  const rows = await db.notificationPushDelivery.findMany({
    where: { deliveredAt: null, terminalAt: null, nextAttemptAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }], ...(scope ? { id: scope.deliveryId, userId: scope.userId, organizationId: scope.organizationId, attempts: 0 } : { userId: { in: pushPilotUserIds() }, notification: { entityType: { not: 'push_test' } } }) },
    orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: 20,
  })
  let delivered = 0
  const startedAt = Date.now()
  for (const row of rows) {
    if (Date.now() - startedAt > 30000) break
    const leaseToken = randomUUID()
    const claim = await db.notificationPushDelivery.updateMany({ where: { id: row.id, deliveredAt: null, terminalAt: null, ...(scope ? { attempts: 0 } : {}), OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { leaseToken, leaseUntil: new Date(now.getTime() + 120000), attempts: { increment: 1 } } })
    if (!claim.count) continue
    const lease = { id: row.id, leaseToken }
    try {
      const user = await notificationUser(row.userId, row.organizationId, db)
      const notification = user ? await authorizedNotification(user, row.notificationId, db) : null
      const subscription = await db.pushSubscription.findFirst({ where: { id: row.subscriptionId, userId: row.userId, organizationId: row.organizationId, disabledAt: null } })
      const preferences = notificationPreferences(user?.notificationPreference, user && canReceiveTeam(user))
      const pilot = isPushPilotNotification(notification)
      if (!notification || !subscription || !pushUserAllowed(row.userId) || notification.readAt || !notification.pushRequested || !preferences.pushEnabled || (!pilot && !preferences.events[notification.type as NotificationType]?.push) || now.getTime() - notification.createdAt.getTime() > 86400000) {
        await db.notificationPushDelivery.updateMany({ where: lease, data: { terminalAt: now, leaseUntil: null, leaseToken: null } }); continue
      }
      const raw = decryptSubscription(subscription.encryptedSubscription, subscriptionAAD(subscription))
      const where = { id: notification.entityId, organizationId: row.organizationId, ...(!canReceiveTeam(user) && user.restrictedAccess ? { assignedToId: user.id } : {}) }
      const selections = {
        case: { id: true, assignedToId: true, status: true, ...Object.fromEntries(CASE_NOTIFICATION_DATE_FIELDS.map(field => [field, true])), customDates: { select: { id: true, date: true } }, statusHistory: { select: { fromStatus: true, changedAt: true } }, client: { select: { organizationId: true, firstName: true, lastName: true } } },
        lead: { id: true, assignedToId: true, fullName: true, firstName: true, lastName: true, nextContactAt: true, lastContactAt: true, convertedAt: true, convertedClientId: true, status: true },
        task: { id: true, assignedToId: true, clientName: true, status: true, dueDate: true, description: true },
      }
      const record = pilot ? null : await db[notification.entityType].findFirst({ where, select: selections[notification.entityType as keyof typeof selections] })
      if (!pilot && !notificationStillActionable(notification, record, now)) {
        await db.notificationPushDelivery.updateMany({ where: lease, data: { terminalAt: now, leaseUntil: null, leaseToken: null } }); continue
      }
      let clientName = ''
      if (!pilot && preferences.showClientName) {
        clientName = notification.entityType === 'case' ? record?.client?.organizationId === row.organizationId ? [record.client.firstName, record.client.lastName].filter(Boolean).join(' ') : '' : notification.entityType === 'lead' ? record?.fullName || [record?.firstName, record?.lastName].filter(Boolean).join(' ') : record?.clientName || ''
      }
      await sender(raw, JSON.stringify(pushPayload(notification, preferences, clientName, await unreadNotificationCount(user, db))), {
        TTL: 3600, timeout: 8000, urgency: notification.type === 'task_overdue' ? 'high' : 'normal',
        vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
      })
      await db.notificationPushDelivery.updateMany({ where: lease, data: { deliveredAt: new Date(), leaseUntil: null, leaseToken: null } })
      delivered++
    } catch (error) {
      const status = Number((error as any)?.statusCode)
      if (status === 404 || status === 410) {
        // Crypto keys/endpoint are erased as soon as a subscription expires.
        await db.pushSubscription.updateMany({ where: { id: row.subscriptionId, userId: row.userId, organizationId: row.organizationId }, data: { disabledAt: now, lastFailureAt: now, encryptedSubscription: '' } })
        await db.notificationPushDelivery.updateMany({ where: { subscriptionId: row.subscriptionId, userId: row.userId, organizationId: row.organizationId, deliveredAt: null }, data: { terminalAt: now } })
      } else {
        await db.pushSubscription.updateMany({ where: { id: row.subscriptionId, userId: row.userId, organizationId: row.organizationId }, data: { lastFailureAt: now } })
      }
      const attempts = row.attempts + 1
      await db.notificationPushDelivery.updateMany({ where: lease, data: { leaseUntil: null, leaseToken: null, ...(scope || status === 404 || status === 410 || attempts >= 5 ? { terminalAt: now } : { nextAttemptAt: new Date(now.getTime() + Math.min(3600000, 60000 * 2 ** attempts)) }) } })
      // Never log provider errors, endpoint URLs, keys or payloads.
    }
  }
  return { processed: rows.length, delivered }
}
