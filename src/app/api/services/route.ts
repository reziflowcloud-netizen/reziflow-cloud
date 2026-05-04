// src/app/api/services/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const services = await (prisma as any).service.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json(services)
  } catch (e) {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  try {
    const service = await (prisma as any).service.create({
      data: {
        organizationId,
        name: body.name,
        description: body.description || null,
        price: parseFloat(body.price) || 0,
        color: body.color || '#3b82f6',
        active: true,
      }
    })
    return NextResponse.json(service)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
