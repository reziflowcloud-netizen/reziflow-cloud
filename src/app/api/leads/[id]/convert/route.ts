import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { leadDisplayName } from '@/lib/leads'
import { normalizePhones, primaryPhone } from '@/lib/phones'
import { getDataAccessScope, leadWhereForScope } from '@/lib/apiScope'
import { assertBillingLimit, billingLimitResponsePayload, isBillableActiveCaseStatus, isBillingLimitError } from '@/lib/billing'

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

async function convertedStatusName(organizationId: string) {
  const statuses = await (prisma as any).leadStatus.findMany({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
  return statuses.find((item: any) => {
    const name = String(item.name || '').toLowerCase()
    return name.includes('клиент') || name.includes('\u043a\u043b\u0456\u0454\u043d\u0442') || name.includes('client') || name.includes('klient')
  })?.name || 'Переведён в клиента'
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const body = await request.json().catch(() => ({}))

  const lead = await (prisma as any).lead.findFirst({
    where: leadWhereForScope(scope, organizationId, { id: params.id }),
    include: { phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (lead.convertedClientId) {
    return NextResponse.json({ error: 'Лид уже переведён в клиента', clientId: lead.convertedClientId }, { status: 409 })
  }

  const fallbackName = splitName(lead)
  const name = {
    firstName: String(body.firstName || '').trim() || fallbackName.firstName,
    lastName: String(body.lastName || '').trim() || fallbackName.lastName,
  }
  const convertedStatus = await convertedStatusName(organizationId)
  const leadPhoneInput = lead.phones?.length ? lead.phones : []
  const leadPhones = normalizePhones(
    body.phone ? [{ phone: body.phone, isPrimary: true }, ...leadPhoneInput] : leadPhoneInput,
    body.phone || lead.phone
  )
  const clientPrimaryPhone = body.phone || primaryPhone(leadPhones, lead.phone)
  const caseStatus = body.caseStatus || 'Новый'

  try {
    await assertBillingLimit(organizationId, 'clients')
    if (body.createCase && isBillableActiveCaseStatus(caseStatus)) {
      await assertBillingLimit(organizationId, 'cases')
    }
  } catch (error) {
    if (isBillingLimitError(error)) return NextResponse.json(billingLimitResponsePayload(error), { status: 402 })
    throw error
  }

  const result = await (prisma as any).$transaction(async (tx: any) => {
    const client = await tx.client.create({
      data: {
        organizationId,
        assignedToId: scope.restricted && scope.userId ? scope.userId : lead.assignedToId || null,
        firstName: name.firstName,
        lastName: name.lastName,
        phone: clientPrimaryPhone || null,
        email: body.email || lead.email || null,
        city: body.city || lead.city || null,
        citizenship: body.country || lead.country || null,
        phones: leadPhones.length ? {
          create: leadPhones.map((phone: any) => ({
            organizationId,
            ...phone,
            isPrimary: phone.phone === clientPrimaryPhone,
          })),
        } : undefined,
      },
    })

    let createdCase: any = null
    if (body.createCase) {
      createdCase = await tx.case.create({
        data: {
          organizationId,
          clientId: client.id,
          status: caseStatus,
          totalValue: parseFloat(body.totalValue) || 0,
          assignedToId: scope.restricted && scope.userId ? scope.userId : body.assignedToId ? parseInt(body.assignedToId) : lead.assignedToId || null,
          employeeId: lead.employeeId || null,
          serviceId: body.serviceId ? parseInt(body.serviceId) : null,
          notes: body.caseNotes || `Создано при переводе лида: ${leadDisplayName(lead)}`,
        },
      })
      await tx.statusHistory.create({
        data: { caseId: createdCase.id, toStatus: createdCase.status, changedBy: user.name || 'System' },
      })
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: convertedStatus,
        convertedClientId: client.id,
        convertedAt: new Date(),
        notes: [lead.notes, `Переведён в клиента: ${leadDisplayName(lead)}`].filter(Boolean).join('\n'),
      },
    })

    await tx.leadContactHistory.create({
      data: {
        organizationId,
        leadId: lead.id,
        authorId: user.id,
        contactAt: new Date(),
        note: `Лид переведён в клиента: ${name.firstName} ${name.lastName}`.trim(),
        nextContactNote: createdCase ? `Создано дело ${createdCase.caseNumber || createdCase.id}` : null,
      },
    })

    if (lead.status !== convertedStatus) {
      await tx.leadContactHistory.create({
        data: {
          organizationId,
          leadId: lead.id,
          authorId: user.id,
          contactAt: new Date(),
          note: `Статус изменен: ${lead.status || '—'} -> ${convertedStatus}`,
        },
      })
    }

    return { clientId: client.id, caseId: createdCase?.id || null }
  })

  return NextResponse.json(result)
}
