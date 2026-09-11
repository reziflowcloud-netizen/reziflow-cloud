export const CONFERENCE_DEMO_SESSION_MODE = 'conference_demo'
export const CONFERENCE_DEMO_SESSION_SECONDS = 60 * 60 * 4
export const CONFERENCE_DEMO_SESSION_EXPIRES_IN = '4h'

const BLOCKED_PAGE_PREFIXES = [
  '/settings',
  '/employees',
]

const BLOCKED_API_PREFIXES = [
  '/api/billing',
  '/api/cloudinary',
  '/api/export',
  '/api/fix-sequences',
  '/api/import',
  '/api/import-leads',
  '/api/lead-webhook-logs',
  '/api/lead-webhook-settings',
  '/api/meta',
  '/api/notifications/meta-messages',
  '/api/organizations',
  '/api/partner',
  '/api/referrals',
  '/api/storage-settings',
]

const BLOCKED_WRITE_API_PREFIXES = [
  '/api/case-options',
  '/api/custom-fields',
  '/api/custom-sections',
  '/api/document-templates',
  '/api/employees',
  '/api/lead-sources',
  '/api/lead-statuses',
  '/api/organization-settings',
  '/api/services',
  '/api/statuses',
  '/api/task-priorities',
  '/api/ui-section-settings',
  '/api/users',
]

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isConferenceDemoSession(user: unknown): boolean {
  return Boolean(user && typeof user === 'object' && 'sessionMode' in user
    && (user as { sessionMode?: unknown }).sessionMode === CONFERENCE_DEMO_SESSION_MODE)
}

export function isConferenceDemoPageBlocked(pathname: string) {
  return BLOCKED_PAGE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))
}

export function isConferenceDemoApiBlocked(pathname: string, method: string) {
  if (BLOCKED_API_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return true
  if (method.toUpperCase() === 'GET') return false
  if (BLOCKED_WRITE_API_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return true

  return /^\/api\/cases\/[^/]+\/documents(?:\/|$)/.test(pathname)
}
