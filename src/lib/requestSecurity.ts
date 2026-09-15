const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const ORIGIN_EXEMPT_PREFIXES = [
  '/api/webhooks/',
  '/api/meta/data-deletion',
]

function expectedOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const requestUrl = new URL(request.url)
  const protocol = forwardedProto || requestUrl.protocol.replace(':', '')
  return host ? `${protocol}://${host}` : requestUrl.origin
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')

  if (!origin) return fetchSite !== 'cross-site'
  if (origin === 'null') return false

  try {
    return new URL(origin).origin === new URL(expectedOrigin(request)).origin
  } catch {
    return false
  }
}

export function shouldEnforceSameOrigin(pathname: string, method: string): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return false
  if (!pathname.startsWith('/api/')) return false
  return !ORIGIN_EXEMPT_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix))
}

