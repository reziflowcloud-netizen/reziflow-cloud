// UI-only synthetic API smoke. No database/authentication/security evidence.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import sourceEvidence from './actualization-source-evidence.cjs'
import { actualizationTitles } from '../src/lib/documentActualizationPolicy.ts'
const origin = 'http://127.0.0.1:3119',
  caseId = 'synthetic-actualization',
  endpoint = origin + '/api/cases/' + caseId,
  report = {
    sourceDigest:sourceEvidence.digest('src'),
  mode: 'UI-only actual components / server-memory fixtures; no DB or auth-security proof',
    matrix: [],
    checks: [],
    errors: [],
  }
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
})
try {
  const ctx = await browser.newContext(),
    page = await ctx.newPage()
  page.on('pageerror', (e) => report.errors.push(e.message))
  await ctx.request.post(origin + '/api/mock/control', { data: { action: 'reset' } })
  let lang = 'ru'
  const section = () => page.locator('[data-section-key="case-doc-updates"]:visible'),
    status = () => section().locator('[data-document-actualization-state]'),
    title = () =>
      page.getByText(actualizationTitles[lang], { exact: true }).filter({ visible: true }).first(),
    receipt = () =>
      page
        .locator('label:visible')
        .filter({
          hasText: { ru: 'Решение получено', uk: 'Децизія отримана', pl: 'Decyzja otrzymana' }[
            lang
          ],
        })
        .locator('input[type=checkbox]')
  const open = async () => {
    await page.goto(origin + '/cases/' + caseId)
    await page
      .locator('.case-detail-desktop-presentation:visible,[data-mobile-case-detail]:visible')
      .first()
      .waitFor()
    if (await page.locator('[data-mobile-case-detail]').isVisible())
      await section().locator('button').first().click()
    await status().waitFor()
  }
  const mos = async () => {
    if (await page.locator('[data-mobile-case-detail]').isVisible()) {
      const node = page.locator('[data-section-key="case-mos"]')
      if (!(await node.locator('input[type=checkbox]').first().isVisible()))
        await node.locator('button').first().click()
    }
  }
  for (const [width, l, theme] of [
    [1440, 'ru', 'light'],
    [1440, 'uk', 'dark'],
    [1024, 'pl', 'slate'],
    [390, 'ru', 'dark'],
    [414, 'uk', 'slate'],
    [430, 'pl', 'light'],
  ]) {
    lang = l
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(
      ({ lang, theme }) => {
        localStorage.setItem('rezi_lang', lang)
        localStorage.setItem('rezi_theme', theme)
      },
      { lang, theme },
    )
    await open()
    await title().waitFor()
    await mos()
    for (const value of [true, false]) {
      const res = page.waitForResponse(
        (r) => r.url() === endpoint && r.request().method() === 'PATCH',
      )
      await receipt().setChecked(value)
      assert.equal((await res).status(), 200)
      if (value) await title().waitFor({ state: 'hidden' })
      else await title().waitFor()
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    await page.goto(origin + '/tasks')
    await title().waitFor()
    await page.goto(origin + '/calendar')
    await title().waitFor()
    report.matrix.push({
      width,
      lang,
      theme,
      immediateStopResume: true,
      tasksCalendarLocalized: true,
      overflow: false,
    })
    console.log('PASS UI-only matrix', width, lang, theme)
  }
  await open()
  const input = section().locator('input[type=date]'),
    text = section().locator('input:not([type])'),
    button = input.locator('xpath=..').locator('button').first()
  await input.fill('2026-10-01')
  await text.fill('Synthetic UI correction')
  let response = page.waitForResponse(
    (r) => r.url() === endpoint + '/doc-updates' && r.request().method() === 'POST',
  )
  await button.click()
  assert.equal((await response).status(), 200)
  await page.waitForTimeout(200)
  await section().locator('button').filter({ hasText: '✎' }).first().click()
  await input.fill('2026-10-02')
  response = page.waitForResponse(
    (r) => r.url().startsWith(endpoint + '/doc-updates/') && r.request().method() === 'PATCH',
  )
  await button.click()
  assert.equal((await response).status(), 200)
  await page.waitForTimeout(200)
  response = page.waitForResponse(
    (r) => r.url().startsWith(endpoint + '/doc-updates/') && r.request().method() === 'DELETE',
  )
  await section()
    .locator('button')
    .filter({ hasText: /^(×|🗑)$/ })
    .first()
    .click()
  assert.equal((await response).status(), 200)
  report.checks.push('actual DocUpdate UI add/correct/delete against synthetic API')
  await mos()
  await ctx.request.post(origin + '/api/mock/control', { data: { action: 'fail' } })
  await receipt().check()
  await page.locator('.case-save-status[data-state="error"]:visible').waitFor()
  assert.equal(await receipt().isChecked(), true)
  await ctx.request.post(origin + '/api/mock/control', { data: { action: 'recover' } })
  await page.getByRole('button', { name: 'Ponów', exact: true }).filter({ visible: true }).click()
  await page.waitForFunction(
    async () =>
      !!(await (await fetch('/api/cases/synthetic-actualization')).json()).decisionReceived,
  )
  report.checks.push('mock failure retains draft; existing Retry saves')
  await ctx.request.post(origin + '/api/mock/control', { data: { action: 'external' } })
  await receipt().uncheck()
  await page.locator('.case-save-status[data-state="conflict"]:visible').waitFor()
  report.checks.push('mock CAS conflict surfaced by actual autosave UI')
  assert.deepEqual(report.errors, [])
  assert.equal(sourceEvidence.digest('src'),report.sourceDigest)
  report.result = 'PASS'
  await fs.mkdir('work/actualization-evidence', { recursive: true })
  await fs.writeFile('work/actualization-evidence/ui-only.json', JSON.stringify(report, null, 2))
  console.log('PASS UI-only harness')
} finally {
  await browser.close()
}
