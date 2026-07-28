import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const allowedTypes = new Set(['text', 'email', 'textarea', 'date', 'number', 'checkbox', 'select'])

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

async function findField(id: number, organizationId: string) {
  return prisma.customField.findFirst({
    where: { id, section: { organizationId } },
    include: { section: true },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await findField(id, organizationId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const type = allowedTypes.has(body.type) ? body.type : existing.type
  const data: any = { type }
  if (typeof body.label === 'string') data.label = body.label.trim() || existing.label
  if (typeof body.placeholder === 'string') data.placeholder = body.placeholder.trim() || null
  if (typeof body.required === 'boolean') data.required = body.required
  if (typeof body.active === 'boolean') data.active = body.active
  if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder)
  if ('options' in body) data.options = type === 'select' ? normalizeOptions(body.options) : undefined

  const field = await prisma.customField.update({ where: { id }, data })
  return NextResponse.json({ field })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await findField(id, organizationId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.customField.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
