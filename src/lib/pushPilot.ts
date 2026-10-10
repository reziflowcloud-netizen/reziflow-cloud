import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma.ts'
import { deliverNotificationPush } from './notificationPush.ts'
import { notificationUser, notificationsEnabled } from './notifications.ts'
import { notificationPreferences, canReceiveTeam } from './notificationPolicy.ts'
import { pushConfigured, pushUserAllowed } from './pushSecurity.ts'
import { PUSH_PILOT_TYPE, pushPilotText, validPilotRequestId } from './pushPilotPolicy.ts'

export class PushPilotError extends Error {
  status: number
  constructor(status: number) { super('Push pilot unavailable'); this.status = status }
}
// One recipient, one explicit device, one provider attempt. No automatic events or scheduler.
export async function sendPushPilot(user: { id: number; organizationId: string }, subscriptionId: string, requestId: string, db: any = prisma, sender?: Parameters<typeof deliverNotificationPush>[1], now = new Date(), language?: 'ru' | 'uk' | 'pl') {
  if (!notificationsEnabled() || !pushConfigured() || !pushUserAllowed(user.id)) throw new PushPilotError(503)
  if (!validPilotRequestId(requestId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(subscriptionId)) throw new PushPilotError(400)
  if (language !== undefined && !['ru', 'uk', 'pl'].includes(language)) throw new PushPilotError(400)
  const delivery = await db.$transaction(async (tx: any) => {
    // Serialize this recipient's manual tests across devices and concurrent requests.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(731201, ${user.id}::int)::text`)
    const current = await notificationUser(user.id, user.organizationId, tx)
    const preferences = notificationPreferences(current?.notificationPreference, current && canReceiveTeam(current))
    if (!current || !preferences.pushEnabled) throw new PushPilotError(403)
    const identity = { userId: user.id, organizationId: user.organizationId }
    const subscription = await tx.pushSubscription.findFirst({ where: { ...identity, id: subscriptionId, disabledAt: null } })
    if (!subscription) throw new PushPilotError(404)
    const dedupeKey = `push-pilot:${requestId}`
    const existing = await tx.notification.findUnique({ where: { organizationId_userId_dedupeKey: { ...identity, dedupeKey } } })
    if (existing) {
      const previous = await tx.notificationPushDelivery.findFirst({ where: { ...identity, notificationId: existing.id, subscriptionId } })
      if (!previous) throw new PushPilotError(409)
      return previous
    }
    const latest = await tx.notification.findFirst({ where: { ...identity, type: PUSH_PILOT_TYPE }, orderBy: { createdAt: 'desc' } })
    if (latest && now.getTime() - latest.createdAt.getTime() < 30000) throw new PushPilotError(429)
    const daily = await tx.notification.count({ where: { ...identity, type: PUSH_PILOT_TYPE, createdAt: { gte: new Date(now.getTime() - 86400000) } } })
    if (daily >= 20) throw new PushPilotError(429)
    const id = randomUUID(), copy = pushPilotText[language ?? preferences.language]
    await tx.notification.create({ data: { ...identity, id, type: PUSH_PILOT_TYPE, title: copy.title, body: copy.body, entityType: PUSH_PILOT_TYPE, entityId: id, deepLink: '/dashboard', dedupeKey, inApp: true, pushRequested: true, createdAt: now } })
    return tx.notificationPushDelivery.create({ data: { ...identity, notificationId: id, subscriptionId, nextAttemptAt: now } })
  }, { timeout: 15000 })
  await deliverNotificationPush(db, sender, now, { deliveryId: delivery.id, userId: user.id, organizationId: user.organizationId })
  const result = await db.notificationPushDelivery.findFirst({ where: { id: delivery.id, userId: user.id, organizationId: user.organizationId }, select: { deliveredAt: true, terminalAt: true, notificationId: true } })
  return { notificationId: result?.notificationId, status: result?.deliveredAt ? 'accepted' : result?.terminalAt ? 'failed' : 'pending' }
}
