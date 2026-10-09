// src/app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { entityWrite, entityWriteError, EntityWriteError, writeEntityCustomFields } from '@/lib/entityWrite'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { deleteCloudinaryDocumentResources } from '@/lib/cloudinary'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'
import { DataAccessScope, caseWhereForScope, clientWhereForScope, getDataAccessScope } from '@/lib/apiScope'

function isOrganizationAdmin(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function dateOrNull(value: any) {
  return value ? new Date(value) : null
}

function isRentalLegalTitle(value: unknown) {
  const title = String(value || '').trim().toLowerCase()
  return title.includes('najem') || title.includes('wynajem')
}

async function syncRentalEndTask(tx: any, organizationId: string, client: any) {
  const existingTasks = await tx.task.findMany({
    where: {
      organizationId,
      AND: [
        { description: { contains: '"clientRentalEnd"' } },
        { description: { contains: `"clientId":"${client.id}"` } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!isRentalLegalTitle(client.legalTitle) || !client.rentalEndDate) {
    if (existingTasks.length > 0) {
      await tx.task.deleteMany({ where: { id: { in: existingTasks.map((task: any) => task.id) } } })
    }
    return
  }

  const rentalEndDate = new Date(client.rentalEndDate)
  if (Number.isNaN(rentalEndDate.getTime())) return
  const dateOnly = rentalEndDate.toISOString().slice(0, 10)
  const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim()
  const existing = existingTasks[0]
  const data = {
    organizationId,
    title: 'Конец аренды жилья',
    priority: existing?.priority || 'Нормально',
    status: existing?.status || 'todo',
    dueDate: rentalEndDate,
    clientName: clientName || null,
    assignedToId: client.assignedToId || null,
    description: JSON.stringify({
      reminderAt: `${dateOnly}T09:00`,
      reminderNote: clientName ? `Конец аренды жилья клиента ${clientName}` : 'Конец аренды жилья',
      clientRentalEnd: { clientId: client.id },
    }),
  }

  if (existing) await tx.task.update({ where: { id: existing.id }, data })
  else await tx.task.create({ data })

  if (existingTasks.length > 1) {
    await tx.task.deleteMany({ where: { id: { in: existingTasks.slice(1).map((task: any) => task.id) } } })
  }
}

function normalizePreviousPolandStays(value: any) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => ({
      entryDate: dateOrNull(item?.entryDate),
      exitDate: dateOrNull(item?.exitDate),
      basis: String(item?.basis || '').trim() || null,
      order: index,
    }))
    .filter(item => item.entryDate || item.exitDate || item.basis)
}

async function getFamilyLinksForClient(clientId: string, organizationId: string, scope?: DataAccessScope) {
  const links = await (prisma as any).clientFamilyLink.findMany({
    where: { organizationId },
    select: { clientId: true, relativeClientId: true },
  })
  const familyIds = new Set<string>([clientId])
  let changed = true

  while (changed) {
    changed = false
    for (const link of links) {
      const hasClient = familyIds.has(link.clientId)
      const hasRelative = familyIds.has(link.relativeClientId)
      if (hasClient && !hasRelative) {
        familyIds.add(link.relativeClientId)
        changed = true
      }
      if (hasRelative && !hasClient) {
        familyIds.add(link.clientId)
        changed = true
      }
    }
  }

  const relativeIds = Array.from(familyIds).filter(id => id !== clientId)
  if (relativeIds.length === 0) return []

  const relatives = await prisma.client.findMany({
    where: scope ? clientWhereForScope(scope, organizationId, { id: { in: relativeIds } }) : { id: { in: relativeIds }, organizationId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return relatives.map(relativeClient => ({
    relativeClientId: relativeClient.id,
    relativeClient,
  }))
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  // Keep the autosave version and managed custom values in one read snapshot.
  // A batch transaction has no interactive callback lifetime; family graph reads
  // below run only after its connection has been released.
  const customFieldsQuery = () => prisma.customField.findMany({
    where: { active: true, section: { organizationId, scope: 'client', active: true } },
    select: { id: true, values: { where: { organizationId, recordType: 'client', recordId: params.id }, take: 1 } },
  })
  let client: any
  let fields: Awaited<ReturnType<typeof customFieldsQuery>>
  let fullDetail = true
  try {
    ;[client, fields] = await prisma.$transaction([prisma.client.findFirst({
      where: clientWhereForScope(scope, organizationId, { id: params.id }),
      include: {
        cases: { where: caseWhereForScope(scope, organizationId), include: { service: true }, orderBy: { createdAt: 'desc' } },
        travelHistory: { orderBy: { entryDate: 'desc' } },
        previousPolandStays: { orderBy: { order: 'asc' } },
        phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      }
    }), customFieldsQuery()], { isolationLevel: 'RepeatableRead' })
  } catch (e) {
    // Preserve the existing reduced-detail fallback, using a fresh batch rather
    // than trying another query on an aborted/expired interactive transaction.
    fullDetail = false
    ;[client, fields] = await prisma.$transaction([prisma.client.findFirst({
      where: clientWhereForScope(scope, organizationId, { id: params.id }),
      include: {
        cases: { where: caseWhereForScope(scope, organizationId), orderBy: { createdAt: 'desc' } },
        previousPolandStays: { orderBy: { order: 'asc' } },
      }
    }), customFieldsQuery()], { isolationLevel: 'RepeatableRead' })
  }
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const customFieldValues = Object.fromEntries(fields.map(field => [field.id, field.values[0]?.value || '']))
  if (!fullDetail) return NextResponse.json({ ...client, phones: phonesWithLegacy(client), customFieldValues, travelHistory: [], previousPolandStays: client.previousPolandStays || [] })
  const familyLinks = await getFamilyLinksForClient(params.id, organizationId, scope)
  return NextResponse.json({ ...client, phones: phonesWithLegacy(client), customFieldValues, familyLinks })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  try {
    const body = await request.json()
    return await entityWrite(request, 'client', body, clientWhereForScope(scope, organizationId, { id: params.id }), async (tx, existingClient, claim) => {
    const shouldUpdatePhones = Array.isArray(body.phones)
    const phones = shouldUpdatePhones ? normalizePhones(body.phones, body.phone) : []
    const mainPhone = shouldUpdatePhones ? primaryPhone(phones, body.phone) : (body.phone || null)
    const shouldUpdatePreviousPolandStays = Array.isArray(body.previousPolandStays)
    const previousPolandStays = shouldUpdatePreviousPolandStays ? normalizePreviousPolandStays(body.previousPolandStays) : []

    const shouldUpdateFamily = Array.isArray(body.familyClientIds)
    const familyClientIds = shouldUpdateFamily
      ? Array.from(new Set<string>(body.familyClientIds.map((value: any) => String(value)).filter((value: string) => value && value !== params.id)))
      : []
    const validFamilyClients = familyClientIds.length > 0
      ? await tx.client.findMany({ where: clientWhereForScope(scope, organizationId, { id: { in: familyClientIds } }), select: { id: true } })
      : []
    const validFamilyIds = validFamilyClients.map((item: any) => item.id)

    if (validFamilyIds.length !== familyClientIds.length) throw new EntityWriteError(400, 'Client not found')
    const allData: any = {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: mainPhone,
        email: body.email || null,
        city: body.city || null,
        pesel: body.pesel || null,
        // New fields
        previousFirstName: body.previousFirstName || null,
        previousLastName: body.previousLastName || null,
        maidenName: body.maidenName || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        birthPlace: body.birthPlace || null,
        citizenship: body.citizenship || null,
        nationality: body.nationality || null,
        maritalStatus: body.maritalStatus || null,
        education: body.education || null,
        profession: body.profession || null,
        statusUKR: body.statusUKR || false,
        fatherName: body.fatherName || null,
        motherName: body.motherName || null,
        motherMaidenName: body.motherMaidenName || null,
        dependents: body.dependents || null,
        branch: body.branch || null,
        // Passport
        passportSeries: body.passportSeries || null,
        passportNumber: body.passportNumber || null,
        passportIssuedBy: body.passportIssuedBy || null,
        passportIssuedAt: body.passportIssuedAt ? new Date(body.passportIssuedAt) : null,
        passportExpiresAt: body.passportExpiresAt ? new Date(body.passportExpiresAt) : null,
        // Physical
        height: body.height || null,
        eyeColor: body.eyeColor || null,
        specialSigns: body.specialSigns || null,
        // Stay in Poland
        originCountryAddress: body.originCountryAddress || null,
        previousResidenceAddress: body.previousResidenceAddress || null,
        addressInPoland: body.addressInPoland || null,
        legalTitle: body.legalTitle || null,
        rentalEndDate: body.rentalEndDate ? new Date(body.rentalEndDate) : null,
        stayBasis: body.stayBasis || null,
        lastEntryDate: body.lastEntryDate ? new Date(body.lastEntryDate) : null,
        firstResidenceCard: body.firstResidenceCard || false,
        residenceCardExpiry: body.residenceCardExpiry ? new Date(body.residenceCardExpiry) : null,
        finesInPoland: body.finesInPoland || false,
        finesDescription: body.finesDescription || null,
        }
      Object.assign(allData, { gender: body.gender || null, previousPolandEntryDate: dateOrNull(body.previousPolandEntryDate), previousPolandExitDate: dateOrNull(body.previousPolandExitDate), previousPolandBasis: body.previousPolandBasis || null })
      const data: any = Object.fromEntries(Object.entries(allData).filter(([key]) => Object.prototype.hasOwnProperty.call(body, key)))
      if (shouldUpdatePhones) data.phone = mainPhone
      if (shouldUpdatePreviousPolandStays) Object.assign(data, { previousPolandEntryDate: previousPolandStays[0]?.entryDate || null, previousPolandExitDate: previousPolandStays[0]?.exitDate || null, previousPolandBasis: previousPolandStays[0]?.basis || null })
      for (const value of [...Object.values(data), ...previousPolandStays.flatMap(stay => [stay.entryDate, stay.exitDate])]) if (value instanceof Date && !Number.isFinite(value.getTime())) throw new EntityWriteError(400, 'Invalid date')
      for (const [key, value] of Object.entries(data)) {
        if (['statusUKR','firstResidenceCard','finesInPoland'].includes(key)) { if (typeof value !== 'boolean') throw new EntityWriteError(400, 'Invalid field') }
        else if (value != null && !(value instanceof Date) && typeof value !== 'string') throw new EntityWriteError(400, 'Invalid field')
      }
      const updated = await claim(data)
      await writeEntityCustomFields(tx, organizationId, 'client', params.id, body.customFieldValues)

      if (shouldUpdatePreviousPolandStays) {
        await (tx as any).previousPolandStay.deleteMany({ where: { clientId: params.id } })
        if (previousPolandStays.length) {
          await (tx as any).previousPolandStay.createMany({
            data: previousPolandStays.map(stay => ({ clientId: params.id, ...stay })),
          })
        }
      }

      if (shouldUpdatePhones) {
        await (tx as any).clientPhone.deleteMany({ where: { clientId: params.id, organizationId } })
        if (phones.length) {
          await (tx as any).clientPhone.createMany({
            data: phones.map(phone => ({ organizationId, clientId: params.id, ...phone })),
          })
        }
      }

      if (shouldUpdateFamily) {
        const existingFamilyLinks = await (tx as any).clientFamilyLink.findMany({
          where: {
            organizationId,
            OR: [{ clientId: params.id }, { relativeClientId: params.id }],
          },
          select: { clientId: true, relativeClientId: true },
        })
        const affectedFamilyIds = Array.from(new Set<string>([
          params.id,
          ...validFamilyIds,
          ...existingFamilyLinks.flatMap((link: any) => [link.clientId, link.relativeClientId]),
        ]))
        const familyGroupIds = [params.id, ...validFamilyIds]

        await (tx as any).clientFamilyLink.deleteMany({
          where: {
            organizationId,
            OR: [
              { clientId: { in: affectedFamilyIds } },
              { relativeClientId: { in: affectedFamilyIds } },
            ],
          },
        })

        if (validFamilyIds.length > 0) {
          await (tx as any).clientFamilyLink.createMany({
            data: familyGroupIds.flatMap(clientId =>
              familyGroupIds
                .filter(relativeClientId => relativeClientId !== clientId)
                .map(relativeClientId => ({ organizationId, clientId, relativeClientId }))
            ),
            skipDuplicates: true,
          })
        }
      }

      if (['legalTitle', 'rentalEndDate', 'firstName', 'lastName'].some(key => key in body)) await syncRentalEndTask(tx, organizationId, updated)
      if (['passportExpiresAt', 'firstName', 'lastName'].some(key => key in body) && updated.passportExpiresAt) {
        const name = [updated.firstName, updated.lastName].join(' ')
        const oldName = [existingClient.firstName, existingClient.lastName].join(' ')
        const prior = await tx.task.findFirst({ where: { organizationId, OR: [{ description: { contains: '"clientPassportEnd":{"clientId":"' + params.id + '"' } }, { title: 'Окончание паспорта: ' + oldName, clientName: oldName }] } })
        const taskData = { title: 'Окончание паспорта: ' + name, clientName: name, dueDate: updated.passportExpiresAt, description: JSON.stringify({ reminderAt: new Date(updated.passportExpiresAt.getTime() - 90*86400000).toISOString(), reminderNote: 'Паспорт клиента ' + name + ' истекает через 90 дней', clientPassportEnd: { clientId: params.id } }) }
        if (prior) await tx.task.update({ where: { id: prior.id }, data: taskData })
        else await tx.task.create({ data: { ...taskData, organizationId, priority: 'Срочно', status: 'todo', assignedToId: scope.restricted ? scope.userId : null } })
      }

      const client = await tx.client.findFirst({ where: { id: params.id, organizationId }, include: { phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }, previousPolandStays: { orderBy: { order: 'asc' } } } })
      return { ...client, phones: phonesWithLegacy(client) }
    })
  } catch (error) { return entityWriteError(error) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrganizationAdmin(user)) {
    return NextResponse.json({ error: 'Only organization admin can delete clients' }, { status: 403 })
  }
  const organizationId = getOrganizationId(user)
  try {
    const client = await prisma.client.findFirst({ where: { id: params.id, organizationId } })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Сначала находим все дела клиента
    const cases = await prisma.case.findMany({
      where: { clientId: params.id, organizationId },
      select: { id: true }
    })
    const caseIds = cases.map(c => c.id)

    // Удаляем все связанные данные дел
    let deletedCloudinaryFiles = 0
    if (caseIds.length > 0) {
      const caseDocuments = await (prisma as any).caseDocument.findMany({
        where: { caseId: { in: caseIds } },
        select: { publicId: true, fileType: true, storageProvider: true, storagePath: true },
      })
      deletedCloudinaryFiles = await deleteCloudinaryDocumentResources(caseDocuments)

      await prisma.payment.deleteMany({ where: { caseId: { in: caseIds } } })
      await prisma.comment.deleteMany({ where: { caseId: { in: caseIds } } })
      await prisma.statusHistory.deleteMany({ where: { caseId: { in: caseIds } } })
      await prisma.document.deleteMany({ where: { caseId: { in: caseIds } } })
      // Удаляем новые таблицы если существуют
      try {
        await (prisma as any).caseCustomDate.deleteMany({ where: { caseId: { in: caseIds } } })
        await (prisma as any).docUpdate.deleteMany({ where: { caseId: { in: caseIds } } })
        await (prisma as any).caseDocument.deleteMany({ where: { caseId: { in: caseIds } } })
      } catch (e) { /* игнорируем если таблицы не существуют */ }
      // Удаляем сами дела
      await prisma.case.deleteMany({ where: { id: { in: caseIds } } })
    }

    // Удаляем историю путешествий
    try {
      await (prisma as any).travelHistory.deleteMany({ where: { clientId: params.id } })
    } catch (e) { /* игнорируем */ }

    // Удаляем клиента
    await (prisma as any).clientFamilyLink.deleteMany({
      where: {
        organizationId,
        OR: [{ clientId: params.id }, { relativeClientId: params.id }],
      },
    })
    await prisma.client.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true, deletedCloudinaryFiles })
  } catch (e: any) {
    console.error('Delete client error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
