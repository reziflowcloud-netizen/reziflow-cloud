import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { signToken } from '@/lib/auth'
import { ensureDefaultOrganization, provisionOrganization } from '@/lib/organizationProvisioning'

const ALLOWED_PLANS = new Set(['free', 'starter', 'pro', 'agency'])

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        error: 'Регистрация почти готова, но сейчас база данных не подключена. Оставьте заявку через форму связи или попробуйте позже.',
      }, { status: 503 })
    }

    const body = await request.json()
    const name = String(body.companyName || body.name || '').trim()
    const adminName = String(body.adminName || '').trim()
    const adminEmail = String(body.adminEmail || body.email || '').trim().toLowerCase()
    const adminPassword = String(body.password || body.adminPassword || '')
    const plan = ALLOWED_PLANS.has(String(body.plan)) ? String(body.plan) : 'free'
    const isFreePlan = plan === 'free'
    const referralCode = body.referralCode ? String(body.referralCode) : null
    const landingPath = body.landingPath ? String(body.landingPath) : null

    const templateOrganization = await ensureDefaultOrganization()
    const organization = await provisionOrganization({
      name,
      adminName,
      adminEmail,
      adminPassword,
      plan,
      status: isFreePlan ? 'active' : 'trial',
      billingStatus: isFreePlan ? 'manual' : 'trialing',
      ...(isFreePlan ? { trialEndsAt: null } : {}),
      templateOrganizationId: templateOrganization.id,
      referralCode,
      landingPath,
    })

    const admin = organization?.users?.[0]
    if (!organization || !admin) {
      return NextResponse.json({ error: 'Не удалось создать администратора организации' }, { status: 500 })
    }

    const token = await signToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      avatarUrl: null,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationStatus: organization.status,
      organizationPlan: organization.plan,
      billingStatus: (organization as any).billingStatus || 'trialing',
      trialEndsAt: organization.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
      currentPeriodEndsAt: (organization as any).currentPeriodEndsAt ? (organization as any).currentPeriodEndsAt.toISOString() : null,
    })

    cookies().set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      redirectTo: '/dashboard',
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        status: organization.status,
        billingStatus: (organization as any).billingStatus,
        trialEndsAt: organization.trialEndsAt,
      },
    })
  } catch (error: any) {
    console.error('Register organization error:', error)
    const message = String(error?.message || '')
    if (message.includes('DATABASE_URL')) {
      return NextResponse.json({
        error: 'Регистрация почти готова, но сейчас база данных не подключена. Оставьте заявку через форму связи или попробуйте позже.',
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Не удалось создать организацию. Проверьте данные или оставьте заявку через форму связи.' }, { status: 400 })
  }
}
