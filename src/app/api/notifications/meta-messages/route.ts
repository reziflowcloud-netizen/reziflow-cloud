import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { currentMetaUser, metaRecipientSql } from '@/lib/metaMessages'
export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await currentMetaUser(await getUser())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organization = await prisma.organization.findUnique({ where: { id: user.organizationId! }, select: { settings: true } })
  if (!organization) return NextResponse.json({ error: 'Unavailable' }, { status: 404 })
  const settings = getLeadWebhookSettings(organization.settings)
  if (!settings.facebookMessagesEnabled) return NextResponse.json({ enabled: false, latest: null })
  const [latest, preference, unread] = await Promise.all([
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT m.id, m."leadId", m."createdAt", m.channel AS source
      FROM "LeadMessage" m JOIN "Lead" l ON l.id=m."leadId" AND l."organizationId"=m."organizationId"
      WHERE m."organizationId"=${user.organizationId} AND m."liveIncoming" AND ${metaRecipientSql(user.id)}
      ORDER BY m.id DESC LIMIT 1`),
    prisma.notificationPreference.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId! } }, select: { metaMessageSound: true } }),
    prisma.$queryRaw<any[]>(Prisma.sql`SELECT m."leadId", COALESCE(NULLIF(l."fullName",''), NULLIF(concat_ws(' ',l."firstName",l."lastName"),''), l.phone, l.email, 'Lead') AS "leadName", count(*)::int AS count,
      sum(count(*)) OVER ()::int AS total, max(m.id) AS newest
      FROM "LeadMessage" m JOIN "Lead" l ON l.id=m."leadId" AND l."organizationId"=m."organizationId"
      LEFT JOIN "MetaMessageRead" r ON r."organizationId"=m."organizationId" AND r."leadId"=m."leadId" AND r."userId"=${user.id}
      WHERE m."organizationId"=${user.organizationId} AND m."liveIncoming" AND m.id>COALESCE(r."throughId",0) AND ${metaRecipientSql(user.id)}
      GROUP BY m."leadId", l.id ORDER BY max(m.id) DESC LIMIT 5`),
  ])
  return NextResponse.json({ enabled: true, userKey: `${user.organizationId}:${user.id}`, latest: latest[0] || null, unread, sound: preference?.metaMessageSound === true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
