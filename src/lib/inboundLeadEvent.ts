import { createHash } from 'node:crypto'
import { dispatchAssignmentPush } from './assignmentDelivery.ts'

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
export function inboundEventKey(source: string, payload: any, explicit?: unknown) {
  return createHash('sha256').update(JSON.stringify([source, explicit == null ? canonical(payload) : String(explicit).trim() || canonical(payload)])).digest('hex')
}
// Serialize ingestion per tenant before replay checks and routing cursor updates.
// A transaction lock disappears on rollback; no new schema or persistent lock.
export async function lockInboundLead(tx: any, organizationId: string) {
  await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId)
}
export async function inboundLeadOnce(db: any, organizationId: string, eventKey: string, metadata: any, work: (tx: any) => Promise<any>, options: { pushOnReplay?: boolean } = {}) {
  const result = await db.$transaction(async (tx: any) => {
    await lockInboundLead(tx, organizationId)
    const replay = await tx.leadWebhookLog.findFirst({ where: { organizationId, status: 'created', payload: { path: ['assignmentEventKey'], equals: eventKey } } })
    if (replay) return { lead: replay.leadId ? await tx.lead.findFirst({ where: { id: replay.leadId, organizationId } }) : null, created: false }
    const lead = await work(tx)
    await tx.leadWebhookLog.create({ data: { organizationId, leadId: lead.id, status: 'created', source: metadata.source, payload: { ...metadata.payload, assignmentEventKey: eventKey } } })
    return { lead, created: true }
  }, { timeout: 15000 })
  if (result.lead && (result.created || options.pushOnReplay !== false)) await dispatchAssignmentPush(organizationId, [result.lead.id], db)
  return result.lead
}
