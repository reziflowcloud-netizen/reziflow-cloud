import { prisma } from './prisma.ts'
import { deliverNotificationPush } from './notificationPush.ts'
import { assignmentEventsEnabled } from './notificationEventGate.ts'

// Call only after commit. Provider failures must never undo a saved assignment.
// The durable outbox and sender leases make repeated dispatch safe.
export async function dispatchAssignmentPush(organizationId: string, entityIds: string[], db: any = prisma) {
  if (!assignmentEventsEnabled(organizationId) || !entityIds.length) return
  try {
    const startedAt = Date.now()
    do {
      const result = await deliverNotificationPush(db, undefined, new Date(), undefined, { organizationId, entityIds })
      if (result.processed < 20) break
    } while (Date.now() - startedAt < 30000)
  } catch {
    console.error('Assignment push dispatch unavailable')
  }
}
