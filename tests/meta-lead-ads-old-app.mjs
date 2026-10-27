import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const MAIN = 'bb0ef24186462bb4bca8e3ea9b6b1b6500a5d466'
if (process.env.META_LEAD_ADS_SYNTHETIC_DB_TEST !== '1' ||
    !/^postgresql:\/\/meta_qa@127\.0\.0\.1:\d+\/meta_lead_ads_qa\?schema=public$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Synthetic localhost database guard failed')
}

async function run(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1000) })
  child.stdout.resume()
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', resolve)
  })
  if (code !== 0) throw new Error(`Synthetic old-app command failed (${code}): ${stderr}`)
}

const root = await mkdtemp(join(tmpdir(), 'legalhub-old-app-new-db-'))
const source = process.cwd()
const db = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const org = await db.organization.create({ data: {
  name: 'Synthetic Old App Compatibility', slug: `synthetic-old-app-${suffix}`,
  settings: { leadWebhookKey: 'synthetic-old-app-webhook-key', leadWebhookEnabled: true },
} })
let server
let stopped = true
try {
  const archive = spawn('git', ['archive', '--format=tar', MAIN], {
    cwd: source, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const extract = spawn('tar', ['-xf', '-', '-C', root], {
    cwd: source, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'],
  })
  archive.stdout.pipe(extract.stdin)
  const [archiveCode, extractCode] = await Promise.all([
    new Promise(resolve => archive.on('exit', resolve)),
    new Promise(resolve => extract.on('exit', resolve)),
  ])
  assert.equal(archiveCode, 0, 'Approved main archive')
  assert.equal(extractCode, 0, 'Approved main extraction')
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DATABASE_URL, JWT_SECRET: 'synthetic-old-app-jwt-secret-1234567890',
    NEXT_TELEMETRY_DISABLED: '1' }
  await run(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    'ci', '--ignore-scripts', '--no-audit', '--no-fund'], root, env)
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], root, env)
  await run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], root, env)
  const listener = createServer()
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    cwd: root, env, windowsHide: true, stdio: 'ignore',
  })
  stopped = false
  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('Old app exited')
    try { const response = await fetch(`${base}/login`); if (response.status < 500) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(ready, true, 'Old app ready')
  const send = () => fetch(`${base}/api/webhooks/leads/${org.slug}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Reziflow-Key': 'synthetic-old-app-webhook-key',
    'Idempotency-Key': 'synthetic-old-app-event-1',
  }, body: JSON.stringify({ fullName: 'Synthetic Old App Lead', source: 'google_sheets' }) })
  assert.equal((await send()).status, 201)
  assert.equal((await send()).status, 201)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, source: 'google_sheets' } }), 1)
  console.log('OLD_APP_NEW_DB PASS: approved main binary, existing webhook, replay deduplication')
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill()
    await Promise.race([new Promise(resolve => server.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 5000))])
  }
  stopped = !server || server.exitCode !== null || server.signalCode !== null
  await db.$disconnect()
  if (stopped) await rm(root, { recursive: true, force: false })
  else throw new Error(`Synthetic old app did not stop; retained ${root}`)
}
