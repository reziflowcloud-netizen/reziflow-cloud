import { notFound } from 'next/navigation'
import { getOrganizationId, getUser } from '@/lib/auth'
import { metaLeadAdsFeatureEnabled } from '@/lib/metaLeadAdsFeature'
import MetaLeadAdsClient from './MetaLeadAdsClient'

export const dynamic = 'force-dynamic'
export default async function MetaLeadAdsPage() {
  const user = await getUser()
  if (!user || (user.role !== 'owner' && user.role !== 'admin') || user.restrictedAccess === true ||
      !metaLeadAdsFeatureEnabled(getOrganizationId(user))) notFound()
  return <MetaLeadAdsClient />
}
