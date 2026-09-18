import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDataAccessScope } from '@/lib/apiScope'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const access = await getDataAccessScope(user, organizationId)
  const employees = await (prisma as any).employee.findMany({
    where: { organizationId, active: true },
    select: { id: true, name: true, userId: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  return NextResponse.json({
    restricted: access.restricted,
    defaultScope: access.restricted ? 'mine' : 'all',
    employees,
  })
}
