import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contacts = await (prisma as any).leadContactHistory.findMany({
    where: { leadId: params.id, organizationId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { contactAt: 'desc' },
  })

  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const note = String(body.note || '').trim()
  if (!note) return NextResponse.json({ error: 'Запись контакта не может быть пустой' }, { status: 400 })

  const contactAt = body.contactAt ? new Date(body.contactAt) : new Date()
  const nextContactAt = body.nextContactAt ? new Date(body.nextContactAt) : null
  const nextContactNote = body.nextContactNote || null

  const contact = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.leadContactHistory.create({
      data: {
        organizationId,
        leadId: params.id,
        authorId: user.id,
        contactAt,
        note,
        nextContactAt,
        nextContactNote,
      },
      include: { author: { select: { id: true, name: true } } },
    })

    await tx.lead.update({
      where: { id: params.id },
      data: {
        lastContactAt: contactAt,
        lastContactNote: note,
        nextContactAt,
        nextContactNote,
      },
    })

    return created
  })

  return NextResponse.json(contact)
}
