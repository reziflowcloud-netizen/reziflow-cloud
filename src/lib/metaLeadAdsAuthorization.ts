import { createHash, timingSafeEqual } from 'node:crypto'
import { metaNumericId } from './metaLeadAdsPolicy.ts'

type ApprovedTuple = {
  appId: string; pageId: string; formId: string; organizationId: string
  tokenSha256: string; tokenAppId: string; tokenPageId: string; formPageId: string
  verifiedAt: string
}

function allowedOrganization(mode: string, organizationId: string): boolean {
  if (mode === 'off') return true
  if (mode === 'pilot') return organizationId === process.env.META_LEAD_ADS_PILOT_ORGANIZATION_ID
  if (mode !== 'shadow' && mode !== 'live') return false
  const name = mode === 'shadow' ? 'META_LEAD_ADS_SHADOW_ORGANIZATION_IDS' : 'META_LEAD_ADS_LIVE_ORGANIZATION_IDS'
  return String(process.env[name] || '').split(',').map(value => value.trim()).filter(Boolean).includes(organizationId)
}

// Stage A authorization is a signed-off operator inventory, not OAuth consent.
// The operator verifies the token's issuing App, Page access and Form's Page in
// Meta before storing this private server-only tuple. A token rotation invalidates
// the fingerprint until the provenance has been checked again.
export function leadAdsTupleAuthorized(input: {
  appId: string; pageId: string; formId: string; organizationId: string; mode: string; pageToken: string | null
}): boolean {
  if (!input.organizationId || !allowedOrganization(input.mode, input.organizationId) || !input.pageToken) return false
  let tuples: unknown
  try { tuples = JSON.parse(process.env.META_LEAD_ADS_APPROVED_TUPLES || '') } catch { return false }
  if (!Array.isArray(tuples) || tuples.length > 100) return false
  const matching = tuples.filter((value): value is ApprovedTuple => value && typeof value === 'object' &&
    value.appId === input.appId && value.pageId === input.pageId && value.formId === input.formId &&
    value.organizationId === input.organizationId)
  if (matching.length !== 1) return false
  const approved = matching[0]
  if (!metaNumericId(approved.appId) || !metaNumericId(approved.pageId) || !metaNumericId(approved.formId) ||
      approved.tokenAppId !== approved.appId || approved.tokenPageId !== approved.pageId ||
      approved.formPageId !== approved.pageId || !/^[a-f0-9]{64}$/.test(approved.tokenSha256 || '')) return false
  const verified = Date.parse(approved.verifiedAt)
  if (!Number.isFinite(verified) || verified > Date.now() || Date.now() - verified > 30 * 86400000) return false
  const actual = createHash('sha256').update(input.pageToken).digest()
  return timingSafeEqual(actual, Buffer.from(approved.tokenSha256, 'hex'))
}
