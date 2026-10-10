import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { MessageChannel } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { pushPayload } from '../src/lib/notificationPush.ts'
import { notificationPreferences, safeNotificationReturn } from '../src/lib/notificationPolicy.ts'

const path='/notifications/open/synthetic-id',origin='https://legalhubcrm.com'
async function click(windows,rawPath=path) {
 const handlers={},opened=[]
 const self={location:{origin},addEventListener:(name,handler)=>handlers[name]=handler,clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}}
 self.crypto={randomUUID}
 vm.runInNewContext(fs.readFileSync('public/notification-sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout})
 let pending,closed=false
 handlers.notificationclick({notification:{data:{url:rawPath},close(){closed=true}},waitUntil:p=>pending=p})
 await pending;assert.equal(closed,true);return opened
}
function client(overrides={}) {
 return {url:origin+'/settings/notifications',focus:async()=>{},postMessage(message,ports){ports[0].postMessage('not-handled')},navigate:async()=>null,...overrides}
}
test('suspended client accepts page handoff after failed client navigation',async()=>{
 const calls=[]
 const target=client({focus:async()=>{calls.push('focus');throw Error('suspended')},postMessage(message,ports){calls.push(message.path);ports[0].postMessage('notification-open-accepted')},navigate:async()=>{calls.push('navigate');throw Error('inert')}})
 assert.deepEqual(await click([target]),[]);assert.deepEqual(calls,['navigate','focus',path])
})
test('navigate rejection/null and focus rejection cannot lose a click',async()=>{
 for(const navigate of [async()=>{throw Error('inert client')},async()=>null]){
  const target=client({focus:async()=>{throw Error('inert client')},navigate})
  assert.deepEqual(await click([target]),[origin+path])
 }
})
test('navigation focuses returned client; failing final focus does not open duplicates',async()=>{
 let focused=0
 const target=client({navigate:async url=>{assert.equal(url,origin+path);return{focus:async()=>{focused++;throw Error('focus unavailable')}}}})
 assert.deepEqual(await click([target]),[]);assert.equal(focused,1)
})
test('client navigation succeeds without a page listener; failed navigation and silent page fall back',async()=>{
 let native=0
 const target=client({postMessage(){},navigate:async()=>{native++;return{focus:async()=>{}}}})
 assert.deepEqual(await click([target]),[]);assert.equal(native,1)
 assert.deepEqual(await click([client({postMessage(){},navigate:async()=>null})]),[origin+path])
 assert.deepEqual(await click([client({postMessage(){throw Error('closed')}})]),[origin+path])
})
test('foreign clients are skipped and unsafe click paths stay on Dashboard',async()=>{
 assert.deepEqual(await click([client({url:'https://foreign.test/',focus:async()=>{throw Error('foreign touched')}})],'https://evil.test'),[origin+'/dashboard'])
})
test('page handoff only accepts own worker and bounded resolver paths; push alone never navigates',()=>{
 const exports={},assigned=[],acks=[]
 const code=ts.transpileModule(fs.readFileSync('src/lib/notificationBrowser.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 new Function('exports','URL','window',code)(exports,URL,{location:{origin,assign:path=>assigned.push(path)}})
 const dispatch=(path,type='legalhub:notification-open',scriptURL=origin+'/notification-sw.js')=>exports.handleNotificationOpen({source:scriptURL?{scriptURL}:null,data:{type,path},ports:[{postMessage:ack=>acks.push(ack)}]})
 for(const invalid of ['//evil.test','https://evil.test','/notifications/open/a?next=evil','/cases/1','/notifications/open/'+'a'.repeat(101)])dispatch(invalid)
 dispatch(path,'notifications-changed');dispatch(path,'legalhub:notification-open','https://foreign.test/notification-sw.js');dispatch(path,'legalhub:notification-open',origin+'/other-worker.js');dispatch(path,'legalhub:notification-open',null)
 assert.deepEqual(assigned,[]);assert.deepEqual(acks,[])
 dispatch(path);dispatch('/dashboard');assert.deepEqual(assigned,[path,'/dashboard']);assert.deepEqual(acks,['notification-open-accepted','notification-open-accepted'])
})

function navigationWorker(windows = [], options = {}) {
 const handlers = {}, shown = [], opened = [], badges = []
 let now = 1000
 const self = {
  crypto: { randomUUID }, location: { origin }, addEventListener: (type, handler) => handlers[type] = handler,
  registration: { showNotification: async (_title, notification) => shown.push(notification) },
  navigator: { setAppBadge: async n => badges.push(n), clearAppBadge: async () => badges.push(0) },
  clients: { matchAll: options.matchAll || (async () => windows), openWindow: options.openWindow || (async url => { opened.push(url); return { focus: async () => {} } }) },
 }
 const Clock = class extends Date { static now() { return now } }
 vm.runInNewContext(fs.readFileSync('public/notification-sw.js', 'utf8'), { self, URL, Date: Clock, MessageChannel, setTimeout, clearTimeout, AbortController, fetch: async () => ({ ok: true }) })
 const click = async data => { let pending; handlers.notificationclick({ notification: { data, close() {} }, waitUntil: p => pending = p }); await pending }
 const push = async payload => { let pending; handlers.push({ data: { json: () => payload }, waitUntil: p => pending = p }); await pending; return shown.at(-1) }
 return { click, push, opened, shown, badges, advance: ms => now += ms }
}
function allPayloads() {
 const id = randomUUID()
 const records = [
  { id, type: 'push_test', entityType: 'push_test', entityId: id, deepLink: '/dashboard', dedupeKey: 'push-pilot:' + randomUUID() },
  { id: 'synthetic-lead-notification', type: 'lead_assigned', entityType: 'lead', entityId: 'synthetic-lead', deepLink: '/leads/synthetic-lead' },
  { id: 'synthetic-task-notification', type: 'task_assigned', entityType: 'task', entityId: 'synthetic-task', deepLink: '/tasks?notificationTask=synthetic-task' },
 ]
 return records.map(record => pushPayload(record, notificationPreferences(), '', 1))
}
test('all types retain JS activation for existing windows; arrival never navigates or marks read', async () => {
 for (const payload of allPayloads()) {
  const calls = []
  const window = client({ focus: async () => calls.push('focus'), postMessage: (message, ports) => { if (message.type === 'legalhub:notification-open') { calls.push(message.path); ports[0].postMessage('notification-open-accepted') } } })
  const worker = navigationWorker([window]), displayed = await worker.push(payload)
  assert.equal(Object.hasOwn(displayed, 'navigate'), false, 'An action URL must not suppress the existing-window click event')
  assert.equal(displayed.data.url, payload.url); assert.deepEqual(calls, []); assert.deepEqual(worker.opened, [])
  await worker.click(displayed.data)
  assert.deepEqual(calls, ['focus', payload.url]); assert.deepEqual(worker.opened, [])
  assert.deepEqual(worker.badges, [1], 'Read/badge changes belong to the authorized page after opening')
 }
})

test('all types keep the same native resolver for cold launch and the same JS fallback', async () => {
 for (const payload of allPayloads()) {
  const worker = navigationWorker([]), displayed = await worker.push(payload)
  assert.equal(displayed.navigate, origin + payload.url); assert.equal(displayed.data.url, payload.url)
  await worker.click(displayed.data); assert.deepEqual(worker.opened, [displayed.navigate])
 }
})

test('background Settings client navigates exact resolver before focus; no stale-page ACK can win', async () => {
 for (const payload of allPayloads()) {
  const calls = []
  const window = client({ visibilityState: 'hidden', navigate: async url => {
   calls.push(url); return { focus: async () => calls.push('focus-navigated') }
  }, focus: async () => { throw Error('must not focus old Settings before navigation') }, postMessage: (message) => {
   if (message.type === 'legalhub:notification-open') throw Error('must not wait for old-page ACK')
  } })
  const worker = navigationWorker([window]), displayed = await worker.push(payload)
  assert.equal(Object.hasOwn(displayed, 'navigate'), false); assert.deepEqual(calls, [])
  await worker.click(displayed.data); assert.deepEqual(calls, [origin + payload.url, 'focus-navigated']); assert.deepEqual(worker.opened, [])
 }
})

test('openWindow returning a restored Settings page is repaired through the exact resolver', async () => {
 const calls = []
 const restored = client({ navigate: async url => { calls.push(url); return { focus: async () => calls.push('focus-navigated') } } })
 const worker = navigationWorker([], { openWindow: async url => { calls.push('open:' + url); return restored } })
 await worker.click({ url: path }); assert.deepEqual(calls, ['open:' + origin + path, origin + path, 'focus-navigated'])
})

test('navigate resolving with the old Settings window cannot suppress the resolver fallback', async () => {
 const calls = []
 const restored = client({ navigate: async url => { calls.push('navigate:' + url); return restored },
  focus: async () => calls.push('wake'), postMessage(message, ports) {
   calls.push('assign:' + message.path); ports[0].postMessage('notification-open-accepted')
  } })
 assert.deepEqual(await click([restored]),[])
 assert.deepEqual(calls,['navigate:' + origin + path, 'wake', 'assign:' + path])
})

test('page does not ACK before navigation or ACK a refused assignment', () => {
 const exports = {}, calls = []
 const code = ts.transpileModule(fs.readFileSync('src/lib/notificationBrowser.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 let refused = false
 new Function('exports','URL','window',code)(exports,URL,{location:{origin,assign:url=>{calls.push(url); if (refused) throw Error('navigation refused')}}})
 const event = {source:{scriptURL:origin+'/notification-sw.js'},data:{type:'legalhub:notification-open',path},ports:[{postMessage:ack=>calls.push(ack)}]}
 exports.handleNotificationOpen(event); assert.deepEqual(calls,[path,'notification-open-accepted'])
 calls.length=0;refused=true;exports.handleNotificationOpen(event);assert.deepEqual(calls,[path])
})

test('foreign/nested windows do not disable native launch; enumeration failure still shows safe notification', async () => {
 const windows = [client({url:'https://foreign.test/'}),client({frameType:'nested'})]
 const worker = navigationWorker(windows), displayed = await worker.push({url:path})
 assert.equal(displayed.navigate,origin+path)
 const failed = navigationWorker([], {matchAll:async()=>{throw Error('enumeration failed')}})
 assert.equal((await failed.push({url:path})).navigate,origin+path)
 const stalled = navigationWorker([], {matchAll:()=>new Promise(()=>{})})
 assert.equal((await stalled.push({url:path})).navigate,origin+path, 'Client lookup must not prevent visible delivery')
})
test('all types preserve the resolver with a suspended/inert client and with no client window', async () => {
 for (const payload of allPayloads()) {
  const suspended = client({ focus: async () => { throw Error('suspended') }, postMessage: () => { throw Error('not awake') }, navigate: async () => null })
  const worker = navigationWorker([suspended])
  await worker.click({ url: payload.url, pilotDiagnostics: payload.pilotDiagnostics })
  assert.deepEqual(worker.opened, [origin + payload.url])
  let focused = 0, opened = 0
  const closed = navigationWorker([], { openWindow: async url => { opened++; assert.equal(url, origin + payload.url); return { focus: async () => focused++ } } })
  await closed.click({ url: payload.url, pilotDiagnostics: payload.pilotDiagnostics })
  assert.equal(opened, 1); assert.equal(focused, 1)
 }
})
test('reuse exact resolver window, skip malformed/foreign/nested clients and survive enumeration failure', async () => {
 let focused = 0
 const target = client({ url: origin + path, focus: async () => focused++, postMessage: () => { throw Error('should already be at resolver') }, navigate: async () => { throw Error('do not reload resolver') } })
 const worker = navigationWorker([client({ url: 'not a URL' }), client({ url: 'https://foreign.test/' }), client({ frameType: 'nested' }), target])
 await worker.click({ url: path }); assert.equal(focused, 1); assert.deepEqual(worker.opened, [])
 const failed = navigationWorker([], { matchAll: async () => { throw Error('no enumeration') } })
 await failed.click({ url: path }); assert.deepEqual(failed.opened, [origin + path])
 const inertExact = navigationWorker([client({ url: origin + path, focus: async () => { throw Error('inert') }, postMessage: () => { throw Error('inert') } })])
 await inertExact.click({ url: path }); assert.deepEqual(inertExact.opened, [origin + path])
})
test('duplicate activations share one navigation; later intentional clicks and other notifications still work', async () => {
 const worker = navigationWorker([])
 await Promise.all([worker.click({ url: path }), worker.click({ url: path })])
 await worker.click({ url: path }); assert.deepEqual(worker.opened, [origin + path])
 await worker.click({ url: '/notifications/open/another-id' }); assert.equal(worker.opened.length, 2)
 worker.advance(2001); await worker.click({ url: path }); assert.equal(worker.opened.length, 3)
 let attempts = 0
 const retry = navigationWorker([], { openWindow: async () => { attempts++; return null } })
 await retry.click({ url: path }); await retry.click({ url: path }); assert.equal(attempts, 2, 'An unsuccessful open must remain retryable')
})
test('native, fallback and login return all reject external, encoded and malformed paths; badge clears at zero', async () => {
 const invalid = ['https://foreign.test/', '//foreign.test/', origin + path, '/notifications/open/../dashboard', '/notifications/open/%2e%2e', '/notifications/open/id?next=https://foreign.test', '/notifications/open/id#fragment', '/notifications/open/a\n', '/notifications/open/' + 'a'.repeat(101), 'javascript:alert(1)']
 for (const url of invalid) {
  const worker = navigationWorker([]), displayed = await worker.push({ url, unread: 0 })
  assert.equal(displayed.navigate, origin + '/dashboard'); assert.equal(displayed.data.url, '/dashboard')
  await worker.click({ url }); assert.deepEqual(worker.opened, [origin + '/dashboard']); assert.deepEqual(worker.badges, [0])
  assert.equal(safeNotificationReturn(url), '/dashboard')
 }
 for (const payload of allPayloads()) assert.equal(safeNotificationReturn(payload.url), payload.url)
})
