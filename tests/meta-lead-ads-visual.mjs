import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import { SignJWT } from 'jose'
import { PrismaClient } from '@prisma/client'

if (!process.env.META_LEAD_ADS_SYNTHETIC_DB_TEST || !/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/meta_lead_ads_qa\?schema=public$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Synthetic localhost database guard failed')
}
const db = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const org = await db.organization.create({ data: { name: 'Synthetic Visual QA', slug: `synthetic-visual-${suffix}` } })
const owner = await db.user.create({ data: { organizationId: org.id, email: `visual-${suffix}@example.invalid`,
  password: 'synthetic', name: 'Visual Owner', role: 'owner' } })

async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
const secret = 'synthetic-visual-qa-secret-1234567890123456'
const port = await freePort()
const base = `http://127.0.0.1:${port}`
const cleanEnv = Object.fromEntries(['PATH','Path','SystemRoot','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','COMSPEC'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  cwd: process.cwd(), windowsHide: true, stdio: 'ignore',
  env: { ...cleanEnv, JWT_SECRET: secret, NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: process.env.DATABASE_URL },
})
let browser
try {
  let ready = false
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Next server exited')
    try { const response = await fetch(`${base}/login`); if (response.status < 500) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error('Next server did not start')
  browser = await chromium.launch({ headless: true })
  const token = await new SignJWT({ id: owner.id, organizationId: org.id, role: 'owner', name: owner.name,
    organizationName: org.name, sessionVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))
  const labels = { ru: 'Отдельная интеграция', uk: 'Окрема інтеграція', pl: 'osobna integracja' }
  for (const width of [390, 414, 430]) for (const lang of ['ru', 'uk', 'pl']) {
    const context = await browser.newContext({ viewport: { width, height: 844 } })
    await context.addCookies([{ name: 'auth-token', value: token, url: base }])
    await context.addInitScript(value => localStorage.setItem('rezi_lang', value), lang)
    await context.route('**/api/meta-lead-ads/bindings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      appConfigured: true, globallyEnabled: false, callbackPath: '/api/webhooks/meta/lead-ads',
      bindings: [{ id: 'synthetic-binding', pageId: '111', formId: '222', enabled: false, mode: 'off',
        pilotLeadIds: [], credentialConfigured: false, counts: { shadow: 1 } }],
    }) }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${base}/settings/integrations/meta-lead-ads`, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200)
    await page.getByRole('heading', { name: /Meta Lead Ads/ }).waitFor()
    assert.match(await page.locator('h1').innerText(), new RegExp(labels[lang], 'i'))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.equal(overflow, 0, `${lang} ${width}px horizontal overflow`)
    assert.deepEqual(errors, [], `${lang} ${width}px runtime errors`)
    await context.close()
  }
  console.log('VISUAL PASS: 390/414/430 × RU/UA/PL, no overflow or runtime errors')
} finally {
  await browser?.close()
  child.kill()
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
  await db.$disconnect()
  if (child.exitCode === null && child.signalCode === null) throw new Error(`Synthetic Next server did not stop: PID ${child.pid}`)
}
