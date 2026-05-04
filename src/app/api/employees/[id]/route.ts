import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await req.json()
  try {
    const existing = await (prisma as any).employee.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const emp = await (prisma as any).employee.update({ where: { id: parseInt(params.id) }, data: { name: body.name, active: body.active } })
    return NextResponse.json(emp)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const existing = await (prisma as any).employee.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await (prisma as any).employee.delete({ where: { id: parseInt(params.id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
