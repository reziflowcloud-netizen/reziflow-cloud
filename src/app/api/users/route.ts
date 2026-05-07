// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

function canManageUsers(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  try {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(users)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await req.json()
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json({ error: 'Имя, email и пароль обязательны' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
    const hashed = await bcrypt.hash(body.password, 10)
    const newUser = await prisma.user.create({
      data: { name: body.name, email: body.email, password: hashed, role: body.role || 'employee', organizationId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
    })
    return NextResponse.json(newUser)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
