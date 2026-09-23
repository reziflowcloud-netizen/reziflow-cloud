import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/requestSecurity'
import { PASSWORD_MIN_LENGTH } from '@/lib/passwordResetSecurity'
import { passwordResetService } from '@/lib/passwordResetService'

export const dynamic = 'force-dynamic'

const INVALID_RESPONSE = { error: 'invalid_or_expired' } as const

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (String(body.password || '').length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 })
    }
    const result = await passwordResetService.reset({ token: body.token, password: body.password })
    if (!result.success) return NextResponse.json(INVALID_RESPONSE, { status: 400 })
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.delete('auth-token')
    return response
  } catch (error) {
    console.error('Password reset failed safely:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json(INVALID_RESPONSE, { status: 400 })
  }
}
