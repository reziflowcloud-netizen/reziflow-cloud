import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { pushConfigured, pushUserAllowed } from '@/lib/pushSecurity'
import { isPushPilotNotification } from '@/lib/pushPilotPolicy'
import { PUSH_PILOT_WORKER_VERSION, validPushPilotTrace } from '@/lib/pushPilotDiagnostics'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
async function pilotUser() {
  const user = await authenticatedNotificationUser()
  return user && pushConfigured() && pushUserAllowed(user.id) ? user : null
}
export async function GET() {
  const user = await pilotUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 403, headers })
  const notification = await prisma.notification.findFirst({ where: { userId: user.id, organizationId: user.organizationId, type: 'push_test' }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ expectedWorkerVersion: PUSH_PILOT_WORKER_VERSION, notificationId: isPushPilotNotification(notification) ? notification!.id : null }, { headers })
}
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers })
  const user = await pilotUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (!validPushPilotTrace(body)) return NextResponse.json({ error: 'Invalid trace' }, { status: 400, headers })
  const notification = await prisma.notification.findFirst({ where: { id: body.notificationId, userId: user.id, organizationId: user.organizationId, type: 'push_test', createdAt: { gte: new Date(Date.now() - 86400000) } } })
  if (!isPushPilotNotification(notification)) return NextResponse.json({ error: 'Unavailable' }, { status: 404, headers })
  // Fixed stage/version and opaque synthetic IDs only. Never log UA, URL,
  // endpoints, payload, provider errors, account names or authentication data.
  console.info('LH_PUSH_PILOT_TRACE', JSON.stringify({ notificationId: body.notificationId, workerVersion: body.workerVersion, instanceId: body.instanceId, stage: body.stage }))
  return NextResponse.json({ ok: true }, { headers })
}
