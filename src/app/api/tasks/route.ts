// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const tasks = await prisma.task.findMany({ where: { organizationId }, include: { assignedTo: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  const task = await prisma.task.create({
    data: {
      organizationId,
      title: body.title,
      description: body.description || null,
      priority: body.priority || 'Нормально',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      clientName: body.clientName || null,
      assignedToId: body.assignedToId ? parseInt(body.assignedToId) : null,
    }
  })
  return NextResponse.json(task)
}
