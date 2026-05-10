import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { leadDisplayName } from '@/lib/leads'

export const dynamic = 'force-dynamic'

function splitName(lead: any) {
  if (lead.firstName || lead.lastName) {
    return {
      firstName: lead.firstName || lead.fullName || 'Лид',
      lastName: lead.lastName || '',
    }
  }
  const parts = String(lead.fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'Лид', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (lead.convertedClientId) {
    return NextResponse.json({ error: 'Лид уже переведён в клиента', clientId: lead.convertedClientId }, { status: 409 })
  }

  const name = splitName(lead)
  const client = await prisma.client.create({
    data: {
      organizationId,
      firstName: name.firstName,
      lastName: name.lastName,
      phone: lead.phone || null,
      email: lead.email || null,
      city: lead.city || null,
      citizenship: lead.country || null,
    },
  })

  await (prisma as any).lead.update({
    where: { id: lead.id },
    data: {
      status: 'Переведён в клиента',
      convertedClientId: client.id,
      convertedAt: new Date(),
      notes: [lead.notes, `Переведён в клиента: ${leadDisplayName(lead)}`].filter(Boolean).join('\n'),
    },
  })

  return NextResponse.json({ clientId: client.id })
}
