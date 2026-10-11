import { prisma } from './prisma.ts'
import { scheduledOccurrences } from './notificationOccurrence.ts'
import { notificationCandidateQuery, type CandidateMode, type NotificationCandidate } from './notificationCandidates.ts'
import { emitScheduledNotifications } from './scheduledNotifications.ts'
import { scheduledEventsEnabled } from './notificationEventGate.ts'
import { lockedOrganizationAutomation } from './notificationOrganization.ts'

export const EVALUATION_BATCH_SIZE = 25
export type EvaluationCursor = { kind: CandidateMode; after: string; at?: string }
export function parseEvaluationCursor(value: string | null): EvaluationCursor {
  if (!value) return { kind: 'frequent', after: '' }
  const legacy = value.match(/^(task|case|lead):([a-zA-Z0-9_-]{0,100})$/)
  if (legacy && !legacy[2]) return { kind: legacy[1] as CandidateMode, after: '' }
  if (!/^n\.[a-zA-Z0-9_-]{1,700}$/.test(value)) throw new Error('Invalid cursor')
  const data = JSON.parse(Buffer.from(value.slice(2), 'base64url').toString('utf8'))
  if (Object.keys(data).sort().join(',') !== 'after,at,kind' || !['frequent','daily','task','lead','case'].includes(data.kind) || typeof data.after !== 'string' || data.after.length > 300 || !/^[a-zA-Z0-9_:.-]+$/.test(data.after) || typeof data.at !== 'string' || !Number.isFinite(Date.parse(data.at)) || new Date(data.at).toISOString() !== data.at) throw new Error('Invalid cursor')
  return data
}
function encode(cursor: EvaluationCursor) { return 'n.' + Buffer.from(JSON.stringify(cursor)).toString('base64url') }
// SQL filters occurrences before LIMIT. Recheck only selected rows under short
// transactions; provider calls remain outside transactions. Freeze run time so
// retries/continuations evaluate the same date/window across midnight.
export async function evaluateNotificationPage(cursor: EvaluationCursor = parseEvaluationCursor(null), time = new Date(), db: any = prisma) {
  const now = cursor.at ? new Date(cursor.at) : time, start = Date.now()
  let evaluated = 0, notificationsCreated = 0, after = cursor.after
  const metrics = { skippedUnlinkedEmployees: 0, duplicatesPrevented: 0, deliveriesCreated: 0, recipientsEvaluated: 0 }
  const tenants = new Set<string>()
  const result = (more: boolean) => ({ evaluated, notificationsCreated, tenantsScanned: tenants.size, batches: evaluated ? 1 : 0, ...metrics, runtimeMs: Date.now()-start, nextCursor: more ? encode({ kind: cursor.kind, after, at: now.toISOString() }) : null })
  if (!scheduledEventsEnabled()) return result(false)
  const candidates: NotificationCandidate[] = await db.$queryRaw(notificationCandidateQuery(cursor.kind, after, now, EVALUATION_BATCH_SIZE+1))
  for (const candidate of candidates.slice(0,EVALUATION_BATCH_SIZE)) {
    if (evaluated && Date.now()-start >= 15000) return result(true)
    const kind = candidate.kind
    const include = kind === 'case' ? {
      client: { select: { organizationId: true, firstName: true, lastName: true } },
      customDates: { orderBy: { id: 'asc' }, take: 101 },
      statusHistory: { where: { changedAt: { gte: new Date(now.getTime()-3*86400000) } }, select: { fromStatus: true, changedAt: true }, take: 101 },
    } : undefined
    notificationsCreated += await db.$transaction(async (tx: any) => {
      const automation = await lockedOrganizationAutomation(tx,candidate.organizationId)
      if (!automation.enabled) return 0
      const table = {task:'Task',case:'Case',lead:'Lead'}[kind]
      await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE`,candidate.id,candidate.organizationId)
      const fresh = await tx[kind].findFirst({ where: {id:candidate.id,organizationId:candidate.organizationId}, ...(include ? {include} : {}) })
      if (!fresh) return 0
      if (kind === 'case' && (fresh.customDates.length > 100 || fresh.statusHistory.length > 100)) throw new Error('Case date/history scope exceeds bounds')
      const events = scheduledOccurrences(kind,fresh,now,new Date(automation.activatedAt!)).filter(event => event.type === candidate.type && event.occurrence === candidate.occurrence)
      return emitScheduledNotifications(tx,kind,fresh,events,metrics)
    },{maxWait:10000,timeout:10000})
    after = candidate.key; tenants.add(candidate.organizationId); evaluated++
  }
  return result(candidates.length > EVALUATION_BATCH_SIZE)
}
