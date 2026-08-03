import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

async function recalcTotalPaid(caseId: string) {
  const allPayments = await prisma.payment.aggregate({
    where: { caseId },
    _sum: { amount: true },
  })
  await prisma.case.update({
    where: { id: caseId },
    data: { totalPaid: allPayments._sum.amount || 0 },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const amount = parseFloat(body.amount)
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const payment = await prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      amount,
      note: body.note || null,
      specialMethod: body.specialMethod === true,
      date: body.date ? new Date(body.date) : new Date(),
    },
  })

  await recalcTotalPaid(params.id)
  return NextResponse.json(payment)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.payment.delete({ where: { id: params.paymentId } })
  await recalcTotalPaid(params.id)
  return NextResponse.json({ success: true })
}
