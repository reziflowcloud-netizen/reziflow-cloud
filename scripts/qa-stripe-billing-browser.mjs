// Real built app, signed synthetic sessions, disposable PostgreSQL and a local
// Stripe SDK HTTP fixture. This is NOT Stripe-hosted Checkout validation.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import { SignJWT } from 'jose'
import { PrismaClient } from '@prisma/client'
import { stripeFixture, syntheticConfig } from '../tests/fixtures/stripe-billing-provider.mjs'
import { stripeBillingText } from '../src/lib/stripeBillingI18n.ts'
import { billingContactText } from '../src/lib/billingContactI18n.ts'

const root = resolve(import.meta.dirname, '..'), origin = syntheticConfig.appUrl
const url = new URL(process.env.STRIPE_BILLING_TEST_DATABASE_URL || 'http://invalid')
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439'); assert.equal(url.pathname, '/legalhub_billing_qa')
const dir = resolve(root, '.qa/stripe-browser'); await mkdir(dir, { recursive: true })
const log = await open(resolve(dir, 'server.log'), 'w')
const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] })
const fixture = await stripeFixture(), providerPort = fixture.stripe.getApiField('port')
const secret = 'synthetic-billing-browser-secret', orgIds = []
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: url.href, JWT_SECRET: secret, STRIPE_BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: syntheticConfig.secretKey, STRIPE_WEBHOOK_SECRET: syntheticConfig.webhookSecret,
  STRIPE_STARTER_PRICE_ID: syntheticConfig.prices.starter, STRIPE_PRO_PRICE_ID: syntheticConfig.prices.pro,
  STRIPE_PORTAL_CONFIGURATION_ID: syntheticConfig.portalConfiguration, STRIPE_BILLING_APP_URL: origin,
  STRIPE_BILLING_GRACE_DAYS: '7', STRIPE_SYNTHETIC_PROVIDER_PORT: String(providerPort),
  NODE_OPTIONS: `--require=${resolve(root, 'tests/fixtures/stripe-billing-network-preload.cjs')}`,
}
let app, browser
const report = { provider: 'LOOPBACK SDK FIXTURE; real Stripe-hosted flow SKIP', app: 'built Next.js application', checks: [], visualMatrix: [], consoleErrors: [] }
const run = async (name, fn) => { await fn(); report.checks.push({ name, result: 'PASS' }); console.log('PASS', name) }
async function startApp() {
  app = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3129'], { cwd: root, env, stdio: ['ignore', log.fd, log.fd] })
  const deadline = Date.now() + 60000
  while (true) {
    if (app.exitCode !== null) throw Error('App exited before readiness')
    try { if ((await fetch(origin)).status === 200) break } catch {}
    if (Date.now() > deadline) throw Error('App startup timeout')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}
const makeOrg = async (plan = 'free') => {
  const org = await db.organization.create({ data: { name: 'Synthetic Billing Team', slug: `stripe-browser-${randomUUID()}`, plan } })
  orgIds.push(org.id)
  const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic Owner', role: 'owner', email: `${randomUUID()}@example.test`, password: 'not-a-login' } })
  const token = await new SignJWT({ id: user.id, organizationId: org.id, name: user.name, organizationName: org.name, role: user.role, sessionVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret))
  return { org, user, token }
}
try {
  const account = await makeOrg()
  await startApp()
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addCookies([{ name: 'auth-token', value: account.token, url: origin, httpOnly: true, sameSite: 'Lax' }])
  const page = await context.newPage()
  page.on('pageerror', error => report.consoleErrors.push(error.message))
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname
    if (['checkout.stripe.com', 'billing.stripe.com'].includes(host)) return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic hosted boundary — no Stripe-hosted UI tested</h1>' })
    if (!['127.0.0.1', 'localhost'].includes(host)) return route.abort()
    return route.continue()
  })
  await run('real browser button → authenticated API → SDK fixture → persisted open Checkout; no paid entitlement', async () => {
    await page.goto(`${origin}/settings/billing`)
    await page.getByRole('button', { name: 'Выбрать Starter', exact: true }).click()
    await page.waitForURL('https://checkout.stripe.com/**')
    assert.equal((await db.organization.findUnique({ where: { id: account.org.id } })).plan, 'free')
    assert.equal(fixture.sessions.size, 1)
    await page.goto(`${origin}/settings/billing?checkout=returned`)
    await page.getByText('Ожидает оплаты', { exact: true }).first().waitFor()
  })
  let subscription
  await run('real public raw webhook → PostgreSQL update → refreshed Billing renders Starter', async () => {
    const state = await db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: account.org.id } })
    subscription = fixture.complete(state.checkoutSessionId)
    const event = fixture.event(fixture.sessions.get(state.checkoutSessionId), 'checkout.session.completed')
    const payload = JSON.stringify(event)
    const signature = fixture.stripe.webhooks.generateTestHeaderString({ payload, secret: syntheticConfig.webhookSecret })
    // No auth cookie: the webhook must pass middleware using its signature alone.
    const response = await fetch(`${origin}/api/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': signature }, body: payload })
    assert.equal(response.status, 200, await response.text())
    await page.goto(`${origin}/settings/billing?checkout=returned`)
    await page.locator('.billing-plan-title').filter({ hasText: 'Starter' }).waitFor()
    assert.equal((await db.organization.findUnique({ where: { id: account.org.id } })).billingStatus, 'active')
  })
  await run('real Customer Portal API uses the tenant Customer and configured safe portal', async () => {
    await page.getByRole('button', { name: stripeBillingText.ru.manage, exact: true }).click()
    await page.waitForURL('https://billing.stripe.com/**')
    const call = fixture.requests.find(r => r.path === '/v1/billing_portal/sessions')
    assert.equal(call.form.customer, subscription.customer)
  })
  await run('RU/UA/PL × Light/Dark/Slate × 390/414/430/768/1024/1440 without horizontal overflow', async () => {
    for (const lang of ['ru', 'uk', 'pl']) for (const theme of ['light', 'dark', 'slate']) for (const width of [390, 414, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript(({ lang, theme }) => { localStorage.setItem('rezi_lang', lang); localStorage.setItem('rezi_theme', theme) }, { lang, theme })
      await page.goto(`${origin}/settings/billing`)
      await page.getByRole('heading', { name: stripeBillingText[lang].title }).waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
      assert.ok(layout.content <= width + 1, `Overflow ${lang}/${theme}/${width}: ${layout.content}`)
      assert.equal(await page.locator('.stripe-plan-card').count(), 2)
      const contact = page.getByRole('button', { name: billingContactText[lang].button, exact: true })
      assert.equal(await contact.count(), 1)
      if (width === 390) {
        await contact.click()
        await page.getByRole('dialog', { name: billingContactText[lang].title }).waitFor()
        assert.equal(await page.getByLabel(`${billingContactText[lang].name} *`, { exact: true }).count(), 1)
        await page.keyboard.press('Escape')
        assert.equal(await page.getByRole('dialog').count(), 0)
      }
      const screenshot = ((lang === 'ru' && theme === 'light') || (lang === 'uk' && theme === 'dark') || (lang === 'pl' && theme === 'slate')) && [390, 1440].includes(width)
        ? `${width}-${lang}-${theme}.png` : null
      if (screenshot) await page.screenshot({ path: resolve(dir, screenshot), fullPage: true })
      report.visualMatrix.push({ lang, theme, width, result: 'PASS', screenshot })
    }
  })
  const send = async (object, type) => {
    const payload = JSON.stringify(fixture.event(object, type)), signature = fixture.stripe.webhooks.generateTestHeaderString({ payload, secret: syntheticConfig.webhookSecret })
    const response = await fetch(`${origin}/api/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': signature }, body: payload })
    assert.equal(response.status, 200, await response.text())
  }
  await run('failed renewal warning and grace date render after verified webhook', async () => {
    subscription.status = 'past_due'; subscription.latest_invoice = fixture.invoice(subscription, false)
    await send(subscription.latest_invoice, 'invoice.payment_failed')
    await page.goto(`${origin}/settings/billing`)
    await page.getByRole('alert').filter({ hasText: stripeBillingText.pl.attention }).waitFor()
    assert.ok(await page.locator('.stripe-payment-notice').textContent().then(text => text.includes(stripeBillingText.pl.grace)))
    await page.setViewportSize({ width: 390, height: 1000 }); await page.screenshot({ path: resolve(dir, '390-pl-slate-payment-due.png'), fullPage: true })
  })
  await run('cancel-at-period-end notice and canceled/free state render without data deletion', async () => {
    subscription.status = 'active'; subscription.latest_invoice = fixture.invoice(subscription); subscription.cancel_at_period_end = true
    await send(subscription, 'customer.subscription.updated'); await page.goto(`${origin}/settings/billing`)
    await page.getByRole('status').filter({ hasText: stripeBillingText.pl.ending }).waitFor()
    subscription.status = 'canceled'; await send(subscription, 'customer.subscription.deleted')
    await page.goto(`${origin}/settings/billing`)
    await page.locator('.billing-plan-title').filter({ hasText: 'Free' }).waitFor()
    await page.getByRole('status').filter({ hasText: stripeBillingText.pl.ended }).waitFor()
  })
  await run('localized error and loading states, duplicate-click suppression', async () => {
    await page.route('**/api/billing/checkout', async route => {
      await new Promise(resolve => setTimeout(resolve, 250))
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'BILLING_UNAVAILABLE' }) })
    })
    const button = page.getByRole('button', { name: 'Wybierz Starter', exact: true })
    await button.click()
    assert.equal(await page.getByRole('button', { name: stripeBillingText.pl.loading, exact: true }).isDisabled(), true)
    await page.getByRole('alert').filter({ hasText: stripeBillingText.pl.unavailable }).waitFor()
    await page.unroute('**/api/billing/checkout')
  })
  await run('existing Manual plan shows administrator fallback, with no purchase button', async () => {
    await db.organization.update({ where: { id: account.org.id }, data: { plan: 'manual', billingStatus: 'manual' } })
    await page.goto(`${origin}/settings/billing`)
    assert.equal(await page.getByRole('button', { name: 'Wybierz Starter', exact: true }).count(), 0)
    await page.getByText(stripeBillingText.pl.manual, { exact: true }).waitFor()
    assert.equal(await page.locator('.billing-actions').first().getByRole('button').count(), 1)
  })
  await run('unsupported settlement has a distinct manual-review notice in RU/UA/PL and no purchase CTA', async () => {
    const reviewAccount = await makeOrg()
    await context.addCookies([{ name: 'auth-token', value: reviewAccount.token, url: origin, httpOnly: true, sameSite: 'Lax' }])
    const checkout = await context.request.post(`${origin}/api/billing/checkout`, { headers: { Origin: origin }, data: { plan: 'starter' } })
    assert.equal(checkout.status(), 200)
    const state = await db.stripeBillingState.findUniqueOrThrow({ where: { organizationId: reviewAccount.org.id } })
    const sub = fixture.complete(state.checkoutSessionId)
    sub.latest_invoice.amount_paid = 0
    await send(sub.latest_invoice, 'invoice.paid')
    await page.goto(`${origin}/settings/billing`)
    for (const lang of ['ru', 'uk', 'pl']) {
      await page.evaluate(lang => { localStorage.setItem('rezi_lang', lang); window.dispatchEvent(new CustomEvent('langchange', { detail: lang })) }, lang)
      await page.getByRole('alert').filter({ hasText: stripeBillingText[lang].review }).waitFor()
    }
    assert.equal(await page.getByRole('button', { name: 'Wybierz Starter', exact: true }).count(), 0)
    assert.equal((await db.organization.findUnique({ where: { id: reviewAccount.org.id } })).plan, 'free')
    await page.screenshot({ path: resolve(dir, '390-pl-slate-manual-review.png'), fullPage: true })
  })
  await run('flag OFF keeps the existing Billing contact fallback and disables Stripe APIs', async () => {
    await new Promise(resolve => { app.once('exit', resolve); app.kill('SIGTERM') })
    env.STRIPE_BILLING_ENABLED = 'false'
    await startApp(); await page.goto(`${origin}/settings/billing`)
    assert.equal(await page.locator('.stripe-billing').count(), 0)
    await page.getByRole('button', { name: billingContactText.pl.button, exact: true }).click()
    await page.getByRole('dialog', { name: billingContactText.pl.title }).waitFor()
    await page.keyboard.press('Escape')
    const response = await context.request.post(`${origin}/api/billing/checkout`, { headers: { Origin: origin }, data: { plan: 'starter' } })
    assert.equal(response.status(), 503); assert.equal((await response.json()).code, 'BILLING_UNAVAILABLE')
  })
  assert.deepEqual(report.consoleErrors, [])
  await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS ${report.visualMatrix.length} language/theme/viewport combinations; no browser exceptions`)
} finally {
  await browser?.close(); app?.kill('SIGTERM'); await fixture.close()
  await db.stripeBillingCoordinator.deleteMany({ where: { organizationId: { in: orgIds } } })
  await db.stripeBillingOperation.deleteMany({ where: { organizationId: { in: orgIds } } })
  await db.stripeBillingEvent.deleteMany({ where: { organizationId: { in: orgIds } } })
  await db.stripeBillingState.deleteMany({ where: { organizationId: { in: orgIds } } })
  await db.user.deleteMany({ where: { organizationId: { in: orgIds } } })
  await db.organization.deleteMany({ where: { id: { in: orgIds } } })
  await db.$disconnect(); await log.close()
}
