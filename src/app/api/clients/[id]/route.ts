// src/app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { deleteCloudinaryResources } from '@/lib/cloudinary'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'

function isOrganizationAdmin(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function getFamilyLinksForClient(clientId: string, organizationId: string) {
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
    where: { id: { in: relativeIds }, organizationId },
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
  try {
    const client = await (prisma as any).client.findFirst({
      where: { id: params.id, organizationId },
      include: {
        cases: { include: { service: true }, orderBy: { createdAt: 'desc' } },
        travelHistory: { orderBy: { entryDate: 'desc' } },
        phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        familyLinks: {
          include: {
            relativeClient: {
              select: { id: true, firstName: true, lastName: true, phone: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      }
    })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const familyLinks = await getFamilyLinksForClient(params.id, organizationId)
    return NextResponse.json({ ...client, phones: phonesWithLegacy(client), familyLinks })
  } catch (e) {
    // fallback
    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId },
      include: { cases: { orderBy: { createdAt: 'desc' } } }
    })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...client, phones: phonesWithLegacy(client), travelHistory: [] })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const existingClient = await prisma.client.findFirst({ where: { id: params.id, organizationId } })
    if (!existingClient) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const shouldUpdatePhones = Array.isArray(body.phones)
    const phones = shouldUpdatePhones ? normalizePhones(body.phones, body.phone) : []
    const mainPhone = shouldUpdatePhones ? primaryPhone(phones, body.phone) : (body.phone || null)

    const shouldUpdateFamily = Array.isArray(body.familyClientIds)
    const familyClientIds = shouldUpdateFamily
      ? Array.from(new Set<string>(body.familyClientIds.map((value: any) => String(value)).filter((value: string) => value && value !== params.id)))
      : []
    const validFamilyClients = familyClientIds.length > 0
      ? await prisma.client.findMany({ where: { id: { in: familyClientIds }, organizationId }, select: { id: true } })
      : []
    const validFamilyIds = validFamilyClients.map(item => item.id)

    const client = await prisma.$transaction(async tx => {
      const updated = await (tx as any).client.update({
        where: { id: params.id },
        data: {
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
      })

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

      return shouldUpdatePhones
        ? await (tx as any).client.findUnique({
            where: { id: params.id },
            include: { phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
          })
        : updated
    })
    // Если указана дата окончания паспорта — создаём задачу в календаре
    if (body.passportExpiresAt) {
      try {
        const clientName = `${body.firstName} ${body.lastName}`
        const taskTitle = `Окончание паспорта: ${clientName}`
        // Проверяем не существует ли уже такая задача
        const existingTask = await (prisma as any).task.findFirst({
          where: {
            organizationId,
            title: taskTitle,
            clientName: clientName,
          }
        })
        if (!existingTask) {
          await (prisma as any).task.create({
            data: {
              organizationId,
              title: taskTitle,
              priority: 'Срочно',
              status: 'todo',
              dueDate: new Date(body.passportExpiresAt),
              clientName: clientName,
              description: JSON.stringify({
                reminderAt: new Date(new Date(body.passportExpiresAt).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                reminderNote: `Паспорт клиента ${clientName} истекает через 90 дней`
              })
            }
          })
        } else {
          // Обновляем дату если задача уже есть
          await (prisma as any).task.update({
            where: { id: existingTask.id },
            data: {
              dueDate: new Date(body.passportExpiresAt),
              description: JSON.stringify({
                reminderAt: new Date(new Date(body.passportExpiresAt).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                reminderNote: `Паспорт клиента ${clientName} истекает через 90 дней`
              })
            }
          })
        }
      } catch (e) { console.error('Calendar task error:', e) }
    }

    return NextResponse.json({ ...client, phones: phonesWithLegacy(client) })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
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
        select: { publicId: true },
      })
      deletedCloudinaryFiles = await deleteCloudinaryResources(caseDocuments.map((doc: any) => doc.publicId))

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
