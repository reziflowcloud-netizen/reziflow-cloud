// Configuration only. No URL in this script can invoke the LegalHub application.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { notificationScheduleId, notificationQueue, qstashOrigin, notificationDestination } from '../src/lib/notificationQstash.mjs'

export async function setupNotificationQstash({ token, secret, confirmation, fetchApi = fetch, now = new Date() }) {
  assert.equal(confirmation, 'CONFIGURE_PAUSED_ONLY')
  assert.ok(token?.length >= 32 && secret?.length >= 32)
  // Bootstrap is deliberately annual and paused. The reviewed activation will
  // replace this with */15 and resume; setup cannot publish business messages.
  const january = Date.UTC(now.getUTCFullYear() + 1, 0, 1)
  assert.ok(now.getUTCMonth() !== 0 || now.getUTCDate() !== 1, 'Annual trigger day excluded')
  assert.ok(january - now.getTime() > 86400000, 'Annual safety window required')
  const api = async (path, method = 'GET', headers = {}, body) => {
    assert.ok(path.startsWith('/v2/queues') || path.startsWith('/v2/schedules'))
    const response = await fetchApi(qstashOrigin + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body }) })
    if (!response.ok) throw new Error('QStash configuration request failed')
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  const schedules = await api('/v2/schedules')
  const previous = schedules.find(s => s.scheduleId === notificationScheduleId)
  if (previous) {
    assert.equal(previous.destination, notificationDestination)
    assert.equal(previous.isPaused, true, 'Never overwrite an active schedule during preparation')
  }
  await api('/v2/queues', 'POST', {}, JSON.stringify({ queueName: notificationQueue, parallelism: 1 }))
  await api(`/v2/queues/${notificationQueue}/pause`, 'POST')
  const headers = { 'Upstash-Schedule-Id': notificationScheduleId, 'Upstash-Cron': '0 0 1 1 *', 'Upstash-Queue-Name': notificationQueue, 'Upstash-Method': 'POST', 'Upstash-Retries': '2', 'Upstash-Retry-Delay': '15000', 'Upstash-Timeout': '55s', 'Upstash-Forward-Authorization': `Bearer ${secret}`, 'Upstash-Redact-Fields': 'body,header[Authorization]' }
  const created = await api(`/v2/schedules/${notificationDestination}`, 'POST', headers, '{}')
  assert.equal(created.scheduleId, notificationScheduleId)
  await api(`/v2/schedules/${notificationScheduleId}/pause`, 'POST')
  const schedule = await api(`/v2/schedules/${notificationScheduleId}`)
  assert.equal(schedule.isPaused, true); assert.equal(schedule.destination, notificationDestination); assert.equal(schedule.method, 'POST'); assert.equal(schedule.cron, '0 0 1 1 *'); assert.equal(schedule.retries, 2)
  const auth = Object.entries(schedule.header).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
  const expected = `REDACTED:${createHash('sha256').update(`Bearer ${secret}`).digest('hex')}`
  assert.deepEqual(auth, [expected])
  return { scheduleId: notificationScheduleId, configured: true, authenticationForwarding: 'PASS', secretExposed: false, schedulePaused: true, queuePaused: true, productionGenerationInvoked: false, productionSecretRotated: false, activationPreparedCron: '*/15 * * * *', activeCadenceConfigured: false }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await setupNotificationQstash({ token: process.env.QSTASH_NOTIFICATION_SETUP_TOKEN, secret: process.env.NOTIFICATION_PRODUCTION_CRON_SECRET, confirmation: process.env.QSTASH_SETUP_CONFIRMATION })))
  } catch { console.error('QStash setup did not complete; inspect paused configuration without exposing credentials.'); process.exitCode = 1 }
}
