// src/app/api/case-options/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const options = await (prisma as any).caseOption.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { order: 'asc' }]
    })
    return NextResponse.json(options)
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
    const option = await (prisma as any).caseOption.create({
      data: {
        organizationId,
        type: body.type,
        value: body.value,
        order: body.order ?? 0,
      }
    })
    return NextResponse.json(option)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
