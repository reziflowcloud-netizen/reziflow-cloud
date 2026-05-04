// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const data: any = {}
    if (body.name) data.name = body.name
    if (body.email) data.email = body.email
    if (body.role) data.role = body.role
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    const updated = await prisma.user.update({
      where: { id: parseInt(params.id) },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // Нельзя удалить самого себя
    if ((user as any).id === parseInt(params.id)) {
      return NextResponse.json({ error: 'Нельзя удалить собственный аккаунт' }, { status: 400 })
    }
    await prisma.user.delete({ where: { id: parseInt(params.id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
