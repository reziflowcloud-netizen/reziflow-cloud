// Server-only rollout policy. Intake, worker and tenant activation are separate gates.
export function metaLeadAdsFeatureEnabled(organizationId: string | null | undefined): boolean {
  return process.env.META_LEAD_ADS_UI_ENABLED === 'true' && Boolean(organizationId) &&
    String(process.env.META_LEAD_ADS_UI_ORGANIZATION_IDS || '').split(',').map(id => id.trim())
      .filter(Boolean).includes(organizationId!)
}

// Internal QA resources must never become a customer's binding, even by mistake.
export function isInternalQaMetaResource(appId: string, pageId = '', formId = ''): boolean {
  return ['1160353550276176', '2523488421395251'].includes(appId) ||
    pageId === '1449474971582722' || formId === '2046130655900851'
}
