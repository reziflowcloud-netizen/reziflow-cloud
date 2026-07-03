import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { attachOrganizationsUsageStats, isSystemAdmin, organizationInclude, provisionOrganization } from '@/lib/organizationProvisioning'

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

  return NextResponse.json({ organizations: await attachOrganizationsUsageStats(organizations), canManageAll })
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
    const trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : status === 'trial' ? undefined : null

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Название фирмы, имя администратора, email и пароль обязательны' }, { status: 400 })
    }
    if (adminPassword.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }

    const created = await provisionOrganization({
      name,
      slug: body.slug,
      adminName,
      adminEmail,
      adminPassword,
      plan,
      status,
      billingStatus: status === 'trial' ? 'trialing' : 'manual',
      trialEndsAt,
      templateOrganizationId: getOrganizationId(user),
    })
    return NextResponse.json(created)
  } catch (e: any) {
    console.error('Organization create error:', e)
    return NextResponse.json({ error: e.message || 'Ошибка создания фирмы' }, { status: 500 })
  }
}
