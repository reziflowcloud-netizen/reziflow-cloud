import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DIRECTIONS = new Set(['incoming', 'outgoing'])
const SENDER_TYPES = new Set(['lead', 'bot', 'employee', 'system'])

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await (prisma as any).leadMessage.findMany({
    where: { leadId: params.id, organizationId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { sentAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId }, select: { id: true, source: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const text = String(body.text || '').trim()
  if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })

  const direction = DIRECTIONS.has(String(body.direction)) ? String(body.direction) : 'outgoing'
  const senderType = SENDER_TYPES.has(String(body.senderType)) ? String(body.senderType) : (direction === 'outgoing' ? 'employee' : 'lead')
  const channel = String(body.channel || lead.source || 'manual').trim() || 'manual'
  const sentAt = body.sentAt ? new Date(body.sentAt) : new Date()

  const message = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.leadMessage.create({
      data: {
        organizationId,
        leadId: params.id,
        authorId: senderType === 'employee' ? user.id : null,
        channel,
        direction,
        senderType,
        senderName: body.senderName ? String(body.senderName).trim() : null,
        externalMessageId: body.externalMessageId ? String(body.externalMessageId).trim() : null,
        text,
        payload: body.payload || undefined,
        sentAt,
      },
      include: { author: { select: { id: true, name: true } } },
    })

    await tx.lead.update({
      where: { id: params.id },
      data: {
        lastContactAt: sentAt,
        lastContactNote: text,
      },
    })

    return created
  })

  return NextResponse.json(message)
}
