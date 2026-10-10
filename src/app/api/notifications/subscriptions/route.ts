import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { endpointHash, encryptSubscription, pushConfigured, pushUserAllowed, subscriptionAAD, validatePushSubscription } from '@/lib/pushSecurity'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  if (!pushConfigured() || !pushUserAllowed(user.id)) return NextResponse.json({ error: 'Push unavailable' }, { status: 503 })
  let subscription
  try { subscription = validatePushSubscription(await request.json()) } catch { return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 }) }
  const identity = { organizationId: user.organizationId!, userId: user.id, endpointHash: endpointHash(subscription.endpoint) }
  const encryptedSubscription = encryptSubscription(subscription, subscriptionAAD(identity))
  // No UA fingerprint: only a coarse, bounded browser/device label.
  const agent = request.headers.get('user-agent') || ''
  const deviceLabel = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Macintosh/.test(agent) ? 'Mac' : 'Desktop'
  try {
    await prisma.$transaction(async tx => {
      const existing = await tx.pushSubscription.findUnique({ where: { endpointHash: identity.endpointHash } })
      if (existing && (existing.userId !== user.id || existing.organizationId !== user.organizationId)) throw new Error('Subscription belongs to another account')
      if ((!existing || existing.disabledAt) && await tx.pushSubscription.count({ where: { userId: user.id, organizationId: user.organizationId, disabledAt: null } }) >= 10) throw new Error('Device limit')
      if (existing) await tx.pushSubscription.updateMany({ where: { id: existing.id, userId: user.id, organizationId: user.organizationId }, data: { encryptedSubscription, deviceLabel, disabledAt: null, lastFailureAt: null } })
      else await tx.pushSubscription.create({ data: { ...identity, encryptedSubscription, deviceLabel } })
      const where = { userId: user.id, organizationId: user.organizationId! }
      await tx.notificationPreference.upsert({ where: { userId_organizationId: where }, create: { ...where, pushEnabled: true }, update: { pushEnabled: true } })
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Unable to register device' }, { status: 409 }) }
}
export async function GET(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const hash = request.nextUrl.searchParams.get('endpointHash') || ''
  if (!hash && pushConfigured() && pushUserAllowed(user.id)) {
    const devices = await prisma.pushSubscription.findMany({ where: { userId: user.id, organizationId: user.organizationId, disabledAt: null }, select: { id: true, deviceLabel: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 10 })
    return NextResponse.json({ devices }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  if (!/^[a-f0-9]{64}$/.test(hash)) return NextResponse.json({ active: false })
  const subscription = await prisma.pushSubscription.findFirst({ where: { userId: user.id, organizationId: user.organizationId, endpointHash: hash, disabledAt: null }, select: { id: true } })
  return NextResponse.json({ active: !!subscription, subscriptionId: subscription?.id ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function DELETE(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, organizationId: user.organizationId, endpointHash: endpointHash(body.endpoint) } })
  return NextResponse.json({ ok: true })
}
