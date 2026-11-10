// One unauthenticated read of the pinned QA callback. Never sends a challenge,
// signature, token, payload or Lead, and never prints an upstream body/error.
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 10000)
let reader
try {
  const response = await fetch('https://unit-handsfree-carpentry.ngrok-free.dev/api/webhooks/meta/lead-ads', {
    method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal,
  })
  reader = response.body.getReader()
  const chunks = []; let size = 0
  for (;;) {
    const {done, value} = await reader.read()
    if (done) break
    if ((size += value.byteLength) > 65536) throw Error('RESPONSE_LIMIT')
    chunks.push(value)
  }
  const offline = response.status === 404 && Buffer.concat(chunks, size).includes(Buffer.from('ERR_NGROK_3200'))
  console.log(JSON.stringify({phase: 'shutdown', status: offline ? 'PASS' : 'BLOCKED', httpStatus: response.status, endpointOfflineConfirmed: offline}))
  if (!offline) process.exitCode = 1
} catch {
  console.log('{"phase":"shutdown","status":"BLOCKED","endpointOfflineConfirmed":false,"code":"PUBLIC_PROBE_INCONCLUSIVE"}')
  process.exitCode = 1
} finally {
  clearTimeout(timer)
  await reader?.cancel().catch(() => {})
  controller.abort()
}
