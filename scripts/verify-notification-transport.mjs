// Production verification only: authenticated POST must explicitly select the
// in-memory diagnostic. Never invoke an authenticated legacy GET or a sweep.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const target = 'https://legalhubcrm.com/api/internal/notifications'
export async function verifyNotificationTransport({ secret, fetchApi = fetch }) {
  assert.ok(secret?.length >= 32)
  const request = async (method, authorization) => fetchApi(target, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ mode: 'diagnostic' }) } : {}),
  })
  for (const method of ['GET', 'POST']) for (const auth of [undefined, 'Bearer intentionally-invalid-diagnostic-auth']) {
    assert.equal((await request(method, auth)).status, 401)
  }
  const response = await request('POST', `Bearer ${secret}`)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.deepEqual(result, { diagnostic: true, generationInvoked: false, providerInvoked: false, nextCursorOrchestration: 'PASS', chunks: 4 })
  return { unauthorizedBlocked: true, legacyGetAuth: 'PASS', diagnosticPost: 'PASS', httpStatus: 200, nextCursorOrchestration: 'PASS', generationInvoked: false, providerInvoked: false, secretValuesExposed: false }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await verifyNotificationTransport({ secret: process.env.NOTIFICATION_PRODUCTION_CRON_SECRET }))) }
  catch { console.error('Production diagnostic transport verification failed; no credentials or response bodies printed.'); process.exitCode = 1 }
}
