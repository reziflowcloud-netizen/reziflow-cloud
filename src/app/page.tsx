import MarketingLandingContent from '@/components/MarketingLandingContent'
import { getUser } from '@/lib/auth'

export default async function LandingPage({ searchParams }: { searchParams?: { ref?: string } }) {
  const user = await getUser()

  return <MarketingLandingContent referralCode={searchParams?.ref} isAuthenticated={Boolean(user)} />
}
