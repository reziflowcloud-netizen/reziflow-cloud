import { stripeBillingWebhook } from '@/lib/stripeBillingHttp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return stripeBillingWebhook(request)
}
