import { NextRequest, NextResponse } from 'next/server'
import { verifyMetaWebhookSignature } from '@/lib/metaWebhookSecurity'
import { keyMatches } from '@/lib/leadWebhook'
import { acceptLeadAdsEvent, leadAdsAppConfig, processLeadAdsDelivery } from '@/lib/metaLeadAds'
import { collectMetaLeadAdsEvents } from '@/lib/metaLeadAdsPolicy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  let accepted = 0, rejected = invalid, replayed = 0, shadow = 0
  const immediate: string[] = []
  try {
    for (const event of events) {
      const receipt = await acceptLeadAdsEvent(event, config.appId, config.receiptKey)
      if (!receipt.accepted) { rejected++; continue }
      if (receipt.reason === 'REPLAY') replayed++
      else if (receipt.reason === 'SHADOW') shadow++
      else if (receipt.deliveryId) { accepted++; if (immediate.length < 2) immediate.push(receipt.deliveryId) }
    }
  } catch {
    // A DB failure must make Meta retry. Unique receipt keys make replay safe.
    return NextResponse.json({ error: 'Receipt unavailable' }, { status: 503 })
  }
  // The receipt is durable before Graph retrieval. Due work is also serviced by
  // the separately authenticated retry endpoint when its scheduler is enabled.
  for (const id of immediate) await processLeadAdsDelivery(id, config.appId, config.secret, config.activationTime!)
  return NextResponse.json({ ok: true, accepted, rejected, replayed, shadow }, { headers: { 'Cache-Control': 'no-store' } })
}
