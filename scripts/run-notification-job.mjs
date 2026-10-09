// Run from an approved external scheduler. Never stores or prints the secret.
const origin = new URL(process.env.NOTIFICATION_JOB_ORIGIN || '')
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('HTTPS required')
if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) throw new Error('Cron secret required')
let cursor = null
let deliveryOnly = false
for (let page = 0; page < 2000; page++) {
  const url = new URL('/api/internal/notifications', origin)
  if (cursor) url.searchParams.set('cursor', cursor)
  if (deliveryOnly) url.searchParams.set('delivery', 'only')
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, redirect: 'error', signal: AbortSignal.timeout(65000) })
  if (!response.ok) throw new Error(`Notification job HTTP ${response.status}`)
  const result = await response.json()
  cursor = result.nextCursor
  if (!cursor) {
    if (result.push.processed < 20) { console.log('Notification job complete'); process.exit(0) }
    deliveryOnly = true
  }
}
throw new Error('Notification job page limit reached; rerun to continue safely')
