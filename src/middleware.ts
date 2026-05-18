// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

const PUBLIC_PATHS = ['/', '/privacy', '/data-deletion', '/favicon.svg', '/manifest.json', '/api/auth/login']
const PUBLIC_PREFIXES = ['/assets', '/api/webhooks/leads', '/api/webhooks/meta/leads', '/api/webhooks/meta/messages', '/api/webhooks/telegram/leads']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p)
    || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  const token = request.cookies.get('auth-token')?.value

  if (isPublic) {
    // If logged in and on login page — redirect to dashboard
    if (token && pathname === '/') {
      const payload = await verifyToken(token)
      if (payload) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected route
  if (!token) return NextResponse.redirect(new URL('/', request.url))
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.redirect(new URL('/', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
