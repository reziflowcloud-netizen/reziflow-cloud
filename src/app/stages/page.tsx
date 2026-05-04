import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import StagesClient from './StagesClient'

export const dynamic = 'force-dynamic'

export default async function StagesPage() {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const [statuses, clients] = await Promise.all([
    prisma.caseStatus.findMany({ where: { organizationId }, orderBy: { order: 'asc' } }),
    prisma.client.findMany({
      where: { organizationId },
      include: {
        cases: {
          select: {
            id: true,
            caseNumber: true,
            status: true,
            service: { select: { name: true, color: true } },
            totalValue: true,
            totalPaid: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ])

  return (
    <StagesClient
      statuses={statuses.map(status => ({
        id: status.id,
        name: status.name,
        color: status.color,
        order: status.order,
      }))}
      clients={clients.map(client => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        cases: client.cases.map(item => ({
          id: item.id,
          caseNumber: item.caseNumber,
          status: item.status,
          service: item.service,
          totalValue: Number(item.totalValue || 0),
          totalPaid: Number(item.totalPaid || 0),
        })),
      }))}
    />
  )
}
