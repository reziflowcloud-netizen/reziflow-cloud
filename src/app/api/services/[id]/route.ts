// src/app/api/services/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const service = await (prisma as any).service.update({
    where: { id: parseInt(params.id) },
    data: {
      name: body.name,
      description: body.description || null,
      price: parseFloat(body.price) || 0,
      color: body.color || '#3b82f6',
      active: body.active ?? true,
    }
  })
  return NextResponse.json(service)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await (prisma as any).service.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
