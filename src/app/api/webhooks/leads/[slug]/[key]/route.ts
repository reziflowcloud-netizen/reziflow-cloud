import { NextRequest } from 'next/server'
import { handleLeadWebhookPing, handleLeadWebhookPost } from '@/lib/leadWebhookHandler'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { slug: string, key: string } }) {
  return handleLeadWebhookPing(request, params.slug, params.key)
}

export async function POST(request: NextRequest, { params }: { params: { slug: string, key: string } }) {
  return handleLeadWebhookPost(request, params.slug, params.key)
}
