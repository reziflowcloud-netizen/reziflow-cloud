import PartnerPortalClient from './PartnerPortalClient'

export default function PartnerPage({ searchParams }: { searchParams?: { code?: string, token?: string } }) {
  return <PartnerPortalClient code={searchParams?.code} token={searchParams?.token} />
}
