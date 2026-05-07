import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const allowedTypes = new Set(['text', 'textarea', 'date', 'number', 'checkbox', 'select'])

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function normalizeOptions(input: unknown) {
  if (Array.isArray(input)) {
    return input.map(item => String(item).trim()).filter(Boolean)
  }
  if (typeof input === 'string') {
    return input.split('\n').map(item => item.trim()).filter(Boolean)
  }
  return []
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const body = await req.json()
  const sectionId = Number(body.sectionId)
  const section = await prisma.customSection.findFirst({
    where: { id: sectionId, organizationId },
  })
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const label = String(body.label || '').trim()
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

  const type = allowedTypes.has(body.type) ? body.type : 'text'
  const last = await prisma.customField.findFirst({
    where: { sectionId },
    orderBy: { sortOrder: 'desc' },
  })

  const field = await prisma.customField.create({
    data: {
      sectionId,
      label,
      type,
      placeholder: String(body.placeholder || '').trim() || null,
      options: type === 'select' ? normalizeOptions(body.options) : undefined,
      required: Boolean(body.required),
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  })

  return NextResponse.json({ field })
}
