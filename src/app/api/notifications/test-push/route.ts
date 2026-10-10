import { NextRequest, NextResponse } from 'next/server'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { PushPilotError, sendPushPilot } from '@/lib/pushPilot'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.subscriptionId !== 'string' || typeof body.requestId !== 'string' || (body.language !== undefined && !['ru', 'uk', 'pl'].includes(body.language)) || Object.keys(body).some(key => !['subscriptionId', 'requestId', 'language'].includes(key))) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    return NextResponse.json(await sendPushPilot(user, body.subscriptionId, body.requestId, undefined, undefined, undefined, body.language), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: 'Test unavailable' }, { status: error instanceof PushPilotError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
