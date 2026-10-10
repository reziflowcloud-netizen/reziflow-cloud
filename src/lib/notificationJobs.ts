import { prisma } from './prisma.ts'
import { caseOccurrences, leadContactOccurrence, taskOccurrences } from './notificationPolicy.ts'
import { emitScheduledNotifications } from './scheduledNotifications.ts'
import { notificationEventOrgIds, notificationEventUserIds, scheduledEventsEnabled } from './notificationEventGate.ts'

export const EVALUATION_BATCH_SIZE = 25
export type EvaluationCursor = { kind: 'task' | 'case' | 'lead'; after: string }
export function parseEvaluationCursor(value: string | null): EvaluationCursor {
  if (!value) return { kind: 'task', after: '' }
  const match = value.match(/^(task|case|lead):([a-zA-Z0-9_-]{0,100})$/)
  if (!match) throw new Error('Invalid cursor')
  return { kind: match[1] as EvaluationCursor['kind'], after: match[2] }
}
function occurrences(kind: EvaluationCursor['kind'], record: any, now: Date) {
  if (kind === 'task') return taskOccurrences(record, now)
  if (kind === 'case') return caseOccurrences(record, now)
  const occurrence = leadContactOccurrence(record, now)
  return occurrence ? [{ type: 'lead_contact' as const, occurrence }] : []
}
// One page per invocation; short per-entity transactions, never a batch transaction.
export async function evaluateNotificationPage(cursor: EvaluationCursor, now = new Date(), db: any = prisma) {
  const start = Date.now(), orgs = notificationEventOrgIds()
  let evaluated = 0, notificationsCreated = 0
  const result = (nextCursor: string | null) => ({ evaluated, notificationsCreated, tenantsScanned: orgs.length, batches: evaluated ? 1 : 0, runtimeMs: Date.now() - start, nextCursor })
  if (!scheduledEventsEnabled()) return { evaluated: 0, nextCursor: null }
  let after = cursor.after
  // Fail closed instead of silently handling only part of a pilot allowlist.
  if (orgs.length > 10 || notificationEventUserIds().length > 100) throw new Error('Scheduled pilot scope exceeds bounds')
  const include = cursor.kind === 'case' ? {
    client: { select: { organizationId: true, firstName: true, lastName: true } },
    customDates: { orderBy: { id: 'asc' }, take: 101 },
    statusHistory: { where: { changedAt: { gte: new Date(now.getTime() - 3 * 86400000) } }, select: { fromStatus: true, changedAt: true }, take: 101 },
  } : undefined
  const records = await db[cursor.kind].findMany({
    where: { organizationId: { in: orgs }, id: { gt: after } }, orderBy: { id: 'asc' }, take: EVALUATION_BATCH_SIZE,
    ...(include ? { include } : {}),
  })
  for (const record of records) {
    if (evaluated && Date.now() - start >= 15000) return result(`${cursor.kind}:${after}`)
    if (cursor.kind === 'case' && (record.customDates.length > 100 || record.statusHistory.length > 100)) throw new Error('Case date/history page exceeds scheduled bounds')
    if (occurrences(cursor.kind, record, now).length) {
      notificationsCreated += await db.$transaction(async (tx: any) => {
        const table = { task: 'Task', case: 'Case', lead: 'Lead' }[cursor.kind]
        await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE`, record.id, record.organizationId)
        const fresh = await tx[cursor.kind].findFirst({ where: { id: record.id, organizationId: record.organizationId }, ...(include ? { include } : {}) })
        if (!fresh) return 0
        if (cursor.kind === 'case' && (fresh.customDates.length > 100 || fresh.statusHistory.length > 100)) throw new Error('Case date/history page exceeds scheduled bounds')
        return emitScheduledNotifications(tx, cursor.kind, fresh, occurrences(cursor.kind, fresh, now))
      }, { maxWait: 10000, timeout: 10000 })
    }
    after = record.id
    evaluated++
  }
  const nextKind = { task: 'case', case: 'lead', lead: null }[cursor.kind]
  return result(records.length === EVALUATION_BATCH_SIZE ? `${cursor.kind}:${after}` : nextKind ? `${nextKind}:` : null)
}
