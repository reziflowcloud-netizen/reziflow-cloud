'use client'

import type { ConferenceLanguage } from '@/lib/conferenceTrackingCore'

type PublicConferenceEvent = 'conference_page_view' | 'conference_register_click'

export function trackConferenceEvent(
  eventName: PublicConferenceEvent,
  input: { language: ConferenceLanguage; ctaLocation?: string },
) {
  const body = JSON.stringify({ eventName, ...input })

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const queued = navigator.sendBeacon('/api/conference/events', new Blob([body], { type: 'application/json' }))
    if (queued) return
  }

  void fetch('/api/conference/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}
