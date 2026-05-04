import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; dateId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await (prisma as any).caseCustomDate.delete({ where: { id: parseInt(params.dateId) } })
  return NextResponse.json({ ok: true })
}
