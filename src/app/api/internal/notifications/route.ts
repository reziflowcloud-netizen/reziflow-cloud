import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/pushSecurity'
import { evaluateNotificationPage, parseEvaluationCursor } from '@/lib/notificationJobs'
import { deliverNotificationPush } from '@/lib/notificationPush'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let cursor
  try { cursor = parseEvaluationCursor(request.nextUrl.searchParams.get('cursor')) } catch { return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 }) }
  const evaluation = request.nextUrl.searchParams.get('delivery') === 'only' ? { evaluated: 0, nextCursor: null } : await evaluateNotificationPage(cursor)
  const delivery = await deliverNotificationPush()
  return NextResponse.json({ ...evaluation, push: delivery }, { headers: { 'Cache-Control': 'no-store' } })
}
