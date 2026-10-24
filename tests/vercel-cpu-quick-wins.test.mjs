import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const workspace = resolve(import.meta.dirname, '..')

async function source(path) {
  return readFile(resolve(workspace, path), 'utf8')
}

test('Meta message polling runs only while visible at the reduced cadence', async () => {
  const notifier = await source('src/components/MetaMessageNotifier.tsx')

  assert.match(notifier, /VISIBLE_POLL_INTERVAL_MS = 30_000/)
  assert.match(notifier, /document\.visibilityState !== 'visible'/)
  assert.match(notifier, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/)
  assert.match(notifier, /clearTimer\(\)/)
  assert.match(notifier, /window\.setTimeout\(\(\) => void checkLatestMessage\(\), VISIBLE_POLL_INTERVAL_MS\)/)
  assert.doesNotMatch(notifier, /setInterval/)
})

test('non-Meta tenants stop message polling after the existing settings gate', async () => {
  const [notifier, route] = await Promise.all([
    source('src/components/MetaMessageNotifier.tsx'),
    source('src/app/api/notifications/meta-messages/route.ts'),
  ])

  assert.match(route, /getLeadWebhookSettings\(organization\.settings\)/)
  assert.match(route, /if \(!settings\.facebookMessagesEnabled\)/)
  assert.match(route, /enabled: false, latest: null/)
  assert.match(route, /m\.\"liveReceipt\"[\s\S]*LIMIT 1/)
  assert.doesNotMatch(route, /leadWebhookLogs:/)
  assert.doesNotMatch(route, /leadWebhookLog\.findFirst/)
  assert.match(notifier, /if \(data\.enabled === false\)/)
  assert.match(notifier, /pollingEnabledRef\.current = false/)
})

test('Notification Center halves background cadence and retains immediate refresh triggers', async () => {
  const center = await source('src/components/NotificationCenter.tsx')

  assert.match(center, /VISIBLE_POLL_INTERVAL_MS = 90_000/)
  assert.match(center, /setInterval\(refresh, VISIBLE_POLL_INTERVAL_MS\)/)
  assert.match(center, /if \(available\) void sync\(\)/)
  assert.match(center, /if \(!open\) return[\s\S]*void sync\(\)/)
  assert.match(center, /window\.addEventListener\('focus', returned\)/)
  assert.match(center, /document\.addEventListener\('visibilitychange', visibility\)/)
  assert.match(center, /event\.data\?\.type === 'notifications-changed'/)
})

test('middleware skips only self-authenticated infrastructure routes and public assets', async () => {
  const middleware = await source('src/middleware.ts')
  const readableMatcher = middleware.replaceAll('\\\\', '')
  const requiredExclusions = [
    'api/webhooks/leads',
    'api/webhooks/meta/leads',
    'api/webhooks/meta/messages',
    'api/webhooks/telegram/leads',
    'api/internal/notifications',
    'manifest.json',
    'notification-sw.js',
    'favicon.ico',
    'assets(?:/|$)',
  ]
  for (const route of requiredExclusions) assert.ok(readableMatcher.includes(route), `${route} must be excluded`)

  for (const protectedRoute of ['api/notifications', 'api/tasks', 'api/cases', 'api/leads', 'dashboard', 'settings']) {
    assert.equal(middleware.includes(`|${protectedRoute}`), false, `${protectedRoute} must remain protected`)
  }

  const literal = middleware.match(/matcher: \['([^']+)'\]/)?.[1]
  assert.ok(literal)
  const matcher = new RegExp(`^${JSON.parse(`"${literal}"`)}$`)
  for (const path of [
    '/api/webhooks/leads/org',
    '/api/webhooks/meta/leads/org',
    '/api/webhooks/meta/messages/org',
    '/api/webhooks/telegram/leads/org/key',
    '/api/internal/notifications',
    '/manifest.json',
    '/notification-sw.js',
    '/favicon.ico',
    '/assets/logo.svg',
  ]) assert.equal(matcher.test(path), false, `${path} must bypass middleware`)

  for (const path of [
    '/api/notifications',
    '/api/tasks',
    '/api/cases/one',
    '/dashboard',
    '/api/internal/notifications-admin',
    '/api/webhooks/leads-admin',
    '/assets-private/logo.svg',
  ]) assert.equal(matcher.test(path), true, `${path} must still use middleware`)
})

test('every middleware-exempt dynamic endpoint retains its own fail-closed authentication', async () => {
  const [generic, telegram, metaLeads, metaMessages, internal] = await Promise.all([
    source('src/lib/leadWebhookHandler.ts'),
    source('src/app/api/webhooks/telegram/leads/[slug]/[key]/route.ts'),
    source('src/app/api/webhooks/meta/leads/[slug]/route.ts'),
    source('src/app/api/webhooks/meta/messages/[slug]/route.ts'),
    source('src/app/api/internal/notifications/route.ts'),
  ])

  assert.match(generic, /if \(!keyMatches\(settings\.leadWebhookKey \|\| '', receivedKey\)\)/)
  assert.match(generic, /status: 401/)
  assert.match(telegram, /if \(!keyMatches\(settings\.leadWebhookKey \|\| '', params\.key\)\)/)
  assert.match(telegram, /status: 401/)
  assert.match(metaLeads, /verifyMetaWebhookRequestSignature\(request, 'meta'\)/)
  assert.match(metaLeads, /status: 401/)
  assert.match(metaMessages, /verifyMetaWebhookRequestSignature\(request, 'messages'\)/)
  assert.match(metaMessages, /status: 401/)
  assert.equal((internal.match(/cronAuthorized\(/g) || []).length, 2)
  assert.match(internal, /status: 401/)
})

test('Case Detail reuses one canonical tasks response for all task-derived views', async () => {
  const page = await source('src/app/cases/[id]/page.tsx')

  assert.equal((page.match(/fetch\('\/api\/tasks'/g) || []).length, 1)
  assert.match(page, /async function loadCaseTaskViews\(caseData = c\)/)
  assert.match(page, /applyPlannedPayments\(caseData, tasks\)/)
  assert.match(page, /applyMosDocuments\(caseData, tasks\)/)
  assert.match(page, /applyCaseTasks\(caseData, tasks\)/)
  assert.doesNotMatch(page, /Promise\.all\(\[loadMosDocuments\(\), loadCaseTasks\(\)\]\)/)
})
