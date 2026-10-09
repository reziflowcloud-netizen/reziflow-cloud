import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { canReceiveTeam, NOTIFICATION_TYPES, notificationPreferences } from '@/lib/notificationPolicy'
import { pushConfigured, pushUserAllowed } from '@/lib/pushSecurity'
export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  return NextResponse.json({ preferences: notificationPreferences(user.notificationPreference, canReceiveTeam(user)), canReceiveTeam: canReceiveTeam(user), pushAvailable: pushConfigured() && pushUserAllowed(user.id), publicKey: pushConfigured() && pushUserAllowed(user.id) ? process.env.VAPID_PUBLIC_KEY : null, devices: await prisma.pushSubscription.count({ where: { userId: user.id, organizationId: user.organizationId, disabledAt: null } }) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function PUT(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || !['mine', 'team'].includes(body.scope) || !['ru', 'uk', 'pl'].includes(body.language) || typeof body.pushEnabled !== 'boolean' || typeof body.showClientName !== 'boolean' || NOTIFICATION_TYPES.some(type => typeof body.events?.[type]?.inApp !== 'boolean' || typeof body.events?.[type]?.push !== 'boolean')) return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 })
  if (body.scope === 'team' && !canReceiveTeam(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = notificationPreferences(body, canReceiveTeam(user))
  const where = { userId: user.id, organizationId: user.organizationId }
  await prisma.notificationPreference.upsert({ where: { userId_organizationId: where }, create: { ...where, ...data }, update: data })
  return NextResponse.json({ preferences: data })
}
