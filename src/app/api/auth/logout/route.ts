// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isSameOriginRequest } from '@/lib/requestSecurity'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  const cookieStore = cookies()
  cookieStore.delete('auth-token')
  return NextResponse.json({ success: true })
}
