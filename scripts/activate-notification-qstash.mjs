// Configuration only: no publish/enqueue call and no business-generation request.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { notificationScheduleId as id, notificationQueue as queue, qstashOrigin, notificationDestination as destination } from '../src/lib/notificationQstash.mjs'
import { verifyNotificationTransport } from './verify-notification-transport.mjs'

export async function activateNotificationQstash({ token, secret, confirmation, fetchApi = fetch }) {
  assert.equal(confirmation, 'ACTIVATE_TESTREZIDENTS_PILOT')
  assert.ok(token?.length >= 32 && secret?.length >= 32)
  const api = async (path, method = 'GET', headers = {}, body) => {
    const allowed = ['/v2/schedules', `/v2/schedules/${id}`, `/v2/schedules/${id}/pause`, `/v2/schedules/${id}/resume`, `/v2/schedules/${destination}`, `/v2/queues/${queue}`, `/v2/queues/${queue}/pause`, `/v2/queues/${queue}/resume`]
    assert.ok(allowed.includes(path))
    const response = await fetchApi(qstashOrigin + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body }) })
    if (!response.ok) throw new Error('QStash activation configuration failed')
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  const expectedAuth = `REDACTED:${createHash('sha256').update(`Bearer ${secret}`).digest('hex')}`
  const checkSchedule = (s, cron, paused) => {
    assert.equal(s.scheduleId, id); assert.equal(s.destination, destination)
    assert.equal(s.method, 'POST'); assert.equal(s.cron, cron); assert.equal(s.isPaused, paused)
    assert.equal(s.retries, 2)
    const auth = Object.entries(s.header || {}).find(([k]) => k.toLowerCase() === 'authorization')?.[1]
    assert.deepEqual(auth, [expectedAuth])
  }
  const schedules = await api('/v2/schedules')
  assert.equal(schedules.filter(s => !s.isPaused).length, 0)
  const existing = schedules.find(s => s.scheduleId === id)
  assert.ok(existing, 'Existing schedule required; never create another schedule')
  checkSchedule(existing, '0 0 1 1 *', true)
  const existingQueue = await api(`/v2/queues/${queue}`)
  assert.equal(existingQueue.paused, true); assert.equal(existingQueue.parallelism, 1)
  assert.ok(Number.isFinite(existingQueue.lag) && existingQueue.lag <= 0, 'No pending messages allowed before activation')
  await verifyNotificationTransport({ secret, fetchApi })
  let mutationStarted = false
  try {
    // Keep delivery paused throughout the schedule upsert. The original auth is
    // supplied from the existing GitHub secret, never the redacted hash.
    mutationStarted = true
    const created = await api(`/v2/schedules/${destination}`, 'POST', {
      'Upstash-Schedule-Id': id, 'Upstash-Cron': '*/15 * * * *', 'Upstash-Queue-Name': queue,
      'Upstash-Method': 'POST', 'Upstash-Retries': '2', 'Upstash-Retry-Delay': '15000',
      'Upstash-Timeout': '55s', 'Upstash-Forward-Authorization': `Bearer ${secret}`,
      'Upstash-Redact-Fields': 'body,header[Authorization]',
    }, '{}')
    assert.equal(created.scheduleId, id)
    await api(`/v2/schedules/${id}/pause`, 'POST')
    checkSchedule(await api(`/v2/schedules/${id}`), '*/15 * * * *', true)
    assert.equal((await api(`/v2/queues/${queue}`)).paused, true)
    await api(`/v2/queues/${queue}/resume`, 'POST')
    await api(`/v2/schedules/${id}/resume`, 'POST')
    checkSchedule(await api(`/v2/schedules/${id}`), '*/15 * * * *', false)
    const resumedQueue = await api(`/v2/queues/${queue}`)
    assert.equal(resumedQueue.paused, false); assert.equal(resumedQueue.parallelism, 1)
    const finalSchedules = await api('/v2/schedules')
    assert.equal(finalSchedules.filter(s => !s.isPaused).length, 1)
    assert.equal(finalSchedules.filter(s => s.scheduleId === id).length, 1)
    return { scheduleId: id, scheduleActive: true, queueActive: true, cron: '*/15 * * * *', authenticationForwarding: 'PASS', productionSecretRotated: false, manualBusinessGenerationInvoked: false, secretValuesExposed: false }
  } catch (error) {
    if (mutationStarted) {
      // Fail closed; attempt both pauses even when one provider request fails.
      await Promise.allSettled([api(`/v2/schedules/${id}/pause`, 'POST'), api(`/v2/queues/${queue}/pause`, 'POST')])
    }
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await activateNotificationQstash({ token: process.env.QSTASH_NOTIFICATION_SETUP_TOKEN, secret: process.env.NOTIFICATION_PRODUCTION_CRON_SECRET, confirmation: process.env.QSTASH_ACTIVATION_CONFIRMATION })))
  } catch { console.error('QStash activation gate failed; verify paused state without displaying credentials.'); process.exitCode = 1 }
}
