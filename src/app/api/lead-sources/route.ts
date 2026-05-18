import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DEFAULT_LEAD_SOURCES, normalizeLeadSources } from '@/lib/leads'
import { settingsObject } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function makeSourceValue(label: string) {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return slug || `source_${randomBytes(4).toString('hex')}`
}

function normalizeIncomingSources(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_LEAD_SOURCES
  const seen = new Set<string>()
  return value
    .map((item: any, index) => {
      const label = String(item?.label || '').trim()
      if (!label) return null
      let sourceValue = String(item?.value || '').trim() || makeSourceValue(label)
      if (seen.has(sourceValue)) sourceValue = `${sourceValue}_${randomBytes(2).toString('hex')}`
      seen.add(sourceValue)
      return {
        value: sourceValue,
        label,
        order: index,
        system: Boolean(item?.system),
      }
    })
    .filter(Boolean)
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  const settings = settingsObject(organization?.settings)

  return NextResponse.json({
    sources: normalizeLeadSources(settings.leadSources),
    canManage: canManage(user),
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const body = await request.json().catch(() => ({}))
  const sources = normalizeIncomingSources(body.sources)
  if (!sources.length) return NextResponse.json({ error: 'Добавьте хотя бы один источник' }, { status: 400 })

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = settingsObject(organization.settings)
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        leadSources: sources,
      },
    },
  })

  return NextResponse.json({
    sources: normalizeLeadSources(sources),
    canManage: true,
  })
}
