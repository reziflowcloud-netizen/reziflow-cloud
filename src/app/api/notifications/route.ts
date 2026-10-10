import { NextRequest, NextResponse } from 'next/server'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { listNotifications, markNotificationsRead } from '@/lib/notifications'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const params = request.nextUrl.searchParams
  try { return NextResponse.json(await listNotifications(user, params.get('cursor'), undefined, params.get('resume') === '1' ? params.get('unreadSince') : undefined), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch { return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 }) }
}
export async function PATCH(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || (body.all !== true && (typeof body.id !== 'string' || !/^[\w-]{1,100}$/.test(body.id)))) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  await markNotificationsRead(user, body.all === true ? undefined : body.id)
  return NextResponse.json({ ok: true })
}
