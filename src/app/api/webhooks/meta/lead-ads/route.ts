import { NextRequest, NextResponse } from 'next/server'
import { verifyMetaWebhookSignature } from '@/lib/metaWebhookSecurity'
import { keyMatches } from '@/lib/leadWebhook'
import { acceptLeadAdsEvents, leadAdsAppConfig } from '@/lib/metaLeadAds'
import { collectMetaLeadAdsEvents } from '@/lib/metaLeadAdsPolicy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const config = leadAdsAppConfig()
  if (!config || request.nextUrl.searchParams.get('hub.mode') !== 'subscribe' ||
      !keyMatches(config.verifyToken, request.nextUrl.searchParams.get('hub.verify_token') || '')) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const challenge = request.nextUrl.searchParams.get('hub.challenge') || ''
  return /^[a-zA-Z0-9_-]{1,200}$/.test(challenge)
    ? new NextResponse(challenge, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    : new NextResponse('Invalid challenge', { status: 400 })
}

export async function POST(request: NextRequest) {
  const config = leadAdsAppConfig()
  if (!config) return NextResponse.json({ error: 'Lead Ads unavailable' }, { status: 503 })
  let raw: Uint8Array
  try {
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength > 65536) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    raw = new Uint8Array(buffer)
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const signature = verifyMetaWebhookSignature(raw, request.headers.get('x-hub-signature-256'), config.secret)
  if (!signature.verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  if (process.env.META_LEAD_ADS_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, disabled: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
  let body: unknown
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { events, rejected: invalid } = collectMetaLeadAdsEvents(body)
  try {
    const result = await acceptLeadAdsEvents(events, config.appId, config.receiptKey)
    return NextResponse.json({ ok: true, ...result, rejected: result.rejected + invalid },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Receipt unavailable' },
      { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } })
  }
}
