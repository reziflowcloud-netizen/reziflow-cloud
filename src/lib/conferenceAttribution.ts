import type { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import {
  CONFERENCE_CAMPAIGN,
  createConferenceAttribution,
  inferConferenceLanguage,
  isConferenceCampaignUtm,
  normalizeConferenceLanguage,
  readConferenceUtm,
  type ConferenceAttribution,
  type ConferenceLanguage,
} from '@/lib/conferenceTrackingCore'

export const CONFERENCE_ATTRIBUTION_COOKIE = 'legalhub-conference-attribution'
export const CONFERENCE_LANGUAGE_COOKIE = 'legalhub-conference-language'
export const CONFERENCE_DEMO_VISITED_COOKIE = 'legalhub-conference-demo-visited'
export const CONFERENCE_ATTRIBUTION_SECONDS = 60 * 60 * 24 * 30

type ResolvedConferenceAttribution = {
  attribution: ConferenceAttribution
  newToken: string | null
}

function conferenceSecret() {
  const value = process.env.JWT_SECRET?.trim()
  return value ? new TextEncoder().encode(value) : null
}

function isConferenceEntry(url: URL) {
  if (url.pathname === '/conference' || url.pathname === '/conference/demo') return true
  if (url.pathname !== '/register') return false
  return isConferenceCampaignUtm(readConferenceUtm(url.searchParams))
}

export async function verifyConferenceAttribution(token?: string | null): Promise<ConferenceAttribution | null> {
  const secret = conferenceSecret()
  if (!secret || !token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.kind !== 'conference_attribution' || typeof payload.attributionId !== 'string') return null
    return {
      attributionId: payload.attributionId,
      firstPath: String(payload.firstPath || '/conference'),
      utmSource: typeof payload.utmSource === 'string' ? payload.utmSource : null,
      utmMedium: typeof payload.utmMedium === 'string' ? payload.utmMedium : null,
      utmCampaign: typeof payload.utmCampaign === 'string' ? payload.utmCampaign : null,
      utmContent: typeof payload.utmContent === 'string' ? payload.utmContent : null,
      utmTerm: typeof payload.utmTerm === 'string' ? payload.utmTerm : null,
    }
  } catch {
    return null
  }
}

async function signConferenceAttribution(attribution: ConferenceAttribution) {
  const secret = conferenceSecret()
  if (!secret) return null
  return new SignJWT({ kind: 'conference_attribution', ...attribution })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function resolveConferenceAttribution(request: NextRequest): Promise<ResolvedConferenceAttribution | null> {
  const existing = await verifyConferenceAttribution(request.cookies.get(CONFERENCE_ATTRIBUTION_COOKIE)?.value)
  if (existing) return { attribution: existing, newToken: null }

  const url = new URL(request.url)
  if (!isConferenceEntry(url)) return null

  const attribution = createConferenceAttribution(url, crypto.randomUUID())
  const newToken = await signConferenceAttribution(attribution)
  return newToken ? { attribution, newToken } : null
}

export function setConferenceAttributionCookie(response: NextResponse, token: string) {
  response.cookies.set(CONFERENCE_ATTRIBUTION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CONFERENCE_ATTRIBUTION_SECONDS,
    path: '/',
  })
}

export function setConferenceLanguageCookie(response: NextResponse, language: ConferenceLanguage) {
  response.cookies.set(CONFERENCE_LANGUAGE_COOKIE, language, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CONFERENCE_ATTRIBUTION_SECONDS,
    path: '/',
  })
}

export function setConferenceDemoVisitedCookie(response: NextResponse) {
  response.cookies.set(CONFERENCE_DEMO_VISITED_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CONFERENCE_ATTRIBUTION_SECONDS,
    path: '/',
  })
}

export function conferenceLanguageFromRequest(request: NextRequest, explicit?: unknown) {
  const fallback = inferConferenceLanguage(request.headers.get('accept-language'))
  return normalizeConferenceLanguage(
    explicit || request.cookies.get(CONFERENCE_LANGUAGE_COOKIE)?.value,
    fallback,
  )
}

export function isApprovedConferenceCampaign(attribution: ConferenceAttribution) {
  return attribution.utmCampaign === CONFERENCE_CAMPAIGN
    || attribution.utmSource === 'conference'
    || attribution.firstPath.startsWith('/conference')
}
