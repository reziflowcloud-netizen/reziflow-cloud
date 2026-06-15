import MarketingLandingContent from '@/components/MarketingLandingContent'

export default function PricingPage({ searchParams }: { searchParams?: { ref?: string } }) {
  return <MarketingLandingContent referralCode={searchParams?.ref} initialSectionId="pricing" />
}
