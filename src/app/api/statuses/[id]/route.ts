import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

function isArchiveStatusName(name: string) {
  return ['архив', 'архів', 'archive', 'archiwum'].includes(String(name || '').trim().toLowerCase())
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const existing = await prisma.caseStatus.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: any = { name: body.name, color: body.color }
    if (body.order !== undefined) data.order = body.order
    const status = await prisma.caseStatus.update({
      where: { id: parseInt(params.id) },
      data,
    })
    return NextResponse.json(status)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const existing = await prisma.caseStatus.findFirst({ where: { id: parseInt(params.id), organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (isArchiveStatusName(existing.name)) {
    return NextResponse.json({ error: 'Archive status cannot be deleted' }, { status: 400 })
  }

  await prisma.caseStatus.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
