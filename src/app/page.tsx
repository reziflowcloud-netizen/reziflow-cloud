import MarketingLandingContent from '@/components/MarketingLandingContent'

export default function LandingPage({ searchParams }: { searchParams?: { ref?: string } }) {
  return <MarketingLandingContent referralCode={searchParams?.ref} />
}
