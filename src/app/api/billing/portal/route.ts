import { getUser } from '@/lib/auth'
import { stripeBillingAction } from '@/lib/stripeBillingHttp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return stripeBillingAction(request, await getUser(), 'portal')
}
