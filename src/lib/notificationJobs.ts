import { prisma } from './prisma.ts'
import { caseOccurrences, leadContactOccurrence, taskOccurrences } from './notificationPolicy.ts'
import { emitNotification, notificationEventsEnabled } from './notifications.ts'

export type EvaluationCursor = { kind: 'task' | 'case' | 'lead'; after: string }
export function parseEvaluationCursor(value: string | null): EvaluationCursor {
  if (!value) return { kind: 'task', after: '' }
  const match = value.match(/^(task|case|lead):([a-zA-Z0-9_-]{0,100})$/)
  if (!match) throw new Error('Invalid cursor')
  return { kind: match[1] as EvaluationCursor['kind'], after: match[2] }
}
// Each invocation processes one bounded page. Scheduler drains nextCursor until null.
export async function evaluateNotificationPage(cursor: EvaluationCursor, now = new Date(), db: any = prisma) {
  if (!notificationEventsEnabled()) return { evaluated: 0, nextCursor: null }
  const records = await db[cursor.kind].findMany({
    where: { organizationId: { not: null }, id: { gt: cursor.after }, ...(cursor.kind === 'task' ? { status: { notIn: ['done', 'completed', 'cancelled', 'canceled', 'inactive'] } } : {}) },
    orderBy: { id: 'asc' }, take: 25,
    ...(cursor.kind === 'case' ? { include: { client: { select: { organizationId: true, firstName: true, lastName: true } }, customDates: true, statusHistory: { select: { fromStatus: true, changedAt: true } } } } : {}),
  })
  for (const record of records) {
    const occurrences = cursor.kind === 'task' ? taskOccurrences(record, now) : cursor.kind === 'case' ? caseOccurrences(record, now) : []
    const leadOccurrence = cursor.kind === 'lead' ? leadContactOccurrence(record, now) : null
    if (leadOccurrence) occurrences.push({ type: 'lead_contact', occurrence: leadOccurrence } as any)
    for (const event of occurrences) {
      // Re-read under a row lock: assignment/date/completion cannot race generation.
      await db.$transaction(async (tx: any) => {
        const table = { task: 'Task', case: 'Case', lead: 'Lead' }[cursor.kind]
        await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, record.id)
        const fresh = await tx[cursor.kind].findFirst({ where: { id: record.id, organizationId: record.organizationId }, ...(cursor.kind === 'case' ? { include: { client: { select: { organizationId: true, firstName: true, lastName: true } }, customDates: true, statusHistory: { select: { fromStatus: true, changedAt: true } } } } : {}) })
        if (!fresh) return
        const stillDue = cursor.kind === 'task' ? taskOccurrences(fresh, now) : cursor.kind === 'case' ? caseOccurrences(fresh, now) : [{ type: 'lead_contact', occurrence: leadContactOccurrence(fresh, now) }]
        if (stillDue.some((item: any) => item.type === event.type && item.occurrence === event.occurrence)) await emitNotification(tx, event.type, cursor.kind, fresh, event.occurrence)
      })
    }
  }
  const nextKind = { task: 'case', case: 'lead', lead: null }[cursor.kind]
  return { evaluated: records.length, nextCursor: records.length === 25 ? `${cursor.kind}:${records[24].id}` : nextKind ? `${nextKind}:` : null }
}
