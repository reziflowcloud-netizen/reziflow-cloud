import { prisma } from '@/lib/prisma'

export async function findScopedCase(caseId: string, organizationId: string, select?: any) {
  return prisma.case.findFirst({
    where: { id: caseId, organizationId },
    ...(select ? { select } : {}),
  } as any)
}

export async function findScopedClient(clientId: string, organizationId: string, select?: any) {
  return prisma.client.findFirst({
    where: { id: clientId, organizationId },
    ...(select ? { select } : {}),
  } as any)
}
