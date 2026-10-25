import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { currentMetaUser, metaRecipientSql, metaAccessSql } from '@/lib/metaMessages'
export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await currentMetaUser(await getUser())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organization = await prisma.organization.findUnique({ where: { id: user.organizationId! }, select: { settings: true } })
  if (!organization) return NextResponse.json({ error: 'Unavailable' }, { status: 404 })
  const settings = getLeadWebhookSettings(organization.settings)
  if (!settings.facebookMessagesEnabled) return NextResponse.json({ enabled: false, latest: null })
  const [latest, preference, unread, visual] = await Promise.all([
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT m."liveReceipt" AS id, m."leadId", m."createdAt", m.channel AS source
      FROM "LeadMessage" m JOIN "Lead" l ON l.id=m."leadId" AND l."organizationId"=m."organizationId"
      WHERE m."organizationId"=${user.organizationId} AND m."liveReceipt" IS NOT NULL AND ${metaRecipientSql(user.id)}
      ORDER BY m."liveReceipt" DESC LIMIT 1`),
    prisma.notificationPreference.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId! } }, select: { metaMessageSound: true } }),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT l.id AS "leadId", COALESCE(NULLIF(l."fullName",''), NULLIF(concat_ws(' ',l."firstName",l."lastName"),''), l.phone, l.email, 'Lead') AS "leadName", c.count,
      sum(c.count) OVER ()::int AS total FROM "Lead" l
      LEFT JOIN "MetaMessageRead" r ON r."organizationId"=l."organizationId" AND r."leadId"=l.id AND r."userId"=${user.id}
      CROSS JOIN LATERAL (SELECT count(*)::int AS count, max(m."liveReceipt") AS newest FROM "LeadMessage" m
        WHERE m."organizationId"=l."organizationId" AND m."leadId"=l.id AND m."liveReceipt">COALESCE(r."throughReceipt",0)) c
      WHERE l."organizationId"=${user.organizationId} AND ${metaRecipientSql(user.id)} AND c.count>0
      ORDER BY c.newest DESC LIMIT 5`),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT md5(COALESCE(string_agg(l.id || ':' || COALESCE(last.receipt,0)::text || ':' || COALESCE(r."throughReceipt",0)::text, ',' ORDER BY l.id),'')) AS revision
      FROM "Lead" l LEFT JOIN "MetaMessageRead" r ON r."organizationId"=l."organizationId" AND r."leadId"=l.id AND r."userId"=${user.id}
      LEFT JOIN LATERAL (SELECT m."liveReceipt" AS receipt FROM "LeadMessage" m WHERE m."organizationId"=l."organizationId" AND m."leadId"=l.id AND m."liveReceipt" IS NOT NULL ORDER BY m."liveReceipt" DESC LIMIT 1) last ON true
      WHERE l."organizationId"=${user.organizationId} AND ${metaAccessSql(user.id)}`),
  ])
  return NextResponse.json({ enabled: true, userKey: `${user.organizationId}:${user.id}`, latest: latest[0] || null, unread, visualRevision: visual[0].revision, sound: preference?.metaMessageSound === true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
