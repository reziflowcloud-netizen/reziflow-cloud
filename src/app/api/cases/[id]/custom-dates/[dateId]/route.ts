import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; dateId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const relatedTasks = await prisma.task.findMany({
    where: {
      organizationId,
      AND: [
        { description: { contains: `"caseId":"${params.id}"` } },
        { description: { contains: `"customDateId":${parseInt(params.dateId)}` } },
      ],
    },
    select: { id: true },
  })
  await (prisma as any).caseCustomDate.delete({ where: { id: parseInt(params.dateId) } })
  if (relatedTasks.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: relatedTasks.map(task => task.id) } } })
  }
  return NextResponse.json({ ok: true })
}
