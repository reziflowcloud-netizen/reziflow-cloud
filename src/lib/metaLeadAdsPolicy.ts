export type MetaLeadAdsEvent = { pageId: string; formId: string; leadgenId: string }

export function metaNumericId(value: unknown): string | null {
  const text = typeof value === 'string' ? value : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : ''
  return /^[1-9][0-9]{0,30}$/.test(text) ? text : null
}

// Page identity is the signed entry.id. A contradictory value.page_id is rejected.
export function collectMetaLeadAdsEvents(body: unknown): { events: MetaLeadAdsEvent[]; rejected: number } {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, any> : {}
  if (input.object !== 'page' || !Array.isArray(input.entry)) return { events: [], rejected: 1 }
  const events: MetaLeadAdsEvent[] = []
  let rejected = 0
  for (const entry of input.entry.slice(0, 20)) {
    const pageId = metaNumericId(entry?.id)
    if (!Array.isArray(entry?.changes)) { rejected++; continue }
    for (const change of entry.changes.slice(0, 20)) {
      if (change?.field !== 'leadgen') continue
      const formId = metaNumericId(change?.value?.form_id)
      const leadgenId = metaNumericId(change?.value?.leadgen_id)
      const claimedPage = change?.value?.page_id == null ? pageId : metaNumericId(change.value.page_id)
      if (!pageId || !formId || !leadgenId || claimedPage !== pageId) { rejected++; continue }
      if (events.length < 20) events.push({ pageId, formId, leadgenId })
      else rejected++
    }
  }
  if (input.entry.length > 20) rejected += input.entry.length - 20
  return { events, rejected }
}

export function leadAdsSource(platform: unknown): 'facebook_lead_ads' | 'instagram_lead_ads' | 'meta_lead_ads_unknown' {
  const value = String(platform || '').trim().toLowerCase()
  if (value === 'fb' || value === 'facebook') return 'facebook_lead_ads'
  if (value === 'ig' || value === 'instagram') return 'instagram_lead_ads'
  return 'meta_lead_ads_unknown'
}

export function pilotAllows(mode: string, leadgenId: string, allowed: string[]): boolean {
  return mode === 'live' || (mode === 'pilot' && allowed.includes(leadgenId))
}

export function metaRetryDelay(attempts: number, retryAfterSeconds?: number | null): number {
  const exponential = Math.min(3600, 30 * 2 ** Math.min(Math.max(attempts - 1, 0), 7))
  return Math.min(3600, Math.max(exponential, Number.isFinite(retryAfterSeconds) ? Math.max(0, Number(retryAfterSeconds)) : 0))
}
