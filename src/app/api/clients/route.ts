// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Загружаем клиентов — сначала без связей
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Загружаем дела отдельно
    let casesMap: Record<string, any[]> = {}
    try {
      const allCases = await prisma.case.findMany({
        select: {
          id: true, caseNumber: true, status: true,
          totalValue: true, totalPaid: true, createdAt: true,
          clientId: true, serviceId: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      // Загружаем сервисы отдельно
      const services = await prisma.service.findMany()
      const serviceMap: Record<number, any> = {}
      services.forEach(s => { serviceMap[s.id] = s })

      allCases.forEach(c => {
        if (!casesMap[c.clientId]) casesMap[c.clientId] = []
        casesMap[c.clientId].push({
          ...c,
          service: c.serviceId ? (serviceMap[c.serviceId] || null) : null,
        })
      })
    } catch (e) {
      console.error('Cases load error:', e)
    }

    // Загружаем задачи отдельно
    let tasks: any[] = []
    try {
      tasks = await prisma.task.findMany({
        where: { status: { not: 'done' } },
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
    const body = await request.json()
    const client = await prisma.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone || null,
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
        height: body.height || null,
        eyeColor: body.eyeColor || null,
        specialSigns: body.specialSigns || null,
      }
    })
    return NextResponse.json(client)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
