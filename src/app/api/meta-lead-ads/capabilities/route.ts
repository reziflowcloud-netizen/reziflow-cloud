import { NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { metaLeadAdsFeatureEnabled } from '@/lib/metaLeadAdsFeature'

export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ canManage: (user.role === 'owner' || user.role === 'admin') &&
    user.restrictedAccess !== true && metaLeadAdsFeatureEnabled(getOrganizationId(user)) },
    { headers: { 'Cache-Control': 'no-store' } })
}
