import { NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function apiVersion(value: string) {
  return value.startsWith('v') ? value : `v${value || '23.0'}`
}

async function inspectToken(label: string, token: string, version: string) {
  if (!token) return { label, configured: false }

  const url = new URL(`https://graph.facebook.com/${apiVersion(version)}/me`)
  url.searchParams.set('fields', 'id,name,instagram_business_account{id,username},connected_instagram_account{id,username}')
  url.searchParams.set('access_token', token)

  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        label,
        configured: true,
        ok: false,
        error: data?.error?.message || `Meta Graph API error ${response.status}`,
      }
    }
    return { label, configured: true, ok: true, data }
  } catch (error: any) {
    return {
      label,
      configured: true,
      ok: false,
      error: error?.message || 'Unable to contact Meta Graph API',
    }
  }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const version = settings.facebookLeadApiVersion || 'v23.0'
  const [facebook, instagram] = await Promise.all([
    inspectToken('Facebook Page Access Token', settings.facebookLeadPageAccessToken || '', version),
    inspectToken('Instagram Page Access Token', settings.instagramMessagesPageAccessToken || '', version),
  ])

  return NextResponse.json({
    apiVersion: version,
    facebook,
    instagram,
    hint: 'Для ответов реальным Instagram-лидам Page Access Token должен быть выдан тем же Meta-приложением, у которого есть Advanced Access для instagram_manage_messages, и должен относиться к странице, связанной с нужным Instagram Business Account.',
  })
}
