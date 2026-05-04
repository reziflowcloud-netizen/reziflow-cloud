// src/app/api/statuses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const statuses = await prisma.caseStatus.findMany({ where: { organizationId }, orderBy: { order: 'asc' } })
  return NextResponse.json(statuses)
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const status = await prisma.caseStatus.create({
      data: { organizationId, name: body.name, color: body.color || '#3b82f6', order: body.order || 0 }
    })
    return NextResponse.json(status)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Статус с таким названием уже существует' }, { status: 400 })
    }
    return NextResponse.json({ error: e.message || 'Ошибка создания статуса' }, { status: 500 })
  }
}
