import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDataAccessScope } from '@/lib/apiScope'
import { staffScopeFilterEnabled } from '@/lib/staffScopeSettings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const access = await getDataAccessScope(user, organizationId)
  const [employees, ownEmployee, organization] = await Promise.all([
    (prisma as any).employee.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, userId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    (prisma as any).employee.findFirst({
      where: { organizationId, userId: Number(user.id), active: true },
      select: { id: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    }),
  ])
  const filterEnabled = staffScopeFilterEnabled(organization?.settings)
  return NextResponse.json({
    restricted: access.restricted,
    defaultScope: access.restricted ? 'mine' : 'all',
    filterEnabled,
    controlVisible: filterEnabled,
    mineAvailable: access.restricted || Boolean(ownEmployee),
    hasEmployeeLink: Boolean(ownEmployee),
    employees,
  })
}
