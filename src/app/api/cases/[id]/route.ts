// src/app/api/cases/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { deleteCloudinaryResources } from '@/lib/cloudinary'
import { deleteDropboxFile, getDropboxSettings } from '@/lib/dropbox'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { resolveUserIdForEmployee } from '@/lib/employeeSync'
import { shouldRetirePersonalAppearTask } from '@/lib/caseImportantDateTasks'

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
    meta.caseImportantDate,
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
  time?: string | null
  location?: string | null
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
  const reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(args.time || '')) ? args.time : '09:00'
  const caseLabel = args.caseRecord.caseNumber || 'без номера'
  const reminderDetails = [
    `${args.title} по делу ${caseLabel}`,
    args.time ? `Время: ${args.time}` : '',
    args.location ? `Место: ${args.location}` : '',
  ].filter(Boolean).join(' · ')
  const data = {
    organizationId: args.organizationId,
    title: args.title,
    priority: existing?.priority || 'Нормально',
    dueDate,
    clientName: clientNameFromCase(args.caseRecord) || null,
    assignedToId: args.caseRecord.assignedToId || null,
    status: existing?.status || 'todo',
    description: JSON.stringify({
      reminderAt: `${dateOnly}T${reminderTime}`,
      reminderNote: reminderDetails,
      caseImportantDate: {
        caseId: args.caseRecord.id,
        caseNumber: args.caseRecord.caseNumber || null,
        kind: args.kind,
        location: args.location || null,
      },
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
    date: null,
  })
  const personalAppearDate = shouldRetirePersonalAppearTask(
    caseRecord.personalAppearDate,
    caseRecord.statusHistory || []
  )
    ? null
    : caseRecord.personalAppearDate
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'personalAppearDate',
    title: 'Личная явка',
    date: personalAppearDate,
    location: caseRecord.personalAppearLocation,
  })
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'cardPickupDate',
    title: caseRecord.cardPickupTime ? `Отбор карты — ${caseRecord.cardPickupTime}` : 'Отбор карты',
    date: caseRecord.cardPickupDate,
    time: caseRecord.cardPickupTime,
    location: caseRecord.cardPickupLocation,
  })
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'legalStayDeadline',
    title: 'Срок легального пребывания',
    date: caseRecord.legalStayDeadline,
  })
  await syncCaseImportantDateTask({
    organizationId,
    caseRecord,
    kind: 'workContractEndDate',
    title: 'Дата окончания договора',
    date: caseRecord.workContractEndDate,
  })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  try {
    const c = await (prisma as any).case.findFirst({
      where: caseWhereForScope(scope, organizationId, { id: params.id }),
      include: {
        client: true, service: true,
        assignedTo: { select: { id: true, name: true, email: true } },
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
      where: caseWhereForScope(scope, organizationId, { id: params.id }),
      include: {
        client: true, service: true,
        assignedTo: { select: { id: true, name: true, email: true } },
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
  const scope = await getDataAccessScope(user, organizationId)

  try {
    const body = await request.json()
    const existing = await prisma.case.findFirst({ where: caseWhereForScope(scope, organizationId, { id: params.id }) })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Базовые поля — всегда существуют
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)
    const nullableText = (key: string) => String(body[key] || '').trim() || null
    const nullableDate = (key: string) => body[key] ? new Date(body[key]) : null

    const baseData: any = {}
    if (has('caseNumber')) baseData.caseNumber = nullableText('caseNumber')
    if (has('status')) baseData.status = body.status
    if (has('stayPurpose')) baseData.stayPurpose = body.stayPurpose || null
    if (has('stayType')) baseData.stayType = body.stayType || null
    if (has('contractType')) baseData.contractType = body.contractType || null
    if (has('contractDate')) baseData.contractDate = nullableDate('contractDate')
    if (has('contractNumber')) baseData.contractNumber = body.contractNumber || null
    if (has('contractSigned')) baseData.contractSigned = body.contractSigned ?? false
    if (has('totalValue')) baseData.totalValue = parseFloat(body.totalValue) || 0
    if (has('mosNumber')) baseData.mosNumber = body.mosNumber || null
    if (has('mosSentAt')) baseData.mosSentAt = nullableDate('mosSentAt')
    if (has('mosSentByPost')) baseData.mosSentByPost = body.mosSentByPost ?? false
    if (has('predictedDecisionDate')) baseData.predictedDecisionDate = nullableDate('predictedDecisionDate')
    if (has('fingerprintsDate')) baseData.fingerprintsDate = nullableDate('fingerprintsDate')
    if (has('cabinetLogin')) baseData.cabinetLogin = body.cabinetLogin || null
    if (has('cabinetPassword')) baseData.cabinetPassword = body.cabinetPassword || null
    if (has('mosEmail')) baseData.mosEmail = nullableText('mosEmail')
    if (has('filingDate')) baseData.filingDate = nullableDate('filingDate')
    if (has('personalAppearDate')) baseData.personalAppearDate = nullableDate('personalAppearDate')
    if (has('personalAppearLocation')) baseData.personalAppearLocation = nullableText('personalAppearLocation')
    if (has('cardPickupDate')) baseData.cardPickupDate = nullableDate('cardPickupDate')
    if (has('cardPickupTime')) {
      const cardPickupTime = nullableText('cardPickupTime')
      if (cardPickupTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cardPickupTime)) {
        return NextResponse.json({ error: 'Invalid card pickup time' }, { status: 400 })
      }
      baseData.cardPickupTime = cardPickupTime
    }
    if (has('cardPickupLocation')) baseData.cardPickupLocation = nullableText('cardPickupLocation')
    if (has('legalStayDeadline')) baseData.legalStayDeadline = nullableDate('legalStayDeadline')
    if (has('notes')) baseData.notes = body.notes || null
    if (has('serviceId')) baseData.serviceId = body.serviceId ? parseInt(body.serviceId) : null

    // Дополнительные поля (появились после миграции 20260105)
    const employeeId = has('employeeId') && body.employeeId ? parseInt(body.employeeId) : null
    if (scope.restricted && scope.userId) {
      baseData.assignedToId = scope.userId
    } else if (has('employeeId')) {
      baseData.assignedToId = employeeId
        ? await resolveUserIdForEmployee(organizationId, employeeId)
        : null
    }

    const caseDetailsData: any = {}
    if (has('trustee')) caseDetailsData.trustee = body.trustee || null
    if (has('employeeId')) caseDetailsData.employeeId = employeeId
    if (has('workContractType')) caseDetailsData.workContractType = body.workContractType || null
    if (has('workContractNumber')) caseDetailsData.workContractNumber = body.workContractNumber || null
    if (has('workContractDate')) caseDetailsData.workContractDate = nullableDate('workContractDate')
    if (has('workContractSigned')) caseDetailsData.workContractSigned = body.workContractSigned ?? false
    if (has('staySubPurpose')) caseDetailsData.staySubPurpose = body.staySubPurpose || null
    if (has('workContractEndDate')) caseDetailsData.workContractEndDate = nullableDate('workContractEndDate')

    const updated = await (prisma as any).case.update({
      where: { id: params.id },
      data: { ...baseData, ...caseDetailsData }
    })

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
      where: caseWhereForScope(scope, organizationId, { id: params.id }),
      include: {
        client: true,
        statusHistory: {
          where: { fromStatus: { not: null } },
          select: { fromStatus: true, changedAt: true },
        },
      },
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
