import { NextRequest, NextResponse } from 'next/server'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { authorizedNotification, markNotificationsRead } from '@/lib/notifications'
import { entityLink } from '@/lib/notificationPolicy'
export const dynamic = 'force-dynamic'
function redirectInsideApp(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path, 'Cache-Control': 'private, no-store' } })
}
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticatedNotificationUser()
  if (!user) {
    return redirectInsideApp('/login?' + new URLSearchParams({ next: `/notifications/open/${params.id}` }))
  }
  const notification = await authorizedNotification(user, params.id)
  if (!notification) return redirectInsideApp('/settings/notifications?unavailable=1')
  await markNotificationsRead(user, notification.id)
  // Push-only records also become read after opening.
  const { prisma } = await import('@/lib/prisma')
  await prisma.notification.updateMany({ where: { id: notification.id, userId: user.id, organizationId: user.organizationId, readAt: null }, data: { readAt: new Date() } })
  return redirectInsideApp(entityLink(notification.entityType, notification.entityId))
}
