import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLeadBody } from '@/lib/leads'
import { applyLeadWebhookMapping, getLeadWebhookSettings, sanitizeLeadWebhookPayload } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

type MetaLeadChange = {
  leadgen_id?: string
  form_id?: string
  page_id?: string
  ad_id?: string
  created_time?: number
}

function metaFieldDataToObject(fieldData: any[] = []) {
  const result: Record<string, unknown> = {}
  for (const field of fieldData) {
    const name = String(field?.name || '').trim()
    if (!name) continue
    const values = Array.isArray(field?.values) ? field.values.filter(Boolean) : []
    result[name] = values.length > 1 ? values.join(', ') : values[0] || ''
  }
  return result
}

function collectLeadChanges(body: any): MetaLeadChange[] {
  const entries = Array.isArray(body?.entry) ? body.entry : []
  const changes: MetaLeadChange[] = []

  for (const entry of entries) {
    const entryChanges = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of entryChanges) {
      if (change?.field !== 'leadgen') continue
      if (change?.value?.leadgen_id) changes.push(change.value)
    }
  }

  return changes
}

async function fetchMetaLead(leadgenId: string, accessToken: string, apiVersion: string) {
  const version = apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`
  const fields = [
    'id',
    'created_time',
    'ad_id',
    'ad_name',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'form_id',
    'field_data',
    'platform',
  ].join(',')
  const url = new URL(`https://graph.facebook.com/${version}/${leadgenId}`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Meta Graph API error ${response.status}`
    throw new Error(message)
  }
  return data
}

function metaLeadToWebhookPayload(metaLead: any, change: MetaLeadChange) {
  const fields = metaFieldDataToObject(Array.isArray(metaLead?.field_data) ? metaLead.field_data : [])
  const campaignParts = [
    metaLead?.campaign_name ? `Campaign: ${metaLead.campaign_name}` : '',
    metaLead?.adset_name ? `Ad set: ${metaLead.adset_name}` : '',
    metaLead?.ad_name ? `Ad: ${metaLead.ad_name}` : '',
    metaLead?.form_id || change.form_id ? `Form ID: ${metaLead?.form_id || change.form_id}` : '',
  ].filter(Boolean)

  return {
    ...fields,
    source: 'facebook',
    messengerId: `meta:${metaLead?.id || change.leadgen_id}`,
    notes: campaignParts.join('\n'),
    metaLeadId: metaLead?.id || change.leadgen_id,
    metaPageId: change.page_id,
    metaFormId: metaLead?.form_id || change.form_id,
    metaAdId: metaLead?.ad_id || change.ad_id,
    metaPlatform: metaLead?.platform,
  }
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { settings: true },
  })
  if (!organization) return new NextResponse('Organization not found', { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge') || ''

  if (mode === 'subscribe' && token && token === settings.facebookLeadVerifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Invalid verify token', { status: 403 })
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const body = await request.json().catch(() => ({}))
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  const safePayload = sanitizeLeadWebhookPayload(body)
  if (!settings.facebookLeadEnabled) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'rejected',
        source: 'facebook',
        payload: safePayload,
        error: 'Facebook Lead Ads integration is disabled',
      },
    })
    return NextResponse.json({ error: 'Facebook Lead Ads integration is disabled' }, { status: 403 })
  }

  if (!settings.facebookLeadPageAccessToken) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'failed',
        source: 'facebook',
        payload: safePayload,
        error: 'Facebook page access token is missing',
      },
    })
    return NextResponse.json({ error: 'Facebook page access token is missing' }, { status: 400 })
  }

  const changes = collectLeadChanges(body)
  if (changes.length === 0) {
    await (prisma as any).leadWebhookLog.create({
      data: {
        organizationId: organization.id,
        status: 'failed',
        source: 'facebook',
        payload: safePayload,
        error: 'No leadgen changes in Meta webhook payload',
      },
    })
    return NextResponse.json({ ok: true, created: 0 })
  }

  const createdLeadIds: string[] = []
  const errors: string[] = []

  for (const change of changes) {
    const leadgenId = String(change.leadgen_id || '').trim()
    if (!leadgenId) continue

    const existing = await (prisma as any).lead.findFirst({
      where: { organizationId: organization.id, messengerId: `meta:${leadgenId}` },
      select: { id: true },
    })
    if (existing) continue

    try {
      const metaLead = await fetchMetaLead(
        leadgenId,
        settings.facebookLeadPageAccessToken || '',
        settings.facebookLeadApiVersion || 'v23.0'
      )
      const webhookPayload = metaLeadToWebhookPayload(metaLead, change)
      const mappedBody = applyLeadWebhookMapping(webhookPayload, settings.leadWebhookFieldMap || [])
      const data = normalizeLeadBody(mappedBody)

      const lead = await (prisma as any).$transaction(async (tx: any) => {
        const created = await tx.lead.create({
          data: {
            organizationId: organization.id,
            ...data,
            source: 'facebook',
            messengerId: `meta:${leadgenId}`,
          },
        })
        await tx.leadWebhookLog.create({
          data: {
            organizationId: organization.id,
            leadId: created.id,
            status: 'created',
            source: 'facebook',
            payload: {
              raw: safePayload,
              metaLead: sanitizeLeadWebhookPayload(metaLead),
              mapped: sanitizeLeadWebhookPayload(mappedBody),
            },
          },
        })
        return created
      })
      createdLeadIds.push(lead.id)
    } catch (error: any) {
      const message = error?.message || 'Failed to process Meta lead'
      errors.push(message)
      await (prisma as any).leadWebhookLog.create({
        data: {
          organizationId: organization.id,
          status: 'failed',
          source: 'facebook',
          payload: safePayload,
          error: message,
        },
      })
    }
  }

  return NextResponse.json({ ok: errors.length === 0, created: createdLeadIds.length, leadIds: createdLeadIds, errors })
}
