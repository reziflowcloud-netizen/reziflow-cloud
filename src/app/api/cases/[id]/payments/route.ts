// src/app/api/cases/[id]/payments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const amount = parseFloat(body.amount)

  const payment = await prisma.payment.create({
    data: {
      caseId: params.id,
      amount,
      note: body.note || null,
      date: body.date ? new Date(body.date) : new Date(),
    }
  })

  // Update total paid
  const allPayments = await prisma.payment.aggregate({
    where: { caseId: params.id },
    _sum: { amount: true },
  })
  await prisma.case.update({
    where: { id: params.id },
    data: { totalPaid: allPayments._sum.amount || 0 }
  })

  return NextResponse.json(payment)
}
