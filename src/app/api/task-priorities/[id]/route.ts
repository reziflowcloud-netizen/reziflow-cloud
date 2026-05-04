// src/app/api/task-priorities/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const p = await prisma.taskPriority.update({
    where: { id: parseInt(params.id) },
    data: { name: body.name, color: body.color },
  })
  return NextResponse.json(p)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.taskPriority.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
