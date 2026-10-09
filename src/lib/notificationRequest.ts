import { getUser } from './auth'
import { notificationUser, notificationsEnabled } from './notifications'
export async function authenticatedNotificationUser() {
  if (!notificationsEnabled()) return null
  const session = await getUser()
  if (!session) return null
  return notificationUser(Number(session.id), String(session.organizationId))
}
