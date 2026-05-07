import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeScope(value: unknown) {
  return value === 'case' ? 'case' : 'client'
}

function normalizeValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return ''
  return String(value)
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = normalizeScope(req.nextUrl.searchParams.get('scope'))
  const recordId = String(req.nextUrl.searchParams.get('recordId') || '')
  if (!recordId) return NextResponse.json({ error: 'recordId is required' }, { status: 400 })

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

  const fieldIds = Object.keys(values).map(id => Number(id)).filter(Number.isFinite)
  if (fieldIds.length === 0) return NextResponse.json({ ok: true })

  const fields = await prisma.customField.findMany({
    where: {
      id: { in: fieldIds },
      active: true,
      section: { organizationId, scope, active: true },
    },
  })
  const allowed = new Set(fields.map(field => field.id))

  await prisma.$transaction(fieldIds.filter(id => allowed.has(id)).map(fieldId => (
    prisma.customFieldValue.upsert({
      where: {
        fieldId_recordType_recordId: {
          fieldId,
          recordType: scope,
          recordId,
        },
      },
      update: { value: normalizeValue(values[fieldId]) },
      create: {
        organizationId,
        fieldId,
        recordType: scope,
        recordId,
        value: normalizeValue(values[fieldId]),
      },
    })
  )))

  return NextResponse.json({ ok: true })
}
