// src/app/api/task-priorities/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  const existing = await prisma.taskPriority.findFirst({ where: { id: parseInt(params.id), organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const p = await prisma.taskPriority.update({
    where: { id: parseInt(params.id) },
    data: { name: body.name, color: body.color },
  })
  return NextResponse.json(p)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const existing = await prisma.taskPriority.findFirst({ where: { id: parseInt(params.id), organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.taskPriority.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
