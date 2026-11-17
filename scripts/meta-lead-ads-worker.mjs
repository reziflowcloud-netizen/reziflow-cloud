import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { readBoundedBody } from '../src/lib/boundedBody.ts'

// Foreground scheduler for an explicitly approved operator host. No Vercel cron
// or daemon is installed by this file or by the first application deployment.
export async function runWorkerScheduler({ env = process.env, fetchImpl = fetch,
  sleep = delay, report = value => console.log(JSON.stringify(value)), signal,
  maxTicks = 1440 } = {}) {
  if (env.META_LEAD_ADS_SCHEDULER_ENABLED !== 'true') return { disabled: true, ticks: 0 }
  const url = new URL(env.META_LEAD_ADS_WORKER_URL || '')
  if (url.origin !== 'https://legalhubcrm.com' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/api/internal/meta-lead-ads') throw new Error('WORKER_URL_INVALID')
  const secret = env.META_LEAD_ADS_WORKER_SECRET || ''
  if (secret.length < 32) throw new Error('WORKER_SECRET_MISSING')
  const interval = Math.max(60, Math.min(3600, Number(env.META_LEAD_ADS_SCHEDULER_INTERVAL_SECONDS) || 60))
  const cap = Math.max(1, Math.min(1440, Math.floor(maxTicks)))
  let ticks = 0, failures = 0
  while (!signal?.aborted && ticks < cap) {
    ticks++
    let waitSeconds = interval
    try {
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(55000)]) : AbortSignal.timeout(55000)
      const response = await fetchImpl(url, { method: 'POST', redirect: 'error', cache: 'no-store',
        headers: { Authorization: `Bearer ${secret}` }, signal: requestSignal })
      if (!response.ok) {
        await response.body?.cancel()
        waitSeconds = Math.max(interval, Math.min(3600, Number(response.headers.get('retry-after')) || 60))
        throw new Error('WORKER_HTTP_FAILURE')
      }
      const result = JSON.parse(new TextDecoder().decode(await readBoundedBody(response.body, 16384)))
      for (const key of ['complete', 'retry', 'blocked', 'skipped', 'pending', 'blockedTotal']) {
        if (!Number.isSafeInteger(result[key]) || result[key] < 0) throw new Error('WORKER_RESULT_INVALID')
      }
      if (result.oldestPendingSeconds !== null &&
          (!Number.isSafeInteger(result.oldestPendingSeconds) || result.oldestPendingSeconds < 0)) throw new Error('WORKER_RESULT_INVALID')
      failures = 0
      // Only aggregate counts leave the process. No identifiers, payloads or URLs.
      report({ severity: result.blockedTotal > 0 || result.oldestPendingSeconds > 300 ? 'alert' : 'info',
        code: 'META_LEAD_ADS_WORKER', complete: result.complete, pending: result.pending,
        blocked: result.blockedTotal, oldestPendingSeconds: result.oldestPendingSeconds })
    } catch {
      if (signal?.aborted) break
      failures++
      report({ severity: 'alert', code: 'META_LEAD_ADS_WORKER_UNAVAILABLE', consecutiveFailures: failures })
      if (failures >= 3) return { disabled: false, ticks, failed: true }
    }
    if (ticks < cap && !signal?.aborted) {
      try { await sleep(waitSeconds * 1000, undefined, { signal }) } catch { if (!signal?.aborted) throw new Error('SCHEDULER_WAIT_FAILED') }
    }
  }
  return { disabled: false, ticks, failed: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  process.once('SIGTERM', () => controller.abort())
  try { const result = await runWorkerScheduler({ signal: controller.signal }); if (result.failed) process.exitCode = 1 }
  catch { console.error('META_LEAD_ADS_SCHEDULER_CONFIGURATION_INVALID'); process.exitCode = 1 }
}
