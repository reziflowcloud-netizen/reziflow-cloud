import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

function isSystemAdmin(user: any) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@migraflow.pl').toLowerCase()
  return user?.role === 'owner' || String(user?.email || '').toLowerCase() === adminEmail
}

const organizationInclude = {
  users: {
    where: { role: 'admin' },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
  },
  _count: {
    select: {
      users: true,
      clients: true,
      cases: true,
      tasks: true,
    },
  },
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(user.role === 'admin' || user.role === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const canManageAll = isSystemAdmin(user)
  if (!canManageAll && params.id !== getOrganizationId(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data: any = {}
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (canManageAll) {
      if (typeof body.status === 'string') data.status = body.status
      if (typeof body.plan === 'string') data.plan = body.plan
      if ('trialEndsAt' in body) data.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null
    }

    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : ''
    const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : ''
    const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : ''

    const updated = await prisma.$transaction(async tx => {
      await tx.organization.update({
        where: { id: params.id },
        data,
      })

      if (canManageAll && (adminName || adminEmail || adminPassword)) {
        const primaryAdmin = await tx.user.findFirst({
          where: { organizationId: params.id, role: 'admin' },
          orderBy: { createdAt: 'asc' },
        })

        if (!primaryAdmin) {
          throw new Error('У этой фирмы пока нет администратора')
        }

        const userData: any = {}
        if (adminName) userData.name = adminName
        if (adminEmail && adminEmail !== primaryAdmin.email) {
          const existingEmail = await tx.user.findUnique({ where: { email: adminEmail } })
          if (existingEmail && existingEmail.id !== primaryAdmin.id) {
            throw new Error('Пользователь с таким email уже есть')
          }
          userData.email = adminEmail
        }
        if (adminPassword) {
          if (adminPassword.length < 6) {
            throw new Error('Пароль должен быть не короче 6 символов')
          }
          userData.password = await bcrypt.hash(adminPassword, 10)
        }

        if (Object.keys(userData).length) {
          await tx.user.update({
            where: { id: primaryAdmin.id },
            data: userData,
          })
        }
      }

      return tx.organization.findUnique({
        where: { id: params.id },
        include: organizationInclude,
      })
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сохранения фирмы' }, { status: 500 })
  }
}
