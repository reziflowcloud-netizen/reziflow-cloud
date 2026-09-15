import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { caseChildWhere } from '@/lib/nestedResourceScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; updateId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updateId = parseInt(params.updateId)
  const existingUpdate = await (prisma as any).docUpdate.findFirst({
    where: caseChildWhere(params.id, updateId),
    select: { id: true },
  })
  if (!existingUpdate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await (prisma as any).docUpdate.delete({ where: { id: existingUpdate.id } })
  return NextResponse.json({ ok: true })
}
