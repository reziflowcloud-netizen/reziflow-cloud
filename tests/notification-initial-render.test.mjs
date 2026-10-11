import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToString } from 'react-dom/server'
const require = createRequire(import.meta.url)
function components() {
  const cache = new Map()
  const load = file => {
    if(cache.has(file)) return cache.get(file)
    const filename = ['.tsx','.ts'].map(ext=>file+ext).find(f=>fs.existsSync(f)), exports = {}
    cache.set(file,exports)
    const code = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
    new Function('require','exports',code)(id => id.endsWith('.css') ? { default: new Proxy({}, {get:(_,k)=>String(k)}), __esModule:true } : id.startsWith('@/') ? load('src/'+id.slice(2)) : id.startsWith('.') ? load(path.join(path.dirname(file),id).replaceAll('\\','/')) : require(id),exports)
    return exports
  }
  return {load}
}
test('actual Settings tile and sidebar/mobile bells are in SSR before effects or notification fetch', () => {
  const {load}=components(), Provider=load('src/context/NotificationFeatureContext').NotificationFeatureProvider
  const Bell=load('src/components/NotificationBell').default, Settings=load('src/app/settings/SettingsClient').default
  for(const enabled of [true,false]) {
    const html=renderToString(React.createElement(Provider,{enabled},React.createElement(React.Fragment,null,React.createElement(Settings,{canManageAll:false,canManageBilling:false}),React.createElement(Bell,{placement:'sidebar'}))))
    assert.equal(html.includes('href="/settings/notifications"'),enabled)
    assert.equal((html.match(/data-notification-bell/g)||[]).length,enabled?2:0)
    assert.ok(!html.includes('99+'));assert.ok(!/class="badge"/.test(html))
  }
})
test('every authenticated notification layout receives server feature state, without preference/auth fetch deciding geometry', () => {
  for(const area of ['settings','dashboard','leads','cases','clients','tasks','calendar','stages','employees']) assert.match(fs.readFileSync(`src/app/${area}/layout.tsx`,'utf8'),/AuthenticatedUIProvider/)
  const settings=fs.readFileSync('src/app/settings/SettingsClient.tsx','utf8')
  assert.doesNotMatch(settings,/fetch\(|useEffect|useState/)
  assert.match(fs.readFileSync('src/app/settings/page.tsx','utf8'),/getUser\(\)/)
})
