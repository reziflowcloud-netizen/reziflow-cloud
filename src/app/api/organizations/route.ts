import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const DEFAULT_STATUSES = [
  { name: 'Новый', color: '#6366f1', order: 0 },
  { name: 'В работе', color: '#f59e0b', order: 1 },
  { name: 'Ожидание документов', color: '#3b82f6', order: 2 },
  { name: 'Решение получено', color: '#10b981', order: 3 },
  { name: 'Архив', color: '#6b7280', order: 4 },
  { name: 'Отказ', color: '#ef4444', order: 5 },
]

const DEFAULT_PRIORITIES = [
  { name: 'Нормально', color: '#3b82f6', order: 0 },
  { name: 'Горит', color: '#f59e0b', order: 1 },
  { name: 'Срочно', color: '#ef4444', order: 2 },
  { name: 'Можно подождать', color: '#6b7280', order: 3 },
  { name: 'Сделано', color: '#10b981', order: 4 },
]

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `org-${Date.now()}`
}

function isSystemAdmin(user: any) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@migraflow.pl').toLowerCase()
  return user?.role === 'owner' || String(user?.email || '').toLowerCase() === adminEmail
}

const organizationInclude = {
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
      tasks: true,
    },
  },
}

async function loadSetupTemplate(sourceOrganizationId: string) {
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

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(user.role === 'admin' || user.role === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const canManageAll = isSystemAdmin(user)
  const organizations = await prisma.organization.findMany({
    where: canManageAll ? {} : { id: getOrganizationId(user) },
    orderBy: { createdAt: 'asc' },
    include: organizationInclude,
  })

  return NextResponse.json({ organizations, canManageAll })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    const adminName = String(body.adminName || '').trim()
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase()
    const adminPassword = String(body.adminPassword || '')
    const plan = String(body.plan || 'manual')
    const status = String(body.status || 'active')
    const trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null
    const slug = slugify(body.slug || name)

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Название фирмы, имя администратора, email и пароль обязательны' }, { status: 400 })
    }
    if (adminPassword.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }

    const [existingOrg, existingUser] = await Promise.all([
      prisma.organization.findUnique({ where: { slug } }),
      prisma.user.findUnique({ where: { email: adminEmail } }),
    ])
    if (existingOrg) return NextResponse.json({ error: 'Фирма с таким коротким адресом уже есть' }, { status: 400 })
    if (existingUser) return NextResponse.json({ error: 'Пользователь с таким email уже есть' }, { status: 400 })

    const template = await loadSetupTemplate(getOrganizationId(user))
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const organization = await prisma.$transaction(async tx => {
      const org = await tx.organization.create({
        data: { name, slug, status, plan, trialEndsAt },
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
          data: template.services.map((item: any) => ({ ...item, organizationId: org.id })),
        })
      }
      if (template.caseOptions.length) {
        await (tx as any).caseOption.createMany({
          data: template.caseOptions.map((item: any) => ({ ...item, organizationId: org.id })),
        })
      }
      return org
    })

    const created = await prisma.organization.findUnique({
      where: { id: organization.id },
      include: organizationInclude,
    })
    return NextResponse.json(created)
  } catch (e: any) {
    console.error('Organization create error:', e)
    return NextResponse.json({ error: e.message || 'Ошибка создания фирмы' }, { status: 500 })
  }
}
