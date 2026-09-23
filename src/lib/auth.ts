// src/lib/auth.ts
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { isSessionVersionCurrent, signToken, verifyToken } from '@/lib/authToken'

export { signToken, verifyToken } from '@/lib/authToken'

export async function getUser() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  const userId = Number(payload?.id)
  const organizationId = String(payload?.organizationId || '')
  if (!payload || !Number.isInteger(userId) || userId <= 0 || !organizationId) return null

  const current = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { sessionVersion: true },
  })
  if (!current || !isSessionVersionCurrent(payload, current.sessionVersion)) return null
  return payload
}

export function getOrganizationId(user: any) {
  return String(user?.organizationId || 'org_default')
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
