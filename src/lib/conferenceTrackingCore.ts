export const CONFERENCE_CAMPAIGN = 'conference_legalization_poland'

export const CONFERENCE_EVENT_NAMES = [
  'conference_page_view',
  'conference_demo_open',
  'conference_register_click',
  'conference_register_complete',
] as const

export type ConferenceEventName = typeof CONFERENCE_EVENT_NAMES[number]
export type ConferenceLanguage = 'ru' | 'uk' | 'en' | 'pl'
export type ConferenceDemoOrigin = 'flyer_qr' | 'conference_landing'

export type ConferenceUtm = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
}

export type ConferenceAttribution = ConferenceUtm & {
  attributionId: string
  firstPath: string
}

const LANGUAGE_SET = new Set<ConferenceLanguage>(['ru', 'uk', 'en', 'pl'])

export function cleanConferenceValue(value: unknown, maxLength = 120) {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength)
  return cleaned || null
}

export function readConferenceUtm(searchParams: URLSearchParams): ConferenceUtm {
  return {
    utmSource: cleanConferenceValue(searchParams.get('utm_source')),
    utmMedium: cleanConferenceValue(searchParams.get('utm_medium')),
    utmCampaign: cleanConferenceValue(searchParams.get('utm_campaign')),
    utmContent: cleanConferenceValue(searchParams.get('utm_content')),
    utmTerm: cleanConferenceValue(searchParams.get('utm_term')),
  }
}

export function isConferenceCampaignUtm(utm: ConferenceUtm) {
  return utm.utmCampaign === CONFERENCE_CAMPAIGN || utm.utmSource === 'conference'
}

export function createConferenceAttribution(
  url: URL,
  attributionId: string,
): ConferenceAttribution {
  return {
    attributionId,
    firstPath: url.pathname,
    ...readConferenceUtm(url.searchParams),
  }
}

export function preserveConferenceFirstTouch(
  existing: ConferenceAttribution | null,
  incoming: ConferenceAttribution,
) {
  return existing || incoming
}

export function normalizeConferenceLanguage(value: unknown, fallback: ConferenceLanguage = 'uk'): ConferenceLanguage {
  const normalized = String(value || '').toLowerCase() === 'ua'
    ? 'uk'
    : String(value || '').toLowerCase()
  return LANGUAGE_SET.has(normalized as ConferenceLanguage)
    ? normalized as ConferenceLanguage
    : fallback
}

export function inferConferenceLanguage(acceptLanguage: string | null | undefined): ConferenceLanguage {
  const value = String(acceptLanguage || '').toLowerCase()
  if (/\bpl\b/.test(value)) return 'pl'
  if (/\b(?:uk|ua)\b/.test(value)) return 'uk'
  if (/\bru\b/.test(value)) return 'ru'
  if (/\ben\b/.test(value)) return 'en'
  return 'uk'
}

export function inferConferenceDemoOrigin(
  requestUrl: URL,
  attribution: ConferenceAttribution,
  referrer?: string | null,
): ConferenceDemoOrigin {
  const currentUtm = readConferenceUtm(requestUrl.searchParams)
  if (currentUtm.utmMedium === 'conference_landing' || currentUtm.utmContent === 'demo_cta') {
    return 'conference_landing'
  }

  if (currentUtm.utmContent === 'qr_demo' || attribution.utmContent === 'qr_demo') {
    return 'flyer_qr'
  }

  try {
    if (referrer && new URL(referrer).pathname === '/conference') return 'conference_landing'
  } catch {
    // Ignore invalid or unavailable referrers.
  }

  return 'flyer_qr'
}

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function buildConferenceDedupeKey(input: {
  eventName: ConferenceEventName
  anonymousSessionId: string
  createdAt?: Date
  ctaLocation?: string | null
  demoOrigin?: ConferenceDemoOrigin | null
  registrationKey?: string | null
}) {
  if (input.eventName === 'conference_page_view') {
    return `${input.eventName}:${input.anonymousSessionId}:${utcDay(input.createdAt || new Date())}`
  }
  if (input.eventName === 'conference_demo_open') {
    return `${input.eventName}:${input.anonymousSessionId}:${input.demoOrigin || 'unknown'}`
  }
  if (input.eventName === 'conference_register_click') {
    return `${input.eventName}:${input.anonymousSessionId}:${input.ctaLocation || 'unknown'}`
  }
  return `${input.eventName}:${input.registrationKey || input.anonymousSessionId}`
}

export function isPublicConferenceEventName(value: unknown): value is 'conference_page_view' | 'conference_register_click' {
  return value === 'conference_page_view' || value === 'conference_register_click'
}
