import { createHash } from 'node:crypto'

export class TaskCreateConflict extends Error {}
// Clients retain this key across retries and create a new key for a new task.
export async function createTaskOnce(tx: any, organizationId: string, userId: number, key: string | null, data: any) {
  if (!key) return tx.task.create({ data }) // Compatibility for already-open clients.
  const id = 'task-request-' + createHash('sha256').update(JSON.stringify([organizationId, userId, key.toLowerCase()])).digest('hex')
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))::text', id)
  const existing = await tx.task.findFirst({ where: { id, organizationId } })
  if (existing) {
    const matches = Object.keys(data).every(field => data[field] instanceof Date
      ? existing[field]?.getTime() === data[field].getTime() : existing[field] === data[field])
    if (!matches) throw new TaskCreateConflict('Create key already used')
    return { ...existing, replay: true }
  }
  return tx.task.create({ data: { ...data, id } })
}
