// src/app/api/clients/[id]/travel/[travelId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; travelId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await (prisma as any).travelHistory.delete({ where: { id: parseInt(params.travelId) } })
  return NextResponse.json({ ok: true })
}
