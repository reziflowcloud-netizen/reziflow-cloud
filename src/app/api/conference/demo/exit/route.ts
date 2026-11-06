import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/authToken'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'
import { isSameOriginRequest } from '@/lib/requestSecurity'

const DESTINATIONS = {
  login: '/login',
  register: '/register?plan=free',
} as const

export async function POST(request: NextRequest) {
  // A form submission supplies Origin. Requiring it also rejects non-browser
  // requests that omit the usual same-origin signal.
  if (!request.headers.get('origin') || !isSameOriginRequest(request)
    || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  }

  if (request.nextUrl.search) return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 })
  }
  const fields = Array.from(form.keys())
  if (fields.length !== 1 || fields[0] !== 'intent') {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  }
  const intent = form.get('intent')
  if (intent !== 'login' && intent !== 'register') {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  }

  // Inspect the cookie sent with this request. A stale demo tab must not
  // remove a normal session established in another tab.
  const token = request.cookies.get('auth-token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload || !isConferenceDemoSession(payload)) {
    return NextResponse.json({ error: 'Demo session required' }, { status: 403 })
  }

  const response = NextResponse.redirect(new URL(DESTINATIONS[intent], request.url), 303)
  response.cookies.delete('auth-token')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
