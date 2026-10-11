import { createHash } from 'node:crypto'
import { runNotificationJob } from '../../scripts/run-notification-job.mjs'

export const notificationScheduleId = 'legalhub-production-notifications'
export const notificationQueue = notificationScheduleId
export const qstashOrigin = 'https://qstash-eu-central-1.upstash.io'
export const notificationDestination = 'https://legalhubcrm.com/api/internal/notifications'
export const notificationSchedules = [
  { scheduleId: notificationScheduleId, cron: '*/15 * * * *', body: {}, mode: 'frequent' },
  { scheduleId: notificationScheduleId + '-cases', cron: '0 6 * * *', body: { mode: 'daily' }, mode: 'daily' },
]
const cursorPattern = /^(?:(task|case|lead):[a-zA-Z0-9_-]{0,100}|n\.[a-zA-Z0-9_-]{1,700})$/
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/

export function continuationInput(input, messageId, origin) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid continuation')
  if (Object.keys(input).length === 0 || (Object.keys(input).join(',') === 'mode' && input.mode === 'daily')) {
    if (!idPattern.test(messageId || '')) throw new Error('Missing message identity')
    return { runId: messageId, page: 0, state: { origin, cursor: input.mode === 'daily' ? 'case:' : null, deliveryOnly: false } }
  }
  if (Object.keys(input).sort().join(',') !== 'page,runId,state' || !idPattern.test(input.runId || '') || !Number.isInteger(input.page) || input.page < 1 || input.page >= 200) throw new Error('Invalid continuation')
  const state = input.state
  if (!state || Object.keys(state).sort().join(',') !== 'cursor,deliveryOnly,origin' || state.origin !== origin || (state.cursor !== null && !cursorPattern.test(state.cursor)) || typeof state.deliveryOnly !== 'boolean' || (state.cursor && state.deliveryOnly)) throw new Error('Invalid checkpoint')
  return input
}

export async function enqueueNotificationContinuation({ token, secret, continuation, fetchApi = fetch }) {
  if (!token || token.length < 32 || !secret || secret.length < 32) throw new Error('Scheduler transport unavailable')
  // All destinations are constants, never supplied by a request or checkpoint.
  const id = createHash('sha256').update(JSON.stringify([continuation.runId, continuation.state.cursor, continuation.state.deliveryOnly])).digest('hex')
  const response = await fetchApi(`${qstashOrigin}/v2/enqueue/${notificationQueue}/${notificationDestination}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'Upstash-Method': 'POST', 'Upstash-Forward-Authorization': `Bearer ${secret}`,
      'Upstash-Retries': '2', 'Upstash-Retry-Delay': '15000', 'Upstash-Timeout': '55s',
      'Upstash-Deduplication-Id': id, 'Upstash-Redact-Fields': 'body,header[Authorization]',
    },
    body: JSON.stringify(continuation),
  })
  if (!response.ok) throw new Error('Scheduler continuation not accepted')
  const result = await response.json()
  if (!idPattern.test(result.messageId || '')) throw new Error('Invalid continuation acknowledgement')
}

export async function runQstashNotificationChunk({ input, messageId, secret, token, origin = 'https://legalhubcrm.com', fetchPage = fetch, enqueue = enqueueNotificationContinuation }) {
  const job = continuationInput(input, messageId, origin)
  let state = { ...job.state }
  const metrics = await runNotificationJob({
    origin, secret, checkpoint: '', checkpointStore: { read: async () => state, write: async next => { state = next } },
    fetchPage, maxPages: 1, maxRuntimeMs: 55000, maxAttempts: 1, requestTimeoutMs: 50000,
  })
  // A provider retry replays the same page; business dedupe/outbox leases remain
  // authoritative. Never ACK an incomplete chunk before its durable hand-off.
  if (!metrics.complete) {
    if (job.page + 1 >= 200) throw new Error('Scheduler page limit reached')
    await enqueue({ token, secret, continuation: { runId: job.runId, page: job.page + 1, state } })
  }
  return { ...metrics, runId: job.runId, page: job.page + 1, continuationQueued: !metrics.complete }
}

// Authenticated transport self-check. Both dependencies are in-memory; this
// cannot evaluate entities, publish continuations, touch a DB, or send push.
export async function diagnoseQstashNotificationTransport() {
  const cursors = [null, 'task:diagnostic25', 'case:', 'lead:']
  let input = {}, pending, page = 0
  for (let step = 0; step < cursors.length; step++) {
    pending = null
    const result = await runQstashNotificationChunk({
      input, messageId: 'diagnostic-transport',
      secret: 'synthetic-diagnostic-cron-secret-12345678',
      token: 'synthetic-diagnostic-qstash-token-12345678',
      fetchPage: async url => {
        if (url.origin !== 'https://legalhubcrm.com' || url.searchParams.get('cursor') !== cursors[page]) throw new Error('Diagnostic cursor mismatch')
        page++
        return Response.json({ evaluated: 0, notificationsCreated: 0, nextCursor: cursors[page] || null, push: { processed: 0, delivered: 0 } })
      },
      enqueue: async job => { pending = job.continuation },
    })
    if (result.complete !== (step === cursors.length - 1)) throw new Error('Diagnostic hand-off mismatch')
    if (pending) input = pending
  }
  return { diagnostic: true, generationInvoked: false, providerInvoked: false, nextCursorOrchestration: 'PASS', chunks: page }
}
