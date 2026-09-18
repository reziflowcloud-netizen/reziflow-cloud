import { prisma } from '@/lib/prisma'
import type { DataAccessScope } from '@/lib/apiScope'
import {
  BulkRequestError,
  buildCaseSelectionWhere,
  buildLeadSelectionWhere,
  type BulkAction,
  type BulkSelection,
} from '@/lib/bulkActions'
import { shouldRetirePersonalAppearTask } from '@/lib/caseImportantDateTasks'
import { resolveUserIdForEmployee } from '@/lib/employeeSync'
import { leadAssignmentData } from '@/lib/leadAssignmentPolicy'
import type { ResolvedStaffScope } from '@/lib/staffScope'

type BulkInput = {
  action: BulkAction
  selection: BulkSelection
  employeeId?: unknown
  statusId?: unknown
  statusReason?: unknown
  statusReasonComment?: unknown
}

function integerId(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength)
}

async function validateEmployee(organizationId: string, rawId: unknown) {
  const id = integerId(rawId)
  if (!id) throw new BulkRequestError('Employee is required')
  const employee = await (prisma as any).employee.findFirst({
    where: { id, organizationId, active: true },
    select: { id: true, name: true },
  })
  if (!employee) throw new BulkRequestError('Employee not found', 404)
  return employee
}

function ensureAccessibleIds(selection: BulkSelection, matched: number) {
  if (selection.mode === 'ids' && matched !== selection.ids.length) {
    throw new BulkRequestError('Selection contains inaccessible records', 403)
  }
}

export async function executeLeadBulkAction(args: {
  organizationId: string
  scope: DataAccessScope
  user: any
  input: BulkInput
  staffScope?: ResolvedStaffScope
}) {
  const { organizationId, scope, user, input, staffScope } = args
  const where = buildLeadSelectionWhere(input.selection, scope, organizationId, staffScope)

  if (input.action === 'assign_employee' || input.action === 'unassign_employee') {
    const matched = await (prisma as any).lead.count({ where })
    ensureAccessibleIds(input.selection, matched)
    if (!matched) return { matched: 0, updated: 0 }
    const employee = input.action === 'assign_employee'
      ? await validateEmployee(organizationId, input.employeeId)
      : null
    const assignedToId = employee
      ? await resolveUserIdForEmployee(organizationId, employee.id)
      : null
    const result = await (prisma as any).lead.updateMany({
      where,
      data: leadAssignmentData(employee?.id, assignedToId),
    })
    return { matched, updated: result.count, employee }
  }

  const records = await (prisma as any).lead.findMany({
    where,
    select: { id: true, status: true },
  })
  ensureAccessibleIds(input.selection, records.length)
  if (!records.length) return { matched: 0, updated: 0 }

  const statusId = integerId(input.statusId)
  if (!statusId) throw new BulkRequestError('Status is required')
  const targetStatus = await (prisma as any).leadStatus.findFirst({
    where: { id: statusId, organizationId },
    select: { id: true, name: true, requireReason: true, reasons: true },
  })
  if (!targetStatus) throw new BulkRequestError('Lead status not found', 404)

  const reason = cleanText(input.statusReason, 160)
  const comment = cleanText(input.statusReasonComment)
  const allowedReasons = Array.isArray(targetStatus.reasons)
    ? targetStatus.reasons.map((item: unknown) => String(item))
    : []
  if (targetStatus.requireReason && !reason) {
    throw new BulkRequestError('Status change reason is required')
  }
  if (targetStatus.requireReason && allowedReasons.length && !allowedReasons.includes(reason)) {
    throw new BulkRequestError('Invalid status change reason')
  }

  const changed = records.filter((record: any) => record.status !== targetStatus.name)
  const now = new Date()
  if (changed.length) {
    await prisma.$transaction(async tx => {
      await (tx as any).lead.updateMany({
        where: { AND: [where, { status: { not: targetStatus.name } }] },
        data: {
          status: targetStatus.name,
          statusReason: targetStatus.requireReason ? reason : null,
          statusReasonComment: targetStatus.requireReason ? comment || null : null,
        },
      })
      const historyRows = changed.flatMap((record: any) => {
          const rows = [{
            organizationId,
            leadId: record.id,
            authorId: Number(user.id),
            contactAt: now,
            note: `Статус изменен: ${record.status || '—'} -> ${targetStatus.name}`,
          }]
          if (targetStatus.requireReason && reason) {
            rows.push({
              organizationId,
              leadId: record.id,
              authorId: Number(user.id),
              contactAt: now,
              note: [`Причина статуса: ${reason}`, comment ? `Комментарий: ${comment}` : ''].filter(Boolean).join('. '),
            })
          }
          return rows
        })
      for (let index = 0; index < historyRows.length; index += 500) {
        await (tx as any).leadContactHistory.createMany({
          data: historyRows.slice(index, index + 500),
        })
      }
    })
  }
  return { matched: records.length, updated: changed.length, status: targetStatus }
}

async function retirePersonalAppearanceTasks(
  organizationId: string,
  records: Array<{ id: string; status: string; personalAppearDate: Date | null }>,
  changedAt: Date,
) {
  const retireIds = records
    .filter(record => shouldRetirePersonalAppearTask(
      record.personalAppearDate,
      [{ fromStatus: record.status, changedAt }],
      changedAt,
    ))
    .map(record => record.id)
  if (!retireIds.length) return

  for (let index = 0; index < retireIds.length; index += 100) {
    const chunk = retireIds.slice(index, index + 100)
    await prisma.task.deleteMany({
      where: {
        organizationId,
        OR: chunk.map(caseId => ({
          AND: [
            { description: { contains: `\"caseId\":\"${caseId}\"` } },
            { description: { contains: '"kind":"personalAppearDate"' } },
          ],
        })),
      },
    })
  }
}

export async function executeCaseBulkAction(args: {
  organizationId: string
  scope: DataAccessScope
  user: any
  input: BulkInput
  staffScope?: ResolvedStaffScope
}) {
  const { organizationId, scope, user, input, staffScope } = args
  const where = buildCaseSelectionWhere(input.selection, scope, organizationId, staffScope)

  if (input.action === 'assign_employee' || input.action === 'unassign_employee') {
    const matched = await prisma.case.count({ where })
    ensureAccessibleIds(input.selection, matched)
    if (!matched) return { matched: 0, updated: 0 }
    const employee = input.action === 'assign_employee'
      ? await validateEmployee(organizationId, input.employeeId)
      : null
    const assignedToId = employee
      ? await resolveUserIdForEmployee(organizationId, employee.id)
      : null
    const result = await prisma.case.updateMany({
      where,
      data: { employeeId: employee?.id || null, assignedToId },
    })
    return { matched, updated: result.count, employee }
  }

  const records = await prisma.case.findMany({
    where,
    select: { id: true, status: true, personalAppearDate: true },
  })
  ensureAccessibleIds(input.selection, records.length)
  if (!records.length) return { matched: 0, updated: 0 }

  const statusId = integerId(input.statusId)
  if (!statusId) throw new BulkRequestError('Status is required')
  const targetStatus = await prisma.caseStatus.findFirst({
    where: { id: statusId, organizationId },
    select: { id: true, name: true },
  })
  if (!targetStatus) throw new BulkRequestError('Case status not found', 404)

  const changed = records.filter(record => record.status !== targetStatus.name)
  const changedAt = new Date()
  if (changed.length) {
    await prisma.$transaction(async tx => {
      await tx.case.updateMany({
        where: { AND: [where, { status: { not: targetStatus.name } }] },
        data: { status: targetStatus.name },
      })
      const historyRows = changed.map(record => ({
          caseId: record.id,
          fromStatus: record.status,
          toStatus: targetStatus.name,
          changedBy: user?.name || 'User',
          changedAt,
        }))
      for (let index = 0; index < historyRows.length; index += 500) {
        await tx.statusHistory.createMany({
          data: historyRows.slice(index, index + 500),
        })
      }
    })
    await retirePersonalAppearanceTasks(organizationId, changed, changedAt)
  }
  return { matched: records.length, updated: changed.length, status: targetStatus }
}
