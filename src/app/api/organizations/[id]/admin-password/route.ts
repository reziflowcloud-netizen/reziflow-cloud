import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import {
  recordAdminPasswordResetAuditEvent,
  resetOrganizationAdminPassword,
} from '@/lib/adminPasswordReset'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getUser()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const organizationSlug = typeof body.organizationSlug === 'string' ? body.organizationSlug : ''
    const userId = Number(body.adminUserId)
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (!organizationSlug || !Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Проверьте организацию и администратора' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Пароли не совпадают' }, { status: 400 })
    }

    const result = await prisma.$transaction(tx => resetOrganizationAdminPassword({
      store: tx,
      organizationId: params.id,
      organizationSlug,
      userId,
      newPassword,
    }))

    recordAdminPasswordResetAuditEvent({
      organizationId: result.organizationId,
      userId: result.userId,
      actorUserId: Number(actor.id),
    })

    return NextResponse.json({ passwordReset: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Не удалось изменить пароль администратора' }, { status: 400 })
  }
}
