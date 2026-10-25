import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
export { messageSnapshot, parseMessageSnapshot } from './metaMessageSnapshot'

// Live receipt is allocated ONLY in the serialized direct webhook transaction.
// conversationSync/manual/old-app writes keep null until a qualifying direct event.
export const metaAccessSql = (userId: number) => Prisma.sql`
 EXISTS (SELECT 1 FROM "User" access_user WHERE access_user.id=${userId} AND access_user."organizationId"=l."organizationId"
   AND (access_user.role IN ('owner','admin') OR NOT access_user."restrictedAccess" OR l."assignedToId"=access_user.id))`
export const metaRecipientSql = (userId: number) => Prisma.sql`
 EXISTS (SELECT 1 FROM "User" u WHERE u.id=${userId} AND u."organizationId"=l."organizationId"
 AND (u.role IN ('owner','admin') OR NOT u."restrictedAccess" OR l."assignedToId"=u.id)
 AND (
   (l."assignedToId"=u.id AND EXISTS (SELECT 1 FROM "Employee" e JOIN "User" owner
      ON owner.id=e."userId" AND owner."organizationId"=e."organizationId"
      WHERE e.id=l."employeeId" AND e."organizationId"=l."organizationId" AND e.active AND e."userId"=l."assignedToId"))
   OR (u.role IN ('owner','admin') AND NOT EXISTS (SELECT 1 FROM "Employee" e JOIN "User" owner
      ON owner.id=e."userId" AND owner."organizationId"=e."organizationId"
      WHERE e.id=l."employeeId" AND e."organizationId"=l."organizationId" AND e.active AND e."userId"=l."assignedToId"))
 ))`

export async function currentMetaUser(session: any, client: any = prisma) {
  if (!session) return null
  return client.user.findFirst({ where: { id: Number(session.id), organizationId: String(session.organizationId) }, select: { id: true, organizationId: true, role: true, restrictedAccess: true, sessionVersion: true } })
}
export function metaLeadAccess(user: any, leadId: string) {
  return { id: leadId, organizationId: user.organizationId, ...(!['owner','admin'].includes(user.role) && user.restrictedAccess ? { assignedToId: user.id } : {}) }
}
export async function metaUnreadCounts(user: any, leadIds: string[]) {
  if (!leadIds.length) return new Map<string, number>()
  const rows = await prisma.$queryRaw<{ leadId: string; count: number }[]>(Prisma.sql`
    SELECT l.id AS "leadId", c.count FROM "Lead" l
    LEFT JOIN "MetaMessageRead" r ON r."organizationId"=l."organizationId" AND r."leadId"=l.id AND r."userId"=${user.id}
    CROSS JOIN LATERAL (SELECT count(*)::int AS count FROM "LeadMessage" m
      WHERE m."organizationId"=l."organizationId" AND m."leadId"=l.id
        AND m."liveReceipt">COALESCE(r."throughReceipt",0)) c
    WHERE l."organizationId"=${user.organizationId} AND l.id IN (${Prisma.join(leadIds)}) AND ${metaAccessSql(user.id)} AND c.count>0`)
  return new Map(rows.map(row => [row.leadId, row.count]))
}
