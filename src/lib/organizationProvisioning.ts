import bcrypt from 'bcryptjs'
import { isValidEmail } from '@/lib/apiErrors'
import { activeCasesWhere } from '@/lib/billing'
import { prisma } from '@/lib/prisma'

export const DEFAULT_TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 30)

export const DEFAULT_STATUSES = [
  { name: 'Новый', color: '#6366f1', order: 0 },
  { name: 'В работе', color: '#f59e0b', order: 1 },
  { name: 'Ожидание документов', color: '#3b82f6', order: 2 },
  { name: 'Решение получено', color: '#10b981', order: 3 },
  { name: 'Архив', color: '#6b7280', order: 4 },
  { name: 'Отказ', color: '#ef4444', order: 5 },
]

export const DEFAULT_PRIORITIES = [
  { name: 'Нормально', color: '#3b82f6', order: 0 },
  { name: 'Горит', color: '#f59e0b', order: 1 },
  { name: 'Срочно', color: '#ef4444', order: 2 },
  { name: 'Можно подождать', color: '#6b7280', order: 3 },
  { name: 'Сделано', color: '#10b981', order: 4 },
]

export const organizationInclude = {
  users: {
    where: { role: 'admin' },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
  },
  _count: {
    select: {
      users: true,
      clients: true,
      cases: true,
      leads: true,
      tasks: true,
    },
  },
}

type OrganizationUsageCounts = {
  _count?: Record<string, number> | null
  id: string
}

export async function attachOrganizationUsageStats<T extends OrganizationUsageCounts>(organization: T | null) {
  if (!organization) return organization
  const activeCases = await prisma.case.count({ where: activeCasesWhere(organization.id) })
  return {
    ...organization,
    _count: {
      ...(organization._count || {}),
      activeCases,
    },
  }
}

export async function attachOrganizationsUsageStats<T extends OrganizationUsageCounts>(organizations: T[]) {
  const activeCaseCounts = await Promise.all(
    organizations.map(organization => prisma.case.count({ where: activeCasesWhere(organization.id) }))
  )

  return organizations.map((organization, index) => ({
    ...organization,
    _count: {
      ...(organization._count || {}),
      activeCases: activeCaseCounts[index],
    },
  }))
}

const DEFAULT_SYSTEM_ADMIN_EMAILS = [
  'reziflowcloud@gmail.com',
  'office@legalhubcrm.com',
  'admin@migraflow.pl',
]

function normalizeEmailList(value?: string | null) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function getSystemAdminEmails() {
  return Array.from(new Set([
    ...DEFAULT_SYSTEM_ADMIN_EMAILS,
    ...normalizeEmailList(process.env.ADMIN_EMAIL),
    ...normalizeEmailList(process.env.ADMIN_EMAILS),
  ]))
}

export function isSystemAdmin(user: any) {
  const email = String(user?.email || '').toLowerCase()
  return user?.role === 'owner' || getSystemAdminEmails().includes(email)
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `org-${Date.now()}`
}

export function normalizeReferralCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { slug: process.env.ORGANIZATION_SLUG || 'default' },
    update: {},
    create: {
      id: 'org_default',
      name: process.env.ORGANIZATION_NAME || 'LegalHub',
      slug: process.env.ORGANIZATION_SLUG || 'default',
      status: 'active',
      plan: 'manual',
      billingStatus: 'manual',
      billingProvider: 'manual',
    },
  })
}

export async function loadSetupTemplate(sourceOrganizationId?: string | null) {
  if (!sourceOrganizationId) {
    return {
      statuses: DEFAULT_STATUSES,
      priorities: DEFAULT_PRIORITIES,
      services: [],
      caseOptions: [],
    }
  }

  const [statuses, priorities, services, caseOptions] = await Promise.all([
    prisma.caseStatus.findMany({ where: { organizationId: sourceOrganizationId }, orderBy: { order: 'asc' } }),
    prisma.taskPriority.findMany({ where: { organizationId: sourceOrganizationId }, orderBy: { order: 'asc' } }),
    (prisma as any).service.findMany({ where: { organizationId: sourceOrganizationId }, orderBy: { createdAt: 'asc' } }),
    (prisma as any).caseOption.findMany({ where: { organizationId: sourceOrganizationId }, orderBy: { order: 'asc' } }),
  ])

  return {
    statuses: statuses.length ? statuses.map(({ name, color, order }) => ({ name, color, order })) : DEFAULT_STATUSES,
    priorities: priorities.length ? priorities.map(({ name, color, order }) => ({ name, color, order })) : DEFAULT_PRIORITIES,
    services: services.map((item: any) => ({
      sourceId: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      color: item.color,
      active: item.active,
    })),
    caseOptions: caseOptions.map((item: any) => ({
      type: item.type,
      value: item.value,
      order: item.order,
    })),
  }
}

async function resolveUniqueSlug(baseValue: string, explicitSlug: boolean) {
  const baseSlug = slugify(baseValue)
  const existing = await prisma.organization.findUnique({ where: { slug: baseSlug } })
  if (!existing) return baseSlug
  if (explicitSlug) throw new Error('Фирма с таким коротким адресом уже есть')

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseSlug}-${index}`
    const match = await prisma.organization.findUnique({ where: { slug: candidate } })
    if (!match) return candidate
  }

  throw new Error('Не удалось подобрать свободный короткий адрес')
}

export async function provisionOrganization(input: {
  name: string
  slug?: string
  adminName: string
  adminEmail: string
  adminPassword: string
  plan?: string
  status?: string
  billingStatus?: string
  trialDays?: number
  trialEndsAt?: Date | null
  templateOrganizationId?: string | null
  referralCode?: string | null
  landingPath?: string | null
}) {
  const name = String(input.name || '').trim()
  const adminName = String(input.adminName || '').trim()
  const adminEmail = String(input.adminEmail || '').trim().toLowerCase()
  const adminPassword = String(input.adminPassword || '')
  const plan = String(input.plan || 'starter')
  const status = String(input.status || 'trial')
  const now = new Date()
  const trialDays = input.trialDays ?? DEFAULT_TRIAL_DAYS
  const trialEndsAt = input.trialEndsAt === undefined
    ? (status === 'trial' ? addDays(now, trialDays) : null)
    : input.trialEndsAt
  const billingStatus = input.billingStatus || (status === 'trial' ? 'trialing' : 'manual')
  const referralCode = input.referralCode ? normalizeReferralCode(input.referralCode) : ''

  if (!name || !adminName || !adminEmail || !adminPassword) {
    throw new Error('Название фирмы, имя администратора, email и пароль обязательны')
  }
  if (!isValidEmail(adminEmail)) {
    throw new Error('Введите корректный email для входа')
  }
  if (adminPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов')
  }

  const explicitSlug = Boolean(input.slug && String(input.slug).trim())
  const slug = await resolveUniqueSlug(input.slug || name, explicitSlug)
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingUser) throw new Error('Пользователь с таким email уже есть')

  const [template, partner] = await Promise.all([
    loadSetupTemplate(input.templateOrganizationId),
    referralCode
      ? (prisma as any).referralPartner.findFirst({ where: { code: referralCode, status: 'active' } })
      : Promise.resolve(null),
  ])
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const organization = await prisma.$transaction(async tx => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        status,
        plan,
        billingStatus,
        billingProvider: 'manual',
        trialStartedAt: status === 'trial' ? now : null,
        trialEndsAt,
      },
    })

    await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        organizationId: org.id,
      },
    })

    await tx.caseStatus.createMany({
      data: template.statuses.map(item => ({ ...item, organizationId: org.id })),
    })
    await tx.taskPriority.createMany({
      data: template.priorities.map(item => ({ ...item, organizationId: org.id })),
    })
    if (template.services.length) {
      await (tx as any).service.createMany({
        data: template.services.map(({ sourceId, ...item }: any) => ({ ...item, organizationId: org.id })),
      })
    }
    const createdServices = template.services.length
      ? await (tx as any).service.findMany({ where: { organizationId: org.id } })
      : []
    const sourceServiceByName = new Map(template.services.map((item: any) => [item.name, item.sourceId]))
    const targetServiceIdBySource = new Map<string, number>()
    for (const service of createdServices as any[]) {
      const sourceId = sourceServiceByName.get(service.name)
      if (sourceId) targetServiceIdBySource.set(String(sourceId), service.id)
    }
    const remapCaseOptionType = (type: string) => {
      const match = String(type || '').match(/^mosDocument:(\d+)$/)
      if (!match) return type
      const targetServiceId = targetServiceIdBySource.get(match[1])
      return targetServiceId ? `mosDocument:${targetServiceId}` : 'mosDocument'
    }
    if (template.caseOptions.length) {
      await (tx as any).caseOption.createMany({
        data: template.caseOptions.map((item: any) => ({
          ...item,
          type: remapCaseOptionType(item.type),
          organizationId: org.id,
        })),
      })
    }

    if (partner) {
      await (tx as any).referralAttribution.create({
        data: {
          organizationId: org.id,
          partnerId: partner.id,
          referralCode,
          landingPath: input.landingPath || null,
        },
      })
    }

    return org
  })

  const created = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: organizationInclude,
  })
  return attachOrganizationUsageStats(created)
}
