import { NextRequest, NextResponse } from 'next/server'
import { keyMatches } from '@/lib/leadWebhook'
import { leadAdsAppConfig, processDueLeadAdsDeliveries } from '@/lib/metaLeadAds'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.META_LEAD_ADS_WORKER_SECRET || ''
  const bearer = request.headers.get('authorization') || ''
  if (secret.length < 32 || !bearer.startsWith('Bearer ') || !keyMatches(secret, bearer.slice(7))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const config = leadAdsAppConfig()
  if (!config || process.env.META_LEAD_ADS_ENABLED !== 'true' || process.env.META_LEAD_ADS_WORKER_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Lead Ads worker disabled' }, { status: 503 })
  }
  try {
    return NextResponse.json(await processDueLeadAdsDeliveries(config.appId, config.secret, config.activationTime!), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Retry worker incomplete' }, { status: 503, headers: { 'Retry-After': '30' } })
  }
}
