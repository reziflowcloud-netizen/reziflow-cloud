// Isolated browser QA of the actual Case page/components. No CRM server or real database.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const assert = require('node:assert/strict')
const bundledWebpack = require('next/dist/compiled/webpack/webpack')
bundledWebpack.init()

async function main() {
  const deps = process.env.LEGALHUB_QA_NODE_MODULES
  if (!deps) throw new Error('Set LEGALHUB_QA_NODE_MODULES to the bundled Node package directory')
  const { chromium } = require(path.join(deps, 'playwright'))
  const root = process.cwd()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'legalhub-mobile-qa-'))
  const src = path.join(root, 'src').replaceAll('\\', '/')
  const baseline = process.env.LEGALHUB_QA_BASELINE === '1'
  const baselineAll = process.env.LEGALHUB_QA_BASELINE_ALL === '1'
  let casePage = src + '/app/cases/[id]/page.tsx'
  if (baseline) {
    const { execFileSync } = require('node:child_process')
    const original = execFileSync('git', ['show', '928d8760b0dec553c61452be8ddbd309fc0bb3ad:src/app/cases/[id]/page.tsx'], { encoding: 'utf8' })
      .replace("from '../CaseMobileAccessContext'", `from ${JSON.stringify(src + '/app/cases/CaseMobileAccessContext.tsx')}`)
      .replace("from './CaseDetailMobile'", `from ${JSON.stringify(src + '/app/cases/[id]/CaseDetailMobile.tsx')}`)
    casePage = path.join(dir, 'baseline-page.tsx').replaceAll('\\', '/')
    await fs.writeFile(casePage, original)
  }
  await fs.writeFile(path.join(dir, 'entry.tsx'), `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import CasePage from ${JSON.stringify(casePage)};
    import MobileExperience from ${JSON.stringify(src + '/components/MobileExperience.tsx')};
    import SystemTheme from ${JSON.stringify(src + '/components/SystemTheme.tsx')};
    import { themeBootScript } from ${JSON.stringify(src + '/lib/themeBoot.ts')};
    import { LanguageProvider } from ${JSON.stringify(src + '/context/LanguageContext.tsx')};
    import ${JSON.stringify(src + '/app/globals.css')};
    new Function(themeBootScript)();
    createRoot(document.getElementById('root')!).render(<LanguageProvider><SystemTheme/><MobileExperience/><div style={{display:'flex'}}><div className="main-content" style={{flex:1}}><CasePage/></div></div><a href="/clients" id="qa-navigate">Clients</a></LanguageProvider>);
  `)
  await fs.writeFile(path.join(dir, 'navigation.js'), `
    export const useParams=()=>({id:'case1'}); export const usePathname=()=>'/cases/case1';
    const router={push:url=>window.qaNavigation=url, refresh:()=>{}}; export const useRouter=()=>router;
  `)
  await fs.writeFile(path.join(dir, 'link.js'), `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`)
  await fs.writeFile(path.join(dir, 'ts-loader.cjs'), `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}`)
  await fs.writeFile(path.join(dir, 'css-loader.cjs'), `module.exports=function(source){let names={},globals=[];if(this.resourcePath.endsWith('.module.css')){const prefix='qa-'+require('path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'-';source=source.replace(/:global\\(([^)]+)\\)/g,(_,s)=>{globals.push(s);return 'QAGLOBAL'+(globals.length-1)+'END'}).replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{names[n]=prefix+n;return '.'+names[n]}).replace(/QAGLOBAL(\\d+)END/g,(_,n)=>globals[n])}return 'const css='+JSON.stringify(source)+';const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);export default '+JSON.stringify(names)}`)
  await new Promise((resolve, reject) => bundledWebpack.webpack({
    mode: 'development', entry: path.join(dir, 'entry.tsx'), output: { path: dir, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'], modules: [path.join(root, 'node_modules')], alias: { '@': path.join(root, 'src'), 'next/navigation': path.join(dir, 'navigation.js'), 'next/link': path.join(dir, 'link.js') } },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(dir, 'ts-loader.cjs') }, { test: /\.css$/, use: path.join(dir, 'css-loader.cjs') }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
  const server = http.createServer(async (req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(await fs.readFile(path.join(dir, 'bundle.js'))); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f5f7"><meta name="apple-mobile-web-app-status-bar-style" content="default"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const results = []
  const widths = process.env.LEGALHUB_QA_WIDTHS ? process.env.LEGALHUB_QA_WIDTHS.split(',').map(Number) : [390, 414, 430, 1024, 1440]
  try {
    for (const width of baseline ? [1024] : widths) {
      for (const theme of baseline && !baselineAll ? ['light'] : ['light', 'dark', 'slate']) {
        for (const lang of baseline && !baselineAll ? ['ru'] : ['ru', 'uk', 'pl']) {
          const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 768 })
          const errors = []
          page.on('pageerror', error => errors.push(error.message))
          const record = { id: 'case1', updatedAt: '2026-10-08T10:00:00.000Z', caseNumber: 'QA-1', status: 'Новый', serviceId: 1, notes: '', personalAppearanceNote: 'clear me', client: { firstName: 'Test', lastName: 'Client' }, service: { id: 1, name: 'Service' }, payments: [], comments: [], statusHistory: [], customDates: [], docUpdates: [], caseDocuments: [] }
          const writes = []; let reads = 0, offline = false, readDelay = 0
          await page.route('**/api/**', async route => {
            const url = new URL(route.request().url())
            let data = []
            if (url.pathname === '/api/cases/case1') {
              if (route.request().method() === 'PATCH') {
                if (offline) return route.abort('internetdisconnected')
                const patch = route.request().postDataJSON(); writes.push(patch)
                if (patch.expectedUpdatedAt !== record.updatedAt) return route.fulfill({ status: 409, json: { error: 'CASE_CONFLICT' } })
                Object.assign(record, patch, { updatedAt: new Date(new Date(record.updatedAt).getTime() + 1).toISOString() }); delete record.expectedUpdatedAt
              } else {
                reads++
                const snapshot = JSON.parse(JSON.stringify(record))
                if (readDelay) { await new Promise(resolve => setTimeout(resolve, readDelay)); return route.fulfill({ json: snapshot }) }
              }
              data = record
            } else if (url.pathname === '/api/services') data = [{ id: 1, name: 'Service', active: true }, { id: 2, name: 'Other', active: true }]
            else if (url.pathname === '/api/statuses') data = [{ name: 'Новый', color: '#aaa' }]
            else if (url.pathname === '/api/auth/me') data = { role: 'admin', name: 'QA' }
            else if (url.pathname === '/api/organization-settings') data = { settings: {} }
            else if (url.pathname === '/api/custom-field-values') data = { sections: [] }
            else if (url.pathname === '/api/ui-section-settings') data = { settings: [] }
            await route.fulfill({ json: data })
          })
          await page.addInitScript(({ theme, lang }) => { try { localStorage.setItem('rezi_theme', theme); localStorage.setItem('rezi_lang', lang) } catch {} }, { theme, lang })
          await page.goto(origin)
          const input = width < 768 ? page.locator('[data-section-key="case-basic"] input').first() : page.locator('input:visible').first()
          await input.waitFor({ state: 'visible' })
          if (!baseline) {
          await input.fill('QA-new')
          await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved').catch(async error => {
            console.error({ width, theme, lang, writes, errors, status: await page.locator('.case-save-status').textContent() })
            throw error
          })
          assert.equal(writes.length, 1); assert.equal(writes[0].caseNumber, 'QA-new'); assert.equal(Object.keys(writes[0]).length, 3)
          assert.ok((await page.locator('.case-save-status:visible').textContent()).includes({ ru: '✓ Сохранено', uk: '✓ Збережено', pl: '✓ Zapisano' }[lang]))
          assert.equal(await page.locator('.app-refresh-indicator').count(), 0)
          }
          const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth, meta: document.querySelector('meta[name="theme-color"]').content }))
          if (size.scroll > size.viewport && theme === 'light' && lang === 'ru') {
            await page.screenshot({ path: path.join(dir, `overflow-${width}.png`), fullPage: true })
            console.error({ artifacts: dir, width, theme, lang, wide: await page.evaluate(() => Array.from(document.querySelectorAll('body *')).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > innerWidth + 1).slice(0, 15)) })
          }
          assert.equal(size.meta, { light: '#f4f5f7', dark: '#111827', slate: '#07111d' }[theme])
          if (width === 390 && theme === 'dark' && lang === 'uk') {
            await page.screenshot({ path: path.join(dir, 'mobile-dark-uk.png'), fullPage: true })
            await page.locator('[data-section-key="case-basic"] select').first().selectOption('2')
            await page.locator('[data-section-key="case-important-dates"] input[type="date"]').nth(4).fill('2026-10-09')
            await page.locator('[data-section-key="case-important-dates"] input:not([type])').first().fill('')
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved')
            assert.equal(record.serviceId, '2'); assert.equal(record.personalAppearDate, '2026-10-09'); assert.equal(record.personalAppearanceNote, '')
            await page.reload(); await input.waitFor({ state: 'visible' })
            assert.equal(await page.locator('[data-section-key="case-important-dates"] input[type="date"]').nth(4).inputValue(), '2026-10-09')
            const beforeManual = writes.length
            await input.fill('manual-flush')
            await page.locator('button[class*="saveButton"]:visible').click()
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved')
            await page.waitForTimeout(1000)
            assert.equal(writes.length, beforeManual + 1); assert.equal(record.caseNumber, 'manual-flush')
            await input.fill('leave-flush')
            await page.locator('#qa-navigate').click()
            await page.waitForFunction(() => window.qaNavigation === '/clients')
            assert.equal(record.caseNumber, 'leave-flush')
            await input.fill('app-back-flush')
            await page.locator('button[class*="circleButton"]').first().click()
            await page.waitForFunction(() => window.qaNavigation === '/cases')
            assert.equal(record.caseNumber, 'app-back-flush')
            const before = reads
            await input.fill('refresh-dirty')
            await page.evaluate(() => window.dispatchEvent(new Event('legalhub:refresh')))
            await page.waitForTimeout(50); assert.equal(reads, before)
            assert.equal(await input.inputValue(), 'refresh-dirty')
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved')
            await page.evaluate(() => window.dispatchEvent(new Event('legalhub:refresh')))
            await page.waitForFunction(expected => document.querySelector('input')?.value === expected, 'refresh-dirty')
            assert.ok(reads > before)
            readDelay = 1500
            await page.evaluate(() => window.dispatchEvent(new Event('legalhub:refresh')))
            await page.waitForTimeout(50); await input.fill('edit-during-refresh')
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved')
            await page.waitForTimeout(1600)
            assert.equal(await input.inputValue(), 'edit-during-refresh'); readDelay = 0
            await input.blur(); await page.evaluate(() => window.scrollTo(0, 0))
            const gesture = async distance => page.evaluate(distance => {
              const target = document.querySelector('[data-section-key="case-basic"]')
              const touch = y => new Touch({ identifier: 1, target, clientX: 150, clientY: y })
              target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(100)] }))
              target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(100 + distance)] }))
              target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }))
            }, distance)
            const beforePull = reads
            await gesture(40); await page.waitForTimeout(100); assert.equal(reads, beforePull)
            await gesture(140); await page.waitForTimeout(150); assert.equal(reads, beforePull + 1)
            const beforeResume = reads
            await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 46_000; window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')) })
            await page.waitForTimeout(150); assert.equal(reads, beforeResume + 1)
            offline = true; await input.fill('offline-edit')
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'error')
            assert.equal(await input.inputValue(), 'offline-edit')
            offline = false; await page.locator('.case-save-status button:visible').click()
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'saved')
            record.updatedAt = '2026-10-08T11:00:00.000Z'
            await input.fill('conflicting-edit')
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'conflict')
            assert.equal(record.caseNumber, 'offline-edit')
            assert.equal(await input.inputValue(), 'conflicting-edit')
            page.once('dialog', dialog => dialog.accept())
            await page.locator('.case-save-status button:visible').click()
            await page.waitForFunction(() => document.querySelector('.case-save-status')?.dataset.state === 'idle')
            await input.fill('back-flush')
            await page.goBack()
            await page.waitForURL('about:blank')
            assert.equal(record.caseNumber, 'back-flush')
          }
          assert.deepEqual(errors, [])
          results.push({ width, theme, lang, result: size.scroll <= size.viewport ? 'PASS' : 'FAIL', scrollWidth: size.scroll })
          await page.close()
        }
      }
    }
    await fs.writeFile(path.join(dir, 'results.json'), JSON.stringify(results, null, 2))
    console.log(JSON.stringify({ baseline, combinations: results.length, failed: results.filter(row => row.result === 'FAIL'), artifacts: dir }))
    if (results.some(row => row.result === 'FAIL')) process.exitCode = 1
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
