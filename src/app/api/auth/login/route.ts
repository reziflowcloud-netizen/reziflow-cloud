import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { normalizeEmail } from '@/lib/identity'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  try {
    const { email, password } = await request.json()
    const normalizedEmail = normalizeEmail(email)

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    let organization = null

    if (!user) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    if (!organization) {
      organization = user.organizationId
        ? await prisma.organization.findUnique({ where: { id: user.organizationId } })
        : null
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restrictedAccess: (user as any).restrictedAccess === true,
      avatarUrl: (user as any).avatarUrl || null,
      organizationId: user.organizationId || 'org_default',
      organizationName: organization?.name || 'LegalHub',
      organizationStatus: organization?.status || 'active',
      organizationPlan: organization?.plan || 'manual',
      billingStatus: (organization as any)?.billingStatus || 'manual',
      trialEndsAt: organization?.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
      currentPeriodEndsAt: (organization as any)?.currentPeriodEndsAt ? (organization as any).currentPeriodEndsAt.toISOString() : null,
      sessionVersion: user.sessionVersion,
    })

    const cookieStore = cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: (user as any).avatarUrl || null,
        organizationId: user.organizationId || 'org_default',
        organizationName: organization?.name || 'LegalHub',
        organizationStatus: organization?.status || 'active',
        organizationPlan: organization?.plan || 'manual',
        billingStatus: (organization as any)?.billingStatus || 'manual',
        trialEndsAt: organization?.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
        currentPeriodEndsAt: (organization as any)?.currentPeriodEndsAt ? (organization as any).currentPeriodEndsAt.toISOString() : null,
      },
    })
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
