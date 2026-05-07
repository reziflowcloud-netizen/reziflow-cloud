// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { deleteCloudinaryResource } from '@/lib/cloudinary'

function canManageUsers(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await req.json()
    const existing = await prisma.user.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.role === 'admin' && body.role && body.role !== 'admin') {
      const adminCount = await prisma.user.count({ where: { organizationId, role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last organization admin' }, { status: 400 })
      }
    }

    const data: any = {}
    if (body.name) data.name = body.name
    if (body.email) data.email = body.email
    if (body.role) data.role = body.role
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    const updated = await prisma.user.update({
      where: { id: parseInt(params.id) },
      data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  try {
    // Нельзя удалить самого себя
    if ((user as any).id === parseInt(params.id)) {
      return NextResponse.json({ error: 'Нельзя удалить собственный аккаунт' }, { status: 400 })
    }
    const existing = await prisma.user.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { organizationId, role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last organization admin' }, { status: 400 })
      }
    }

    await prisma.user.delete({ where: { id: parseInt(params.id) } })
    await deleteCloudinaryResource((existing as any).avatarPublicId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
