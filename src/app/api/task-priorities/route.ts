// src/app/api/task-priorities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const priorities = await prisma.taskPriority.findMany({ where: { organizationId }, orderBy: { order: 'asc' } })
    return NextResponse.json(priorities)
  } catch {
    // Return defaults if table doesn't exist yet
    return NextResponse.json([
      { id: 1, name: 'Нормально', color: '#3b82f6', order: 0 },
      { id: 2, name: 'Горить', color: '#f59e0b', order: 1 },
      { id: 3, name: 'Срочно', color: '#ef4444', order: 2 },
      { id: 4, name: 'Можно подождать', color: '#6b7280', order: 3 },
    ])
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  const priority = await prisma.taskPriority.create({
    data: { organizationId, name: body.name, color: body.color || '#6b7280', order: body.order || 99 }
  })
  return NextResponse.json(priority)
}
