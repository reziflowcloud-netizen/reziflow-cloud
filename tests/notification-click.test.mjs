import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { MessageChannel } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'

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
test('suspended client accepts page handoff without a second navigation',async()=>{
 const calls=[]
 const target=client({focus:async()=>{calls.push('focus');throw Error('suspended')},postMessage(message,ports){calls.push(message.path);ports[0].postMessage('notification-open-accepted')},navigate:async()=>{throw Error('must not navigate twice')}})
 assert.deepEqual(await click([target]),[]);assert.deepEqual(calls,['focus',path])
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
test('missing page listener times out to native navigation; transport failure falls back',async()=>{
 let native=0
 const target=client({postMessage(){},navigate:async()=>{native++;return{focus:async()=>{}}}})
 assert.deepEqual(await click([target]),[]);assert.equal(native,1)
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
