// src/app/api/cases/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const cases = await prisma.case.findMany({
      include: { client: true, assignedTo: true, service: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(cases)
  } catch (e: any) {
    const cases = await prisma.case.findMany({
      include: { client: true, assignedTo: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(cases)
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()

    const caseNumber = body.caseNumber?.trim() || null

    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        clientId: body.clientId,
        status: body.status || 'Новый',
        stayPurpose: body.stayPurpose || null,
        stayType: body.stayType || null,
        contractType: body.contractType || null,
        totalValue: parseFloat(body.totalValue) || 0,
        assignedToId: body.assignedToId ? parseInt(body.assignedToId) : null,
        serviceId: body.serviceId ? parseInt(body.serviceId) : null,
        notes: body.notes || null,
      }
    })
    await prisma.statusHistory.create({
      data: { caseId: newCase.id, toStatus: newCase.status, changedBy: user.name as string || 'System' }
    })
    return NextResponse.json(newCase)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
