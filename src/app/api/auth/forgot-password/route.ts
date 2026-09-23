import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { FORGOT_PASSWORD_PUBLIC_RESULT, passwordResetService } from '@/lib/passwordResetService'

export const dynamic = 'force-dynamic'

function requestOrigin(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'preview') return request.nextUrl.origin
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) {
        return url.origin
      }
    } catch {
      // Fall back to the deployment origin below.
    }
  }
  return request.nextUrl.origin
}

function trustedSourceIp(request: NextRequest) {
  if (!process.env.VERCEL && !request.headers.get('x-vercel-id')) return null
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  }

  try {
    const body = await request.json()
    await passwordResetService.request({
      email: body.email,
      language: body.language,
      origin: requestOrigin(request),
      sourceIp: trustedSourceIp(request),
    })
  } catch (error) {
    console.error('Password reset request failed safely:', error instanceof Error ? error.name : 'UnknownError')
  }

  return NextResponse.json(FORGOT_PASSWORD_PUBLIC_RESULT, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
