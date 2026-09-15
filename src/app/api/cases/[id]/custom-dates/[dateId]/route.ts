import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { caseChildWhere } from '@/lib/nestedResourceScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; dateId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const dateId = parseInt(params.dateId)
  const existingDate = await (prisma as any).caseCustomDate.findFirst({
    where: caseChildWhere(params.id, dateId),
    select: { id: true },
  })
  if (!existingDate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const relatedTasks = await prisma.task.findMany({
    where: {
      organizationId,
      AND: [
        { description: { contains: `"caseId":"${params.id}"` } },
        { description: { contains: `"customDateId":${dateId}` } },
      ],
    },
    select: { id: true },
  })
  await (prisma as any).caseCustomDate.delete({ where: { id: existingDate.id } })
  if (relatedTasks.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: relatedTasks.map(task => task.id) } } })
  }
  return NextResponse.json({ ok: true })
}
