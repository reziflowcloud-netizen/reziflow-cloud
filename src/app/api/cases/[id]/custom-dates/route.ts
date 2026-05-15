import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, {
    id: true,
    caseNumber: true,
    client: { select: { firstName: true, lastName: true } },
  })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const caseRecord: any = scopedCase
  const body = await req.json()
  try {
    const d = await (prisma as any).caseCustomDate.create({
      data: { caseId: params.id, label: body.label, date: new Date(body.date) }
    })
    const dateOnly = new Date(d.date).toISOString().slice(0, 10)
    const clientName = `${caseRecord.client?.firstName || ''} ${caseRecord.client?.lastName || ''}`.trim()
    await prisma.task.create({
      data: {
        organizationId,
        title: d.label,
        priority: 'Нормально',
        dueDate: d.date,
        clientName: clientName || null,
        description: JSON.stringify({
          reminderAt: `${dateOnly}T09:00`,
          reminderNote: `${d.label} по делу ${caseRecord.caseNumber || 'без номера'}`,
          caseImportantDate: {
            caseId: params.id,
            caseNumber: caseRecord.caseNumber || null,
            kind: 'customDate',
            customDateId: d.id,
          },
        }),
      },
    })
    return NextResponse.json(d)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
