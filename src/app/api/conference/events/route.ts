import { NextRequest, NextResponse } from 'next/server'
import {
  conferenceLanguageFromRequest,
  resolveConferenceAttribution,
  setConferenceAttributionCookie,
  setConferenceLanguageCookie,
} from '@/lib/conferenceAttribution'
import { recordConferenceEvent } from '@/lib/conferenceEvents'
import { cleanConferenceValue, isPublicConferenceEventName } from '@/lib/conferenceTrackingCore'

export const dynamic = 'force-dynamic'

const REGISTER_CTA_LOCATIONS = new Set(['hero', 'final', 'demo_bar', 'header', 'sticky_mobile'])

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!isPublicConferenceEventName(body.eventName)) {
    return NextResponse.json({ error: 'Unsupported event' }, { status: 400 })
  }

  const resolved = await resolveConferenceAttribution(request)
  if (!resolved) return new NextResponse(null, { status: 204 })

  const language = conferenceLanguageFromRequest(request, body.language)
  const requestedLocation = cleanConferenceValue(body.ctaLocation, 48)
  const ctaLocation = body.eventName === 'conference_register_click'
    && requestedLocation
    && REGISTER_CTA_LOCATIONS.has(requestedLocation)
      ? requestedLocation
      : null

  try {
    await recordConferenceEvent({
      eventName: body.eventName,
      attribution: resolved.attribution,
      language,
      ctaLocation,
      metadata: body.eventName === 'conference_register_click' ? { selectedPlan: 'free' } : undefined,
    })
  } catch (error) {
    console.error('Conference event tracking failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ tracked: false }, { status: 503 })
  }

  const response = NextResponse.json({ tracked: true })
  if (resolved.newToken) setConferenceAttributionCookie(response, resolved.newToken)
  setConferenceLanguageCookie(response, language)
  return response
}
