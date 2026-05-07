import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function findSection(id: number, organizationId: string) {
  return prisma.customSection.findFirst({ where: { id, organizationId } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await findSection(id, organizationId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: any = {}
  if (typeof body.title === 'string') data.title = body.title.trim() || existing.title
  if (typeof body.description === 'string') data.description = body.description.trim() || null
  if (typeof body.active === 'boolean') data.active = body.active
  if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder)

  const section = await prisma.customSection.update({
    where: { id },
    data,
    include: { fields: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  })
  return NextResponse.json({ section })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await findSection(id, organizationId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.customSection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
