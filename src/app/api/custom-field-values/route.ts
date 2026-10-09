import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findScopedCase, findScopedClient, findScopedLead } from '@/lib/apiScope'
import { PATCH as patchCase } from '../cases/[id]/route'
import { PATCH as patchClient } from '../clients/[id]/route'
import { PATCH as patchLead } from '../leads/[id]/route'

function normalizeScope(value: unknown) {
  return value === 'case' || value === 'lead' ? value : 'client'
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = normalizeScope(req.nextUrl.searchParams.get('scope'))
  const recordId = String(req.nextUrl.searchParams.get('recordId') || '')
  if (!recordId) return NextResponse.json({ error: 'recordId is required' }, { status: 400 })
  const record = scope === 'case'
    ? await findScopedCase(recordId, organizationId, { id: true, updatedAt: true })
    : scope === 'lead' ? await findScopedLead(recordId, organizationId, { id: true, updatedAt: true }) : await findScopedClient(recordId, organizationId, { id: true, updatedAt: true })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sections = await prisma.customSection.findMany({
    where: { organizationId, scope, active: true },
    include: {
      fields: {
        where: { active: true },
        include: {
          values: {
            where: { organizationId, recordType: scope, recordId },
            take: 1,
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  return NextResponse.json({
    expectedUpdatedAt: record.updatedAt,
    sections: sections.map(section => ({
      ...section,
      fields: section.fields.map(field => ({
        ...field,
        value: field.values[0]?.value ?? '',
        values: undefined,
      })),
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const body = await req.json()
  const scope = normalizeScope(body.scope)
  const recordId = String(body.recordId || '')
  const values = body.values && typeof body.values === 'object' ? body.values : {}
  if (!recordId) return NextResponse.json({ error: 'recordId is required' }, { status: 400 })
  const record = scope === 'case'
    ? await findScopedCase(recordId, organizationId, { id: true })
    : await findScopedClient(recordId, organizationId, { id: true })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payload: any = { customFieldValues: values }
  if (Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) payload.expectedUpdatedAt = body.expectedUpdatedAt
  const request = new NextRequest(req.url, { method: 'PATCH', headers: req.headers, body: JSON.stringify(payload) })
  return (scope === 'case' ? patchCase : scope === 'lead' ? patchLead : patchClient)(request, { params: { id: recordId } })
}
