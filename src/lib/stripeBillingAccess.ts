import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.ts'
import { StripeBillingError } from './stripeBillingConfig.ts'
export type Actor = { [key: string]: unknown; id?: unknown; organizationId?: unknown; sessionVersion?: unknown }
type Tx = Prisma.TransactionClient

// Re-read privileges from the database. A stale signed role or tenant supplied
// in JSON never authorizes billing, including for system administrators.
export async function authorizeStripeBilling(actor: Actor | null, db: Pick<Tx, 'user'> = prisma) {
  const id = Number(actor?.id), organizationId = String(actor?.organizationId || '')
  if (!Number.isInteger(id) || id <= 0 || !organizationId) throw new StripeBillingError('UNAUTHORIZED', 401)
  const user = await db.user.findFirst({
    where: { id, organizationId }, select: { id: true, role: true, restrictedAccess: true, sessionVersion: true },
  })
  if (!user || user.sessionVersion !== Number(actor?.sessionVersion ?? 0)) throw new StripeBillingError('UNAUTHORIZED', 401)
  if (!['owner', 'admin'].includes(user.role) || user.restrictedAccess) throw new StripeBillingError('FORBIDDEN', 403)
  return organizationId
}
