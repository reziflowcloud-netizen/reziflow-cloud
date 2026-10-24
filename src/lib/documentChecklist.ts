import {syncDocumentActualization} from './documentActualization.ts'
import { Prisma } from '@prisma/client'
import { ChecklistError, checklistProgress, documentNameKey } from './documentChecklistPolicy.ts'
import { lockedOrganizationAutomation } from './notificationOrganization.ts'
import { projectLegacyRequirements } from './documentChecklistLegacyMapping.ts'

export async function effectiveDocumentTemplate(db: Prisma.TransactionClient, organizationId: string, serviceId: number | null) {
  const service = serviceId ? await db.service.findFirst({ where: { id: serviceId, organizationId }, include: { documentRequirements: { orderBy: { sortOrder: 'asc' } } } }) : null
  if (serviceId && !service) throw new ChecklistError('Service not found', 404)
  if (service?.documentTemplateInitializedAt) return { service, items: service.documentRequirements, legacy: false }
  const specific = serviceId ? await db.caseOption.findMany({ where: { organizationId, type: `mosDocument:${serviceId}` }, orderBy: { order: 'asc' } }) : []
  const options = specific.length ? specific : await db.caseOption.findMany({ where: { organizationId, type: 'mosDocument' }, orderBy: { order: 'asc' } })
  const { items } = projectLegacyRequirements(options)
  return { service, items, legacy: true }
}

export async function createCaseWithChecklist(db: Prisma.TransactionClient, data: Prisma.CaseUncheckedCreateInput) {
  const organizationId = data.organizationId
  if (!organizationId) throw new ChecklistError('Organization required')
  if (!await db.client.findFirst({ where: { id: data.clientId, organizationId }, select: { id: true } })) throw new ChecklistError('Client not found', 404)
  if (data.assignedToId && !await db.user.findFirst({ where: { id: data.assignedToId, organizationId }, select: { id: true } })) throw new ChecklistError('Responsible user not found', 404)
  if (data.employeeId && !await db.employee.findFirst({ where: { id: data.employeeId, organizationId }, select: { id: true } })) throw new ChecklistError('Employee not found', 404)
  // Serialize template edits and snapshots; use only the supplied client inside a transaction.
  if (data.serviceId) await db.$queryRaw(Prisma.sql`SELECT id FROM "Service" WHERE id = ${data.serviceId} AND "organizationId" = ${organizationId} FOR SHARE`)
  const template = await effectiveDocumentTemplate(db, organizationId, data.serviceId || null)
  const created = await db.case.create({ data: { ...data, checklistInitializedAt: new Date(), checklistServiceId: data.serviceId || null, documentsReady: !template.items.some(item => item.active && item.required),
    checklistItems: { create: template.items.filter(item => item.active).map(item => ({ templateId: item.id || null, name: item.name, nameKey: item.nameKey, required: item.required, forMos: item.forMos, sortOrder: item.sortOrder })) } } })
  await syncDocumentActualization(db,created,true)
  return created
}

export async function checklistPayload(db: Prisma.TransactionClient, caseId: string) {
  const record = await db.case.findUniqueOrThrow({ where: { id: caseId }, select: { checklistInitializedAt: true, checklistVersion: true, checklistServiceId: true, serviceId: true,
    checklistItems: { orderBy: { sortOrder: 'asc' }, include: { files: { select: { id: true, name: true } } } } } })
  return { initialized: !!record.checklistInitializedAt, version: record.checklistVersion, serviceId: record.serviceId,
    templateServiceId: record.checklistServiceId, items: record.checklistItems, progress: checklistProgress(record.checklistItems) }
}

export async function updateChecklistReadiness(db: Prisma.TransactionClient, caseId: string, baseline = false) {
  // Caller holds the Case row lock: status, readiness occurrence and notification commit together.
  const record = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { checklistItems: true } })
  const progress = checklistProgress(record.checklistItems)
  const ready = progress.ready
  const occurrence = record.documentsReadyOccurrence + (!baseline && ready && progress.actionable && !record.documentsReady ? 1 : 0)
  // Raw update deliberately leaves the independent Case autosave updatedAt version untouched.
  await db.$executeRaw(Prisma.sql`UPDATE "Case" SET "documentsReady" = ${ready}, "documentsReadyOccurrence" = ${occurrence}, "checklistVersion" = "checklistVersion" + 1 WHERE id = ${caseId}`)
  if (baseline || !ready || !progress.actionable || record.documentsReady || !record.assignedToId || !record.organizationId || process.env.NOTIFICATIONS_ENABLED !== 'true') return
  const automation = await lockedOrganizationAutomation(db, record.organizationId)
  if (!automation.enabled) return
  const recipient = await db.user.findFirst({ where: { id: record.assignedToId, organizationId: record.organizationId }, include: { notificationPreference: true } })
  if (!recipient) return
  if (record.employeeId && !await db.employee.findFirst({ where: { id: record.employeeId, organizationId: record.organizationId, active: true, userId: recipient.id } })) return
  const preference = recipient.notificationPreference
  const events = preference?.events as Record<string, any> | undefined
  if (events?.documents_ready?.inApp === false) return
  const lang = preference?.language || 'uk'
  const title = lang === 'ru' ? 'Комплект документов готов' : lang === 'pl' ? 'Komplet dokumentów gotowy' : 'Комплект документів готовий'
  await db.notification.createMany({ data: [{ organizationId: record.organizationId, userId: recipient.id, type: 'documents_ready', title,
    body: record.caseNumber || '', entityType: 'case', entityId: caseId, deepLink: `/cases/${caseId}?tab=docs`,
    dedupeKey: `documents_ready:case:${caseId}:${occurrence}`, inApp: true, pushRequested: false }], skipDuplicates: true })
}

export async function initializeOrMergeChecklist(db: Prisma.TransactionClient, record: any, merge: boolean) {
  if (record.checklistInitializedAt && !merge) throw new ChecklistError('Checklist already initialized', 409)
  if (!record.checklistInitializedAt && merge) throw new ChecklistError('Initialize checklist first')
  if (record.serviceId) await db.$queryRaw(Prisma.sql`SELECT id FROM "Service" WHERE id = ${record.serviceId} AND "organizationId" = ${record.organizationId} FOR SHARE`)
  const template = await effectiveDocumentTemplate(db, record.organizationId, record.serviceId)
  const items = await db.caseChecklistItem.findMany({ where: { caseId: record.id } })
  const activeTemplate = template.items.filter(item => item.active)
  const keys = new Set(activeTemplate.map(item => item.nameKey))
  // Manual documents remain Case-only; old service items are retained with a marker.
  if (merge) await db.caseChecklistItem.updateMany({ where: { caseId: record.id, nameKey: { notIn: Array.from(keys) } }, data: { outsideTemplate: true, version: { increment: 1 } } })
  const legacy = !merge ? await db.task.findMany({ where: { organizationId: record.organizationId, description: { contains: record.id } }, orderBy: { createdAt: 'asc' }, select: { title: true, status: true, description: true } }) : []
  const submitted = new Map<string, Date | null>()
  const legacyDocuments = new Map<string, { name: string; note: string | null }>()
  for (const task of legacy) {
    let metadata: any; try { metadata = JSON.parse(task.description || '{}') } catch { continue }
    const meta = metadata.mosDocument
    if (meta?.caseId !== record.id) continue
    const nameKey = documentNameKey(task.title.replace(/^MOS:\s*/, ''))
    if (!nameKey) continue
    legacyDocuments.set(nameKey, { name: task.title.replace(/^MOS:\s*/, ''), note: typeof metadata.reminderNote === 'string' ? metadata.reminderNote : legacyDocuments.get(nameKey)?.note || null })
    if (!(meta.sentAt || task.status === 'done')) continue
    // dueDate is a reminder deadline, not evidence of an actual MOS submission.
    const parsed = meta.sentAt ? new Date(meta.sentAt) : null
    const date = parsed && Number.isFinite(parsed.getTime()) ? parsed : null
    const previous = submitted.get(nameKey)
    if (!submitted.has(nameKey) || date && (!previous || date > previous)) submitted.set(nameKey, date)
  }
  for (const item of activeTemplate) {
    const existing = items.find(old => old.nameKey === item.nameKey)
    if (existing) {
      await db.caseChecklistItem.update({ where: { id: existing.id }, data: { templateId: item.id || null, required: item.required, forMos: item.forMos || existing.status === 'SUBMITTED_TO_MOS', outsideTemplate: false, sortOrder: item.sortOrder, version: { increment: 1 } } })
    } else {
      const wasSubmitted = !merge && submitted.has(item.nameKey)
      await db.caseChecklistItem.create({ data: { caseId: record.id, templateId: item.id || null, name: item.name, nameKey: item.nameKey,
        required: item.required, forMos: item.forMos || legacyDocuments.has(item.nameKey), sortOrder: item.sortOrder, note: legacyDocuments.get(item.nameKey)?.note || null,
        ...(wasSubmitted ? { status: 'SUBMITTED_TO_MOS', mosSubmittedAt: submitted.get(item.nameKey), receivedAt: submitted.get(item.nameKey) } : {}) } })
    }
  }
  // Preserve manual pending/submitted names no longer present in settings, plus notes.
  // Legacy reminders remain untouched; missing submission dates stay unknown.
  if (!merge) for (const [nameKey, legacyItem] of Array.from(legacyDocuments)) if (!keys.has(nameKey)) {
    const date = submitted.get(nameKey) || null
    await db.caseChecklistItem.create({ data: { caseId: record.id, name: legacyItem.name, nameKey, required: false, forMos: true, status: submitted.has(nameKey) ? 'SUBMITTED_TO_MOS' : 'NEEDED', receivedAt: date, mosSubmittedAt: date, note: legacyItem.note, outsideTemplate: true, sortOrder: activeTemplate.length } })
  }
  await db.$executeRaw(Prisma.sql`UPDATE "Case" SET "checklistInitializedAt" = COALESCE("checklistInitializedAt", NOW()), "checklistServiceId" = ${record.serviceId} WHERE id = ${record.id}`)
  await updateChecklistReadiness(db, record.id, !merge)
}
