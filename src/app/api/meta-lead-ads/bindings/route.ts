import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { leadAdsAppConfig, pageToken } from '@/lib/metaLeadAds'
import { metaNumericId } from '@/lib/metaLeadAdsPolicy'
import { leadAdsTupleAuthorized } from '@/lib/metaLeadAdsAuthorization'

export const dynamic = 'force-dynamic'
const db = prisma as any

async function ownerContext() {
  const user = await getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((user.role !== 'owner' && user.role !== 'admin') || user.restrictedAccess === true) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { organizationId: getOrganizationId(user) }
}

export async function GET() {
  const context = await ownerContext()
  if (context.error) return context.error
  const config = leadAdsAppConfig()
  let bindings: any[], counts: any[], diagnostics: any[]
  try {
    bindings = await db.metaLeadAdsBinding.findMany({ where: { organizationId: context.organizationId },
    select: { id: true, pageId: true, formId: true, enabled: true, mode: true, pilotLeadIds: true, updatedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    counts = await db.metaLeadAdsDelivery.groupBy({ by: ['bindingId', 'status'],
      where: { organizationId: context.organizationId }, _count: { id: true },
    })
    diagnostics = await db.metaLeadAdsDelivery.groupBy({ by: ['bindingId', 'lastErrorCode'],
      where: { organizationId: context.organizationId, lastErrorCode: { not: null } }, _count: { id: true },
    })
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.code === 'P2022') return NextResponse.json({ error: 'SCHEMA_NOT_READY' }, { status: 503 })
    throw error
  }
  return NextResponse.json({
    appConfigured: Boolean(config), globallyEnabled: process.env.META_LEAD_ADS_ENABLED === 'true',
    callbackPath: '/api/webhooks/meta/lead-ads',
    bindings: bindings.map((binding: any) => ({ ...binding,
      credentialConfigured: Boolean(pageToken(binding.pageId)),
      counts: Object.fromEntries(counts.filter((row: any) => row.bindingId === binding.id)
        .map((row: any) => [row.status, row._count.id])),
      diagnostics: Object.fromEntries(diagnostics.filter((row: any) => row.bindingId === binding.id)
        .map((row: any) => [row.lastErrorCode, row._count.id])),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

function inputIds(body: any) {
  if (!Array.isArray(body?.pilotLeadIds) || body.pilotLeadIds.length > 50) return null
  const ids = body.pilotLeadIds.map(metaNumericId)
  return ids.some((id: string | null) => !id) ? null : Array.from(new Set(ids)) as string[]
}

async function save(request: NextRequest, create: boolean) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  const context = await ownerContext()
  if (context.error) return context.error
  const body = await request.json().catch(() => null)
  const config = leadAdsAppConfig()
  if (!config || !body || typeof body !== 'object') return NextResponse.json({ error: 'App configuration unavailable' }, { status: 503 })
  const mode = String(body.mode || 'off')
  const enabled = body.enabled === true
  const pilotLeadIds = inputIds(body)
  if (!['off', 'pilot', 'live', 'shadow'].includes(mode) || !pilotLeadIds ||
      (enabled && mode === 'off')) return NextResponse.json({ error: 'Invalid binding' }, { status: 400 })
  let pageId: string | null, formId: string | null, id: string | undefined
  if (create) {
    pageId = metaNumericId(body.pageId)
    formId = metaNumericId(body.formId)
  } else {
    id = typeof body.id === 'string' ? body.id : ''
    const existing = await db.metaLeadAdsBinding.findFirst({ where: { id, organizationId: context.organizationId },
      select: { pageId: true, formId: true, appId: true, enabled: true, mode: true, activatedAt: true } })
    if (!existing || existing.appId !== config.appId) return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
    pageId = existing.pageId; formId = existing.formId
  }
  if (!pageId || !formId) return NextResponse.json({ error: 'Invalid Page or Form ID' }, { status: 400 })
  if (!leadAdsTupleAuthorized({ appId: config.appId, pageId, formId,
    organizationId: context.organizationId!, mode: mode as 'off' | 'pilot' | 'live' | 'shadow', pageToken: pageToken(pageId) })) {
    return NextResponse.json({ error: 'Binding authorization unavailable' }, { status: 403 })
  }
  if (enabled) {
    if (mode === 'pilot' && (context.organizationId !== process.env.META_LEAD_ADS_PILOT_ORGANIZATION_ID ||
      !pilotLeadIds.length || !pageToken(pageId))) {
      return NextResponse.json({ error: 'Pilot prerequisites not met' }, { status: 403 })
    }
    if (mode === 'shadow' && !String(process.env.META_LEAD_ADS_SHADOW_ORGANIZATION_IDS || '').split(',').includes(context.organizationId || '')) {
      return NextResponse.json({ error: 'Shadow pilot not approved' }, { status: 403 })
    }
    if (mode === 'live' && (!String(process.env.META_LEAD_ADS_LIVE_ORGANIZATION_IDS || '').split(',').includes(context.organizationId || '') ||
        !pageToken(pageId))) {
      return NextResponse.json({ error: 'Live mode not approved' }, { status: 403 })
    }
  }
  try {
    const binding = await db.$transaction(async (tx: any) => {
      // Serialize OFF/activation against inboundLeadOnce's tenant lock.
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2000ms'")
      await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', context.organizationId)
      const latest = create ? null : await tx.metaLeadAdsBinding.findFirst({ where: {
        id, organizationId: context.organizationId, appId: config.appId,
      }, select: { enabled: true, mode: true, activatedAt: true } })
      if (!create && !latest) throw new Error('BINDING_CHANGED')
      const data = { enabled, mode, pilotLeadIds,
        activatedAt: enabled && (!latest?.enabled || latest.mode !== mode || !latest.activatedAt)
          ? new Date() : latest?.activatedAt || null }
      return create
        ? tx.metaLeadAdsBinding.create({ data: { ...data, organizationId: context.organizationId, appId: config.appId, pageId, formId }, select: { id: true } })
        : tx.metaLeadAdsBinding.update({ where: { id, organizationId: context.organizationId }, data, select: { id: true } })
    }, { timeout: 8000, maxWait: 2000 })
    return NextResponse.json({ ok: true, id: binding.id })
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Page/Form already bound' }, { status: 409 })
    if (error?.code === 'P2024' || error?.code === 'P2028' || error?.meta?.code === '55P03') {
      return NextResponse.json({ error: 'BINDING_BUSY_RETRY' }, { status: 503, headers: { 'Retry-After': '3' } })
    }
    return NextResponse.json({ error: 'Binding save failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) { return save(request, true) }
export async function PUT(request: NextRequest) { return save(request, false) }

// Emergency tenant-local disable remains available after server authorization is
// withdrawn. The Organization lock is shared with Lead creation's final check.
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  const context = await ownerContext()
  if (context.error) return context.error
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid binding' }, { status: 400 })
  try {
    const result = await db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2000ms'")
      await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', context.organizationId)
      return tx.metaLeadAdsBinding.updateMany({ where: { id: body.id, organizationId: context.organizationId },
        data: { enabled: false, mode: 'off', activatedAt: null, pilotLeadIds: [] } })
    }, { timeout: 8000, maxWait: 2000 })
    return NextResponse.json({ ok: result.count === 1 }, { status: result.count === 1 ? 200 : 404 })
  } catch {
    // A failed disable is never reported as confirmed. The owner can retry.
    return NextResponse.json({ error: 'BINDING_BUSY_RETRY' }, { status: 503, headers: { 'Retry-After': '3' } })
  }
}
