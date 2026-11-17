import { NextRequest, NextResponse } from 'next/server'
import { keyMatches } from '@/lib/leadWebhook'
import { maintainLeadAdsReceipts } from '@/lib/metaLeadAdsRetention'
import { BodyLimitError, readBoundedBody } from '@/lib/boundedBody'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.META_LEAD_ADS_WORKER_SECRET || ''
  const bearer = request.headers.get('authorization') || ''
  if (secret.length < 32 || !bearer.startsWith('Bearer ') || !keyMatches(secret, bearer.slice(7))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: any
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
    await readBoundedBody(request.body, 4096, request.headers.get('content-length')))) }
  catch (error) { return NextResponse.json({ error: 'Invalid body' }, { status: error instanceof BodyLimitError ? 413 : 400 }) }
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : ''
  const permitted = String(process.env.META_LEAD_ADS_RETENTION_ORGANIZATION_IDS || '').split(',').map(value => value.trim()).includes(organizationId)
  if (!organizationId || !permitted) return NextResponse.json({ error: 'Tenant not authorized' }, { status: 403 })
  const apply = body?.apply === true
  if (apply && (process.env.META_LEAD_ADS_RETENTION_ENABLED !== 'true' ||
      request.headers.get('x-meta-lead-ads-retention-confirm') !== 'APPLY_TERMINAL_RETENTION')) {
    return NextResponse.json({ error: 'Retention apply disabled' }, { status: 403 })
  }
  try {
    return NextResponse.json(await maintainLeadAdsReceipts(organizationId, apply), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Retention unavailable' }, { status: 503 })
  }
}
