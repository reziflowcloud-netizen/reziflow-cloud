import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'

if (!process.env.META_LEAD_ADS_SYNTHETIC_OLD_DB_TEST ||
    !/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/meta_lead_ads_old_qa\?schema=public$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Synthetic OLD DB guard failed')
}
const db = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const org = await db.organization.create({ data: { name: 'Synthetic Old DB', slug: `synthetic-old-db-${suffix}` } })
const owner = await db.user.create({ data: { organizationId: org.id, email: `old-${suffix}@example.invalid`,
  password: 'synthetic', name: 'Old DB Owner', role: 'owner' } })
const listener = createServer()
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const base = `http://127.0.0.1:${port}`
const secret = 'synthetic-old-db-jwt-secret-1234567890'
const cleanEnv = Object.fromEntries(['PATH','Path','SystemRoot','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','COMSPEC']
  .filter(key => process.env[key]).map(key => [key, process.env[key]]))
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
  cwd: process.cwd(), windowsHide: true, stdio: 'ignore', env: { ...cleanEnv,
    DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: secret, NEXT_TELEMETRY_DISABLED: '1' },
})
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Synthetic Next server exited')
    try { const response = await fetch(`${base}/login`); if (response.status < 500) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(ready, true)
  const token = await new SignJWT({ id: owner.id, organizationId: org.id, role: 'owner', sessionVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))
  const response = await fetch(`${base}/api/meta-lead-ads/bindings`, { headers: { Cookie: `auth-token=${token}` } })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error, 'SCHEMA_NOT_READY')
  console.log('NEW_APP_OLD_DB PASS: controlled 503 SCHEMA_NOT_READY')
} finally {
  child.kill()
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
  await db.$disconnect()
  if (child.exitCode === null && child.signalCode === null) throw new Error(`Synthetic Next server did not stop: PID ${child.pid}`)
}
