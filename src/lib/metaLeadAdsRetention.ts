import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

const db = prisma as any
const DAY = 86400000
const BATCH = 50

// Manual, tenant-scoped maintenance. No timer or scheduler is installed.
// Raw terminal data expires after 30 days; the keyed fingerprint remains as a
// minimal tombstone until day 366. Graph lead age is independently bounded to
// 365 days, so deletion of a tombstone cannot reimport an old Lead.
export async function maintainLeadAdsReceipts(organizationId: string, apply: boolean, now = new Date()) {
  if (!organizationId || !(await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) {
    throw new Error('TENANT_NOT_FOUND')
  }
  const terminalCutoff = new Date(now.getTime() - 30 * DAY)
  const replayCutoff = new Date(now.getTime() - 366 * DAY)
  const terminal = await db.metaLeadAdsDelivery.findMany({ where: {
    organizationId, status: { in: ['complete', 'blocked', 'shadow'] }, createdAt: { lt: terminalCutoff },
  }, select: { id: true, eventFingerprint: true }, orderBy: { createdAt: 'asc' }, take: BATCH + 1 })
  const tombstones = await db.metaLeadAdsDelivery.findMany({ where: {
    organizationId, status: 'tombstone', createdAt: { lt: replayCutoff },
  }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: BATCH + 1 })
  const orphaned = await db.$queryRaw(Prisma.sql`SELECT d.id FROM "MetaLeadAdsDelivery" d
    LEFT JOIN "Lead" l ON l.id = d."leadId" AND l."organizationId" = d."organizationId"
    WHERE d."organizationId" = ${organizationId} AND d."leadId" IS NOT NULL AND l.id IS NULL
      AND d.status IN ('complete', 'blocked', 'shadow')
    ORDER BY d."createdAt", d.id LIMIT ${BATCH + 1}`)
  const expiredAllowlists = await db.metaLeadAdsBinding.findMany({ where: {
    organizationId, enabled: false, mode: 'off', updatedAt: { lt: terminalCutoff }, pilotLeadIds: { isEmpty: false },
  }, select: { id: true }, take: BATCH + 1 })
  const result = { terminalToTombstone: Math.min(terminal.length, BATCH),
    tombstonesToDelete: Math.min(tombstones.length, BATCH), orphanedLeadLinks: Math.min(orphaned.length, BATCH),
    expiredAllowlists: Math.min(expiredAllowlists.length, BATCH),
    more: [terminal, tombstones, orphaned, expiredAllowlists].some(rows => rows.length > BATCH), applied: apply }
  if (!apply) return result
  await db.$transaction(async (tx: any) => {
    await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', organizationId)
    for (const row of terminal.slice(0, BATCH)) {
      await tx.metaLeadAdsDelivery.updateMany({ where: { id: row.id, organizationId,
        status: { in: ['complete', 'blocked', 'shadow'] }, createdAt: { lt: terminalCutoff } },
      data: { status: 'tombstone', leadgenId: `tombstone:${row.eventFingerprint}`, leadId: null,
        lastErrorCode: null, purgedAt: now } })
    }
    await tx.metaLeadAdsDelivery.deleteMany({ where: { organizationId, id: { in: tombstones.slice(0, BATCH).map((row: any) => row.id) },
      status: 'tombstone', createdAt: { lt: replayCutoff } } })
    await tx.metaLeadAdsDelivery.updateMany({ where: { organizationId, id: { in: orphaned.slice(0, BATCH).map((row: any) => row.id) },
      leadId: { not: null } }, data: { leadId: null } })
    await tx.metaLeadAdsBinding.updateMany({ where: { organizationId,
      id: { in: expiredAllowlists.slice(0, BATCH).map((row: any) => row.id) }, enabled: false, mode: 'off',
      updatedAt: { lt: terminalCutoff } }, data: { pilotLeadIds: [] } })
  }, { timeout: 20000 })
  return result
}
