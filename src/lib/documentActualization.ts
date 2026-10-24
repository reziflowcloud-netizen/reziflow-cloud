import { notificationStillActionable } from './notificationPolicy.ts'
import { createHash } from 'node:crypto'
import {
  actualizationDate,
  actualizationFinished,
  actualizationRef,
  actualizationTitles,
} from './documentActualizationPolicy.ts'
export { actualizationRef } from './documentActualizationPolicy.ts'
export function actualizationTaskId(organizationId: string, caseId: string, cycle: string) {
  return (
    'case-actualization-' +
    createHash('sha256')
      .update(JSON.stringify([organizationId, caseId, cycle]))
      .digest('hex')
  )
}
export async function lockActualizationCase(tx: any, organizationId: string, caseId: string) {
  await tx.$queryRawUnsafe(
    'SELECT id FROM "Case" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',
    caseId,
    organizationId,
  )
}
export async function actualizationTasks(tx: any, organizationId: string, caseId: string) {
  const tasks = await tx.task.findMany({
    where: {
      organizationId,
      id: { startsWith: 'case-actualization-' },
      description: { contains: JSON.stringify(caseId) },
    },
  })
  return tasks.filter((t: any) => actualizationRef(t)?.caseId === caseId)
}
export async function actualizationOwner(tx: any, record: any) {
  if (!record.assignedToId) return null
  const user = await tx.user.findFirst({
    where: { id: record.assignedToId, organizationId: record.organizationId },
    select: { id: true },
  })
  if (!user) return null
  if (record.employeeId) {
    const link = await tx.employee.findFirst({
      where: { id: record.employeeId, organizationId: record.organizationId, active: true },
      select: { userId: true },
    })
    if (link?.userId !== user.id) return null
  }
  return user.id
}
export async function cancelActualizationOutbox(tx: any, organizationId: string, taskId: string) {
  await tx.notificationPushDelivery.updateMany({
    where: {
      organizationId,
      deliveredAt: null,
      terminalAt: null,
      notification: { entityType: 'task', entityId: taskId },
    },
    data: { terminalAt: new Date(), leaseUntil: null, leaseToken: null },
  })
}
// Caller holds Case FOR UPDATE before any Task locks. No GET/scheduler activation.
export async function syncDocumentActualization(
  tx: any,
  record: any,
  activate = false,
  language: unknown = 'uk',
) {
  const { organizationId, id: caseId } = record
  if (!organizationId) return
  await tx.$queryRawUnsafe(
    `SELECT id FROM "Task" WHERE "organizationId"=$1 AND id LIKE 'case-actualization-%' AND description LIKE $2 ORDER BY id FOR UPDATE`,
    organizationId,
    '%' + JSON.stringify(caseId) + '%',
  )
  const tasks = await actualizationTasks(tx, organizationId, caseId)
  if (!activate && !tasks.length) return
  const updates = await tx.docUpdate.findMany({ where: { caseId } })
  const cycle = actualizationDate(record, updates)
  const id = cycle ? actualizationTaskId(organizationId, caseId, cycle) : null
  const owner = await actualizationOwner(tx, record)
  for (const task of tasks) {
    const retire = record.decisionReceived || task.id !== id
    if (!actualizationFinished(task) && retire) {
      if (task.status !== 'inactive')
        await tx.task.update({ where: { id: task.id }, data: { status: 'inactive' } })
      await cancelActualizationOutbox(tx, organizationId, task.id)
    }
  }
  if (record.decisionReceived || !cycle || !id) return
  const existing = tasks.find((t: any) => t.id === id)
  if (existing && actualizationFinished(existing)) return // Completion alone never advances a cycle.
  const lang = language === 'ru' || language === 'pl' ? language : 'uk'
  const client = await tx.client.findFirst({
    where: { id: record.clientId, organizationId },
    select: { firstName: true, lastName: true },
  })
  const data = {
    organizationId,
    title: existing?.title || actualizationTitles[lang],
    assignedToId: owner,
    clientName: client ? [client.firstName, client.lastName].filter(Boolean).join(' ') : null,
    status: 'todo',
    dueDate: new Date(cycle + 'T00:00:00Z'),
    description: JSON.stringify({
      reminderAt: cycle + 'T09:00',
      documentActualization: { version: 1, caseId, caseNumber: record.caseNumber || null, cycle },
    }),
  }
  if (!existing) await tx.task.create({ data: { ...data, id } })
  else if (
    existing.status !== 'todo' ||
    existing.assignedToId !== owner ||
    existing.description !== data.description ||
    existing.clientName !== data.clientName
  ) {
    await cancelActualizationOutbox(tx, organizationId, id)
    await tx.task.update({ where: { id }, data })
  }
}
// Read-only validation, after Case lock for scheduler/provider ordering.
export async function actualizationActionable(tx: any, task: any) {
  const ref = actualizationRef(task)
  if (!ref) return true
  const record = await tx.case.findFirst({
    where: { id: ref.caseId, organizationId: task.organizationId },
  })
  if (
    !record ||
    record.decisionReceived ||
    actualizationFinished(task) ||
    task.status === 'inactive'
  )
    return false
  const updates = await tx.docUpdate.findMany({ where: { caseId: record.id } })
  return (
    actualizationDate(record, updates) === ref.cycle &&
    task.id === actualizationTaskId(task.organizationId, ref.caseId, ref.cycle) &&
    (await actualizationOwner(tx, record)) === task.assignedToId
  )
}

// Queued/retry managed deliveries serialize with stop/reschedule. A send already
// handed to the provider cannot be recalled; it precedes the stopping commit.
export async function withActualizationDelivery(
  db: any,
  task: any,
  lease: any,
  send: () => Promise<void>,
  now = new Date(),
) {
  const ref = actualizationRef(task)
  if (!ref) {
    await send()
    return true
  }
  return db.$transaction(
    async (tx: any) => {
      await lockActualizationCase(tx, task.organizationId, ref.caseId)
      await tx.$queryRawUnsafe(
        'SELECT id FROM "Task" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',
        task.id,
        task.organizationId,
      )
      const fresh = await tx.task.findFirst({
        where: { id: task.id, organizationId: task.organizationId },
      })
      const pending = await tx.notificationPushDelivery.findFirst({
        where: { ...lease, deliveredAt: null, terminalAt: null },
        include: { notification: true },
      })
      if (
        !fresh ||
        !pending ||
        pending.notification.readAt ||
        !pending.notification.pushRequested ||
        !notificationStillActionable(pending.notification, fresh, now) ||
        !(await actualizationActionable(tx, fresh))
      )
        return false
      await send()
      await tx.notificationPushDelivery.updateMany({
        where: { ...lease, terminalAt: null },
        data: { deliveredAt: new Date(), leaseUntil: null, leaseToken: null },
      })
      return true
    },
    { timeout: 15000 },
  )
}
