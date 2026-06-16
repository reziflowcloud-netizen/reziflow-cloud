import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { ensureDefaultOrganization } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_FIELD_LENGTH = 500

function cleanField(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  return String(value || '').trim().slice(0, maxLength)
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = cleanField(body.name, 160)
  const contact = cleanField(body.contact, 220)
  const company = cleanField(body.company, 220)
  const message = cleanField(body.message, 1000)

  if (!name || !contact) {
    return NextResponse.json({ error: 'Name and contact are required' }, { status: 400 })
  }

  const sourceOrganizationId = getOrganizationId(user)
  const [targetOrganization, sourceOrganization] = await Promise.all([
    ensureDefaultOrganization(),
    prisma.organization.findUnique({
      where: { id: sourceOrganizationId },
      select: { id: true, name: true, slug: true, plan: true, billingStatus: true },
    }),
  ])

  const defaultStatus = await (prisma as any).leadStatus.findFirst({
    where: { organizationId: targetOrganization.id },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { name: true },
  })
  const owner = await prisma.user.findFirst({
    where: { organizationId: targetOrganization.id, role: { in: ['owner', 'admin'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const isEmail = looksLikeEmail(contact)
  const isHandle = contact.startsWith('@')
  const notes = [
    'Заявка из раздела "Тариф и оплата"',
    `Текущая организация: ${sourceOrganization?.name || sourceOrganizationId}`,
    `Slug: ${sourceOrganization?.slug || '-'}`,
    `Тариф: ${sourceOrganization?.plan || '-'}`,
    `Статус оплаты: ${sourceOrganization?.billingStatus || '-'}`,
    `Пользователь: ${String(user.name || '-')} <${String(user.email || '-')}>`,
    company ? `Компания из формы: ${company}` : '',
    `Контакт: ${contact}`,
    message ? `Комментарий: ${message}` : '',
  ].filter(Boolean).join('\n')

  const lead = await (prisma as any).lead.create({
    data: {
      organizationId: targetOrganization.id,
      assignedToId: owner?.id || null,
      status: defaultStatus?.name || undefined,
      source: 'billing-contact',
      fullName: name,
      phone: !isEmail && !isHandle ? contact : null,
      email: isEmail ? contact : null,
      messengerId: isHandle ? contact : null,
      serviceInterest: 'Тариф и оплата',
      notes,
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, id: lead.id })
}
