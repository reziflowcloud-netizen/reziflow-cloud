// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'
import {
  isConferenceDemoApiBlocked,
  isConferenceDemoPageBlocked,
  isConferenceDemoSession,
} from './lib/conferenceDemo'

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/login',
  '/register',
  '/conference',
  '/conference/demo',
  '/contact',
  '/partner',
  '/privacy',
  '/data-deletion',
  '/delete-data',
  '/regulamin',
  '/favicon.svg',
  '/favicon.png',
  '/manifest.json',
  '/api/auth/login',
  '/api/auth/register',
  '/api/contact',
  '/api/partner/referrals',
  '/api/meta/data-deletion',
]
const PUBLIC_PREFIXES = ['/assets', '/api/webhooks/leads', '/api/webhooks/meta/leads', '/api/webhooks/meta/messages', '/api/webhooks/telegram/leads']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p)
    || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  const token = request.cookies.get('auth-token')?.value

  if (isPublic) {
    // If logged in and on public entry pages, continue to the app.
    if (token && (pathname === '/login' || pathname === '/register')) {
      const payload = await verifyToken(token)
      if (payload && isConferenceDemoSession(payload)) {
        const response = NextResponse.next()
        response.cookies.delete('auth-token')
        return response
      }
      if (payload) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected route
  if (!token) return NextResponse.redirect(new URL('/login', request.url))
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.redirect(new URL('/login', request.url))

  if (isConferenceDemoSession(payload)) {
    if (isConferenceDemoPageBlocked(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/api/') && isConferenceDemoApiBlocked(pathname, request.method)) {
      return NextResponse.json({ error: 'This action is unavailable in the conference demo.' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
