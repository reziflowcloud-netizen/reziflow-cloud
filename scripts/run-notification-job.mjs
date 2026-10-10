// Approved external scheduler: every 15 minutes. No deployment cron is enabled.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

export async function runNotificationJob({ origin, secret, checkpoint, fetchPage = fetch, maxPages = 200, maxRuntimeMs = 720000, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const target = new URL(origin)
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))) throw new Error('HTTPS required')
  if (target.username || target.password || !secret || secret.length < 32) throw new Error('Valid origin and cron secret required')
  let state = { origin: target.origin, cursor: null, deliveryOnly: false }
  try {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8'))
    if (saved.origin === target.origin && (saved.cursor === null || /^(task|case|lead):[a-zA-Z0-9_-]{0,100}$/.test(saved.cursor)) && typeof saved.deliveryOnly === 'boolean') state = saved
  } catch (error) { if (error.code !== 'ENOENT') throw new Error('Invalid notification checkpoint') }
  const persist = async () => {
    await mkdir(dirname(checkpoint), { recursive: true })
    const temporary = `${checkpoint}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
    await rename(temporary, checkpoint)
  }
  const started = Date.now()
  const metrics = { pages: 0, entitiesScanned: 0, notificationsCreated: 0, pushProcessed: 0, pushDelivered: 0, complete: false }
  while (metrics.pages < maxPages && Date.now() - started < maxRuntimeMs) {
    const url = new URL('/api/internal/notifications', target)
    if (state.cursor) url.searchParams.set('cursor', state.cursor)
    if (state.deliveryOnly) url.searchParams.set('delivery', 'only')
    let response
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetchPage(url, { headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(65000) })
        if (response.ok || (response.status < 500 && response.status !== 429)) break
      } catch { response = null }
      if (attempt < 2) await pause(15000)
    }
    if (!response?.ok) throw new Error(`Notification job incomplete (HTTP ${response?.status || 'unavailable'}); checkpoint preserved`)
    const result = await response.json()
    if (result.nextCursor !== null && !/^(task|case|lead):[a-zA-Z0-9_-]{0,100}$/.test(result.nextCursor || '')) throw new Error('Invalid scheduler response')
    metrics.pages++; metrics.entitiesScanned += result.evaluated || 0; metrics.notificationsCreated += result.notificationsCreated || 0
    metrics.pushProcessed += result.push.processed; metrics.pushDelivered += result.push.delivered
    state.cursor = result.nextCursor
    if (!state.cursor) {
      if (result.push.processed < 20) { metrics.complete = true; state.deliveryOnly = false }
      else state.deliveryOnly = true
    }
    await persist()
    if (metrics.complete) break
  }
  return { ...metrics, runtimeMs: Date.now() - started }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const metrics = await runNotificationJob({ origin: process.env.NOTIFICATION_JOB_ORIGIN || '', secret: process.env.CRON_SECRET, checkpoint: resolve(process.env.NOTIFICATION_JOB_CHECKPOINT || '.qa/notification-job-checkpoint.json') })
  console.log(JSON.stringify(metrics))
  // A bounded continuation is successful; the next cadence resumes the checkpoint.
}
