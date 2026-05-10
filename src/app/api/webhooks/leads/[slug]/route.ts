import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeLeadBody } from '@/lib/leads'
import { getLeadWebhookSettings, keyMatches } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function readWebhookKey(request: NextRequest, body: any) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  return request.headers.get('x-reziflow-key') || bearer || body?.apiKey || body?.key || ''
}

function appendPayloadNote(notes: string | null, payload: any) {
  const sourceNote = payload?.sourceName || payload?.campaign || payload?.formName
  const parts = [notes, sourceNote ? `Source details: ${sourceNote}` : 'Lead received via webhook'].filter(Boolean)
  return parts.join('\n')
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const body = await request.json().catch(() => ({}))
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { id: true, settings: true },
  })

  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  if (settings.leadWebhookEnabled === false) {
    return NextResponse.json({ error: 'Lead webhook is disabled' }, { status: 403 })
  }

  const receivedKey = readWebhookKey(request, body)
  if (!keyMatches(settings.leadWebhookKey || '', receivedKey)) {
    return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 })
  }

  const data = normalizeLeadBody({
    ...body,
    source: body.source || 'website',
  })

  if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) {
    return NextResponse.json({ error: 'Provide firstName, lastName, fullName, phone, email, Instagram or Facebook' }, { status: 400 })
  }

  const lead = await (prisma as any).lead.create({
    data: {
      organizationId: organization.id,
      ...data,
      notes: appendPayloadNote(data.notes, body),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ok: true, leadId: lead.id, lead }, { status: 201 })
}

