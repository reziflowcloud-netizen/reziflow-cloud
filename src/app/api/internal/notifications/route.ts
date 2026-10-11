import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/pushSecurity'
import { evaluateNotificationPage, parseEvaluationCursor } from '@/lib/notificationJobs'
import { deliverNotificationPush } from '@/lib/notificationPush'
import { runQstashNotificationChunk, continuationInput, diagnoseQstashNotificationTransport } from '@/lib/notificationQstash.mjs'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
async function drainPush() {
  const start = Date.now(), total = { processed: 0, delivered: 0, more: false }
  do {
    const page = await deliverNotificationPush(undefined, undefined, new Date(), undefined, undefined, Math.max(1,25000-(Date.now()-start)))
    total.processed += page.processed; total.delivered += page.delivered
    total.more = page.more ?? page.processed >= 20
  } while (total.more && Date.now()-start < 25000)
  return total
}
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let cursor
  try { cursor = parseEvaluationCursor(request.nextUrl.searchParams.get('cursor')) } catch { return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 }) }
  try {
    const evaluation = request.nextUrl.searchParams.get('delivery') === 'only' ? { evaluated: 0, nextCursor: null } : await evaluateNotificationPage(cursor)
    // Transport is outside every entity transaction, using the established leases.
    const delivery = await drainPush()
    return NextResponse.json({ ...evaluation, push: delivery }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Do not expose DB/provider errors, PII or secrets. Retry the same page;
    // notifications/outbox already committed are protected by unique constraints.
    return NextResponse.json({ error: 'Notification job incomplete; retry this cursor' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '15' } })
  }
}

export async function POST(request: NextRequest) {
  if (!cronAuthorized(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Default OFF until the reviewed transport and QStash configuration are deployed.
  if (process.env.NOTIFICATION_QSTASH_ENABLED !== 'true' || !process.env.QSTASH_TOKEN || process.env.QSTASH_TOKEN.length < 32) return NextResponse.json({ error: 'Scheduler transport unavailable' }, { status: 503 })
  let input
  try {
    if (request.nextUrl.search) throw new Error()
    const reader = request.body?.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let body = '', size = 0
    if (reader) while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 1024) { await reader.cancel(); throw new Error() }
      body += decoder.decode(part.value, { stream: true })
    }
    body += decoder.decode()
    input = JSON.parse(body || '{}')
    if (input?.mode === 'diagnostic' && Object.keys(input).length === 1) {
      return NextResponse.json(await diagnoseQstashNotificationTransport(), { headers: { 'Cache-Control': 'no-store' } })
    }
    continuationInput(input, request.headers.get('upstash-message-id'), 'https://legalhubcrm.com')
  } catch { return NextResponse.json({ error: 'Invalid scheduler continuation' }, { status: 400 }) }
  try {
    return NextResponse.json(await runQstashNotificationChunk({ input, messageId: request.headers.get('upstash-message-id'), secret: process.env.CRON_SECRET, token: process.env.QSTASH_TOKEN }), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Notification job incomplete; retry this chunk' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '15' } })
  }
}
