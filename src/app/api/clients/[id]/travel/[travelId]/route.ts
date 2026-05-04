// src/app/api/clients/[id]/travel/[travelId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedClient } from '@/lib/apiScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; travelId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedClient = await findScopedClient(params.id, organizationId, { id: true })
  if (!scopedClient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const travel = await (prisma as any).travelHistory.findUnique({ where: { id: parseInt(params.travelId) } })
  if (travel && travel.clientId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await (prisma as any).travelHistory.delete({ where: { id: parseInt(params.travelId) } })
  return NextResponse.json({ ok: true })
}
