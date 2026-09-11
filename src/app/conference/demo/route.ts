import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, verifyToken } from '@/lib/auth'
import {
  CONFERENCE_DEMO_SESSION_MODE,
  CONFERENCE_DEMO_SESSION_EXPIRES_IN,
  CONFERENCE_DEMO_SESSION_SECONDS,
} from '@/lib/conferenceDemo'

export const dynamic = 'force-dynamic'

function unavailable(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/conference?demo=unavailable', request.url), 303)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export async function GET(request: NextRequest) {
  const existingToken = request.cookies.get('auth-token')?.value
  if (existingToken) {
    const existingUser = await verifyToken(existingToken)
    if (existingUser) {
      const response = NextResponse.redirect(new URL('/dashboard', request.url), 303)
      response.headers.set('Cache-Control', 'no-store')
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
      return response
    }
  }

  const userId = Number.parseInt(String(process.env.CONFERENCE_DEMO_USER_ID || ''), 10)
  const organizationId = String(process.env.CONFERENCE_DEMO_ORGANIZATION_ID || '').trim()

  if (!process.env.JWT_SECRET || !Number.isInteger(userId) || userId <= 0 || !organizationId) {
    return unavailable(request)
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        name: true,
        role: true,
        restrictedAccess: true,
        avatarUrl: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            status: true,
            plan: true,
            billingStatus: true,
            trialEndsAt: true,
            currentPeriodEndsAt: true,
          },
        },
      },
    })

    if (!user?.organization || user.organization.id !== organizationId || user.organization.status !== 'active') {
      return unavailable(request)
    }

    const token = await signToken({
      id: user.id,
      name: user.name,
      role: user.role,
      restrictedAccess: user.restrictedAccess === true,
      avatarUrl: user.avatarUrl || null,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationStatus: user.organization.status,
      organizationPlan: user.organization.plan,
      billingStatus: user.organization.billingStatus,
      trialEndsAt: user.organization.trialEndsAt?.toISOString() || null,
      currentPeriodEndsAt: user.organization.currentPeriodEndsAt?.toISOString() || null,
      sessionMode: CONFERENCE_DEMO_SESSION_MODE,
    }, CONFERENCE_DEMO_SESSION_EXPIRES_IN)

    const response = NextResponse.redirect(new URL('/dashboard', request.url), 303)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CONFERENCE_DEMO_SESSION_SECONDS,
      path: '/',
    })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  } catch (error) {
    console.error('Conference demo session failed:', error instanceof Error ? error.name : 'UnknownError')
    return unavailable(request)
  }
}
