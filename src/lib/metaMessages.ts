import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
export { messageSnapshot, parseMessageSnapshot } from './metaMessageSnapshot'

// Eligibility is set ONLY in the serialized live webhook transaction. In particular,
// conversationSync and manual incoming writes keep the database default false.
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
    SELECT m."leadId", count(*)::int AS count FROM "LeadMessage" m
    JOIN "Lead" l ON l.id=m."leadId" AND l."organizationId"=m."organizationId"
    LEFT JOIN "MetaMessageRead" r ON r."organizationId"=m."organizationId" AND r."leadId"=m."leadId" AND r."userId"=${user.id}
    WHERE m."organizationId"=${user.organizationId} AND m."leadId" IN (${Prisma.join(leadIds)}) AND m."liveIncoming"
      AND m.id>COALESCE(r."throughId",0) GROUP BY m."leadId"`)
  return new Map(rows.map(row => [row.leadId, row.count]))
}
