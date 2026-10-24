import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { currentMetaUser, metaLeadAccess, parseMessageSnapshot } from '@/lib/metaMessages'
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.snapshot !== 'string' || body.snapshot.length > 4096) return NextResponse.json({ error: 'Invalid snapshot' }, { status: 400 })
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${String(session.organizationId)} FOR SHARE`
    // Identity mutations serialize on this row. Reread authorization under locks;
    // do not trust session roles or a previously authorized snapshot.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${Number(session.id)} AND "organizationId"=${String(session.organizationId)} FOR SHARE`
    const user = await currentMetaUser(session, tx)
    if (!user || user.sessionVersion !== Number(session.sessionVersion || 0)) return 401
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${params.id} AND "organizationId"=${user.organizationId} FOR SHARE`
    if (!await tx.lead.findFirst({ where: metaLeadAccess(user, params.id), select: { id: true } })) return 404
    const through = await parseMessageSnapshot(body.snapshot, user, params.id)
    if (through === null) return 400
    await tx.$executeRaw`INSERT INTO "MetaMessageRead" ("organizationId","userId","leadId","throughId") VALUES (${user.organizationId},${user.id},${params.id},${through}) ON CONFLICT ("organizationId","userId","leadId") DO UPDATE SET "throughId"=GREATEST("MetaMessageRead"."throughId",EXCLUDED."throughId")`
    return 200
  })
  return NextResponse.json(result === 200 ? { ok: true } : { error: 'Unavailable' }, { status: result })
}
