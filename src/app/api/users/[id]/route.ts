// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser, signToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { deleteCloudinaryResource } from '@/lib/cloudinary'
import { cookies } from 'next/headers'

function canManageUsers(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function refreshUserCookie(updatedUser: any, currentUser: any) {
  const token = await signToken({
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    restrictedAccess: updatedUser.restrictedAccess === true,
    avatarUrl: updatedUser.avatarUrl || null,
    organizationId: currentUser.organizationId || 'org_default',
    organizationName: currentUser.organizationName || 'LegalHub',
  })
  cookies().set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await req.json()
    const targetId = parseInt(params.id)
    const isSelf = Number(user.id) === targetId
    if (!canManageUsers(user) && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const existing = await prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.role === 'admin' && body.role && body.role !== 'admin') {
      const adminCount = await prisma.user.count({ where: { organizationId, role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last organization admin' }, { status: 400 })
      }
    }

    const data: any = {}
    if (body.name) data.name = body.name
    if (canManageUsers(user)) {
      if (body.email) data.email = body.email
      if (body.role) data.role = body.role
      if (body.restrictedAccess !== undefined) {
        const role = body.role || existing.role
        data.restrictedAccess = role === 'employee' && body.restrictedAccess === true
      } else if (body.role && body.role !== 'employee') {
        data.restrictedAccess = false
      }
      if (body.password) data.password = await bcrypt.hash(body.password, 10)
    }
    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
      select: { id: true, name: true, email: true, role: true, restrictedAccess: true, avatarUrl: true, createdAt: true },
    })
    if (isSelf) await refreshUserCookie(updated, user)
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
