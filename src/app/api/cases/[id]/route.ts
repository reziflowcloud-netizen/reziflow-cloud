// src/app/api/cases/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { deleteCloudinaryResources } from '@/lib/cloudinary'
import { deleteDropboxFile, getDropboxSettings } from '@/lib/dropbox'

function taskBelongsToCase(
  task: { title: string | null; description: string | null },
  caseId: string,
  caseNumber: string | null
) {
  let meta: any = {}

  try {
    meta = JSON.parse(task.description || '{}')
  } catch {
    meta = {}
  }

  const refs = [
    meta.paymentPlan,
    meta.mosDocument,
    meta.autoReminder,
    meta.customCaseReminder,
    meta.quickCaseTask,
    meta.fingerprintsAppointment,
    meta.predictedDecision,
  ]

  if (refs.some((ref: any) => ref?.caseId === caseId)) return true

  if (!caseNumber) return false
  return String(task.title || '').includes(caseNumber) || String(task.description || '').includes(caseNumber)
}

function isOrganizationAdmin(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function isArchiveStatus(status?: string | null) {
  const value = String(status || '').trim().toLowerCase()
  return value.includes('архив') || value.includes('archive') || value.includes('archiw') || status === 'Архив'
}

function serializeCaseDocument(doc: any) {
  if (doc?.storageProvider === 'dropbox' && !doc.url) return { ...doc, url: `/api/documents/${doc.id}/file` }
  return doc
}

function clientNameFromCase(caseRecord: any) {
  return `${caseRecord?.client?.firstName || ''} ${caseRecord?.client?.lastName || ''}`.trim()
}

async function syncCaseImportantDateTask(args: {
  organizationId: string
  caseRecord: any
  kind: string
  title: string
  date?: string | Date | null
}) {
  const existing = await prisma.task.findFirst({
    where: {
      organizationId: args.organizationId,
      AND: [
        { description: { contains: `"caseId":"${args.caseRecord.id}"` } },
        { description: { contains: `"kind":"${args.kind}"` } },
      ],
    },
  })
  const meta = existing ? (() => {
    try { return JSON.parse(existing.description || '{}') } catch { return {} }
  })() : {}

  if (!args.date) {
    if (existing) await prisma.task.delete({ where: { id: existing.id } })
    return
  }

  const dueDate = new Date(args.date)
  if (Number.isNaN(dueDate.getTime())) return
  const dateOnly = dueDate.toISOString().slice(0, 10)
  const caseLabel = args.caseRecord.caseNumber || 'без номера'
  const data = {
    organizationId: args.organizationId,
    title: args.title,
    priority: existing?.priority || 'Нормально',
    dueDate,
    clientName: clientNameFromCase(args.caseRecord) || null,
    status: existing?.status || 'todo',
    description: JSON.stringify({
      reminderAt: `${dateOnly}T09:00`,
      reminderNote: `${args.title} по делу ${caseLabel}`,
      caseImportantDate: { caseId: args.caseRecord.id, caseNumber: args.caseRecord.caseNumber || null, kind: args.kind },
    }),
  }

  if (existing) await prisma.task.update({ where: { id: existing.id }, data })
  else await prisma.task.create({ data })
}

async function syncFixedImportantDateTasks(organizationId: string, caseRecord: any) {
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'filingDate',
    title: 'Дата подачи',
    date: caseRecord.filingDate,
  })
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'personalAppearDate',
    title: 'Личная явка',
    date: caseRecord.personalAppearDate,
  })
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'legalStayDeadline',
    title: 'Срок легального пребывания',
    date: caseRecord.legalStayDeadline,
  })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const c = await (prisma as any).case.findFirst({
      where: { id: params.id, organizationId },
      include: {
        client: true, service: true,
        payments: { orderBy: { date: 'desc' } },
        comments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        customDates: { orderBy: { date: 'asc' } },
        docUpdates: { orderBy: { date: 'desc' } },
        caseDocuments: { orderBy: { createdAt: 'desc' } },
        employee: true,
      }
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...c,
      caseDocuments: Array.isArray(c.caseDocuments) ? c.caseDocuments.map(serializeCaseDocument) : [],
    })
  } catch (e: any) {
    const c = await prisma.case.findFirst({
      where: { id: params.id, organizationId },
      include: {
        client: true, service: true,
        payments: { orderBy: { date: 'desc' } },
        comments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
      }
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...c, customDates: [], docUpdates: [], caseDocuments: [] })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  try {
    const body = await request.json()
    const existing = await prisma.case.findFirst({ where: { id: params.id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Базовые поля — всегда существуют
    const baseData: any = {
      caseNumber: body.caseNumber?.trim() || null,
      status: body.status,
      stayPurpose: body.stayPurpose || null,
      stayType: body.stayType || null,
      contractType: body.contractType || null,
      contractDate: body.contractDate ? new Date(body.contractDate) : null,
      contractNumber: body.contractNumber || null,
      contractSigned: body.contractSigned ?? false,
      totalValue: parseFloat(body.totalValue) || 0,
      mosNumber: body.mosNumber || null,
      mosSentAt: body.mosSentAt ? new Date(body.mosSentAt) : null,
      mosSentByPost: body.mosSentByPost ?? false,
      predictedDecisionDate: body.predictedDecisionDate ? new Date(body.predictedDecisionDate) : null,
      fingerprintsDate: body.fingerprintsDate ? new Date(body.fingerprintsDate) : null,
      cabinetLogin: body.cabinetLogin || null,
      cabinetPassword: body.cabinetPassword || null,
      filingDate: body.filingDate ? new Date(body.filingDate) : null,
      personalAppearDate: body.personalAppearDate ? new Date(body.personalAppearDate) : null,
      legalStayDeadline: body.legalStayDeadline ? new Date(body.legalStayDeadline) : null,
      notes: body.notes || null,
      serviceId: body.serviceId ? parseInt(body.serviceId) : null,
    }

    // Дополнительные поля (появились после миграции 20260105)
    const extraData: any = {
      trustee: body.trustee || null,
      employeeId: body.employeeId ? parseInt(body.employeeId) : null,
      workContractType: body.workContractType || null,
      workContractNumber: body.workContractNumber || null,
      workContractDate: body.workContractDate ? new Date(body.workContractDate) : null,
      workContractSigned: body.workContractSigned ?? false,
      staySubPurpose: body.staySubPurpose || null,
    }

    let updated: any
    try {
      // Сначала пробуем сохранить со всеми полями
      updated = await (prisma as any).case.update({
        where: { id: params.id },
        data: { ...baseData, ...extraData }
      })
    } catch (e) {
      // Если новые поля недоступны (миграция не применилась) — сохраняем только базовые
      console.warn('Extra fields not available, saving base fields only:', (e as any).message)
      updated = await prisma.case.update({
        where: { id: params.id },
        data: baseData
      })
    }

    // История статусов
    if (body.status && existing.status !== body.status) {
      await prisma.statusHistory.create({
        data: {
          caseId: params.id,
          fromStatus: existing.status,
          toStatus: body.status,
          changedBy: (user as any).name || 'User'
        }
      })
    }

    const caseForCalendar = await prisma.case.findFirst({
      where: { id: params.id, organizationId },
      include: { client: true },
    })
    if (caseForCalendar) await syncFixedImportantDateTasks(organizationId, caseForCalendar)

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH case error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  if (!isOrganizationAdmin(user)) {
    return NextResponse.json({ error: 'Only organization admin can delete cases' }, { status: 403 })
  }

  const existing = await prisma.case.findFirst({
    where: { id: params.id, organizationId },
    select: { id: true, caseNumber: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isArchiveStatus(existing.status)) {
    return NextResponse.json({ error: 'Case must be archived before deletion' }, { status: 409 })
  }

  const documents = await (prisma as any).caseDocument.findMany({
    where: { caseId: params.id },
    select: {
      publicId: true,
      storageProvider: true,
      storageId: true,
      storagePath: true,
      dropboxStorageId: true,
      dropboxPath: true,
      case: { select: { organization: { select: { settings: true } } } },
    },
  })

  const tasks = await prisma.task.findMany({
    where: { organizationId },
    select: { id: true, title: true, description: true },
  })
  const taskIds = tasks
    .filter(task => taskBelongsToCase(task, existing.id, existing.caseNumber))
    .map(task => task.id)

  const cloudinaryPublicIds = documents
    .filter((doc: any) => doc.publicId && doc.storageProvider !== 'dropbox' && !String(doc.publicId).startsWith('local:'))
    .map((doc: any) => doc.publicId)
  const deletedCloudinaryFiles = await deleteCloudinaryResources(cloudinaryPublicIds)

  for (const doc of documents as any[]) {
    const dropboxPathOrId = doc.dropboxStorageId || doc.dropboxPath || doc.storageId || doc.storagePath || (doc.storageProvider === 'dropbox' ? doc.publicId : null)
    if (!dropboxPathOrId) continue
    const dropbox = getDropboxSettings(doc.case?.organization?.settings)
    if (!dropbox.accessToken) continue
    try { await deleteDropboxFile(dropbox.accessToken, dropboxPathOrId) } catch (error) { console.error('Dropbox delete error:', error) }
  }

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { id: { in: taskIds } } }),
    prisma.case.delete({ where: { id: params.id } }),
  ])

  return NextResponse.json({ success: true, deletedTasks: taskIds.length, deletedCloudinaryFiles })
}
