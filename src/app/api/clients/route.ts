// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'
import { caseWhereForScope, clientWhereForScope, getDataAccessScope, taskWhereForScope } from '@/lib/apiScope'

function dateOrNull(value: any) {
  return value ? new Date(value) : null
}

async function updateClientMosFields(clientId: string, organizationId: string, body: any) {
  try {
    await prisma.$executeRaw`
      UPDATE "Client"
      SET
        "gender" = ${body.gender || null},
        "previousPolandEntryDate" = ${dateOrNull(body.previousPolandEntryDate)},
        "previousPolandExitDate" = ${dateOrNull(body.previousPolandExitDate)},
        "previousPolandBasis" = ${body.previousPolandBasis || null}
      WHERE "id" = ${clientId} AND "organizationId" = ${organizationId}
    `
  } catch (error) {
    console.error('Client MOS fields save error:', error)
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = getOrganizationId(user)
    const scope = await getDataAccessScope(user, organizationId)

    // Загружаем клиентов — сначала без связей
    const clients = await prisma.client.findMany({
      where: clientWhereForScope(scope, organizationId),
      include: { phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    })

    // Загружаем дела отдельно
    let casesMap: Record<string, any[]> = {}
    try {
      const allCases = await prisma.case.findMany({
        where: caseWhereForScope(scope, organizationId),
        select: {
          id: true, caseNumber: true, status: true,
          totalValue: true, totalPaid: true, createdAt: true,
          clientId: true, serviceId: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      // Загружаем сервисы отдельно
      const [services, statuses] = await Promise.all([
        prisma.service.findMany({ where: { organizationId } }),
        prisma.caseStatus.findMany({ where: { organizationId }, select: { name: true, color: true } }),
      ])
      const serviceMap: Record<number, any> = {}
      services.forEach(s => { serviceMap[s.id] = s })
      const statusColorMap = new Map(statuses.map(s => [s.name, s.color]))

      allCases.forEach(c => {
        if (!casesMap[c.clientId]) casesMap[c.clientId] = []
        casesMap[c.clientId].push({
          ...c,
          service: c.serviceId ? (serviceMap[c.serviceId] || null) : null,
          statusColor: statusColorMap.get(c.status) || null,
        })
      })
    } catch (e) {
      console.error('Cases load error:', e)
    }

    // Загружаем задачи отдельно
    let tasks: any[] = []
    try {
      tasks = await prisma.task.findMany({
        where: taskWhereForScope(scope, organizationId, { status: { not: 'done' } }),
        orderBy: { dueDate: 'asc' },
      })
    } catch (e) {
      console.error('Tasks load error:', e)
    }

    const result = clients.map(client => {
      const clientCases = casesMap[client.id] || []
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase()
      const clientTask = tasks.find(t => t.clientName?.toLowerCase() === fullName)
      const services = clientCases
        .map((c: any) => c.service)
        .filter(Boolean)
        .filter((s: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === i)

      return {
        ...client,
        phones: phonesWithLegacy(client),
        cases: clientCases,
        activeCase: clientCases.find((c: any) => ['В работе', 'Ожидание документов', 'Новый'].includes(c.status)) || clientCases[0] || null,
        upcomingTask: clientTask || null,
        services,
      }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Clients API error:', e)
    // Возвращаем ошибку вместо пустого массива чтобы видеть проблему
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = getOrganizationId(user)
    const scope = await getDataAccessScope(user, organizationId)
    const body = await request.json()
    const phones = normalizePhones(body.phones, body.phone)
    const mainPhone = primaryPhone(phones, body.phone)
    const client = await prisma.client.create({
      data: {
        organizationId,
        assignedToId: scope.restricted && scope.userId ? scope.userId : body.assignedToId ? Number(body.assignedToId) : null,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: mainPhone,
        email: body.email || null,
        city: body.city || null,
        pesel: body.pesel || null,
        passportSeries: body.passportSeries || null,
        passportNumber: body.passportNumber || null,
        passportIssuedBy: body.passportIssuedBy || null,
        passportIssuedAt: body.passportIssuedAt ? new Date(body.passportIssuedAt) : null,
        passportExpiresAt: body.passportExpiresAt ? new Date(body.passportExpiresAt) : null,
        addressInPoland: body.addressInPoland || null,
        stayBasis: body.stayBasis || null,
        motherMaidenName: body.motherMaidenName || null,
        dependents: body.dependents || null,
        profession: body.profession || null,
        height: body.height || null,
        eyeColor: body.eyeColor || null,
        specialSigns: body.specialSigns || null,
        phones: phones.length ? { create: phones.map(phone => ({ organizationId, ...phone })) } : undefined,
      }
    })
    await updateClientMosFields(client.id, organizationId, body)
    return NextResponse.json(client)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
