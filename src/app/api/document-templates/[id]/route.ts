import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function canManageTemplates(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageTemplates(user)) {
    return NextResponse.json({ error: 'Only organization administrators can manage document templates' }, { status: 403 })
  }

  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })

  const template = await (prisma as any).documentTemplate.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma as any).documentTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
