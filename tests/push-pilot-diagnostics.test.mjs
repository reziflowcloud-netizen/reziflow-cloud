import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { randomUUID } from 'node:crypto'
import { MessageChannel } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { PUSH_PILOT_WORKER_VERSION, validPushPilotTrace } from '../src/lib/pushPilotDiagnostics.ts'
import { isPushPilotNotification } from '../src/lib/pushPilotPolicy.ts'
import { isSameOriginRequest } from '../src/lib/requestSecurity.ts'
const require=createRequire(import.meta.url),{NextRequest}=require('next/server')
const id=randomUUID(),instanceId=randomUUID(),path=`/notifications/open/${id}`
function load(file,dependencies){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),exports);return exports}
test('trace API permits own allowlisted synthetic records only; rejects identity/payload and never writes DB',async()=>{
 let user={id:1,organizationId:'own'},allowed=true,record={id,entityId:id,type:'push_test',entityType:'push_test',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`},logged=[]
 const db={notification:{findFirst:async({where})=>{assert.equal(where.userId,1);assert.equal(where.organizationId,'own');return record}}}
 const route=load('src/app/api/notifications/pilot-diagnostics/route.ts',{'@/lib/prisma':{prisma:db},'@/lib/notificationRequest':{authenticatedNotificationUser:async()=>user},'@/lib/requestSecurity':{isSameOriginRequest},'@/lib/pushSecurity':{pushConfigured:()=>true,pushUserAllowed:()=>allowed},'@/lib/pushPilotPolicy':{isPushPilotNotification},'@/lib/pushPilotDiagnostics':{PUSH_PILOT_WORKER_VERSION,validPushPilotTrace}})
 const body={notificationId:id,workerVersion:PUSH_PILOT_WORKER_VERSION,instanceId,stage:'click-start'}
 const req=(value=body,origin='https://legalhubcrm.com')=>new NextRequest('https://legalhubcrm.com/api/notifications/pilot-diagnostics',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(value)})
 assert.equal((await route.POST(req(body,'https://foreign.test'))).status,403)
 user=null;assert.equal((await route.POST(req())).status,403);user={id:1,organizationId:'own'}
 allowed=false;assert.equal((await route.GET()).status,403);assert.equal((await route.POST(req())).status,403);allowed=true
 for(const extra of [{payload:'PII'},{endpoint:'https://secret.test'},{userId:2},{stage:'arbitrary'},{workerVersion:'unknown'},{instanceId:'bad'}])assert.equal((await route.POST(req({...body,...extra}))).status,400)
 record=null;assert.equal((await route.POST(req())).status,404);assert.equal((await(await route.GET()).json()).notificationId,null)
 record={id,entityId:id,type:'push_test',entityType:'push_test',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`}
 const original=console.info;console.info=(...args)=>logged.push(args)
 try{assert.equal((await route.POST(req())).status,200)}finally{console.info=original}
 assert.equal(logged.length,1);assert.deepEqual(JSON.parse(logged[0][1]),body)
 assert.equal((await(await route.GET()).json()).notificationId,id)
})
test('worker reports fixed version, traces synthetic click before client work, without blocking navigation on network failure',async()=>{
 const handlers={},stages=[],order=[],self={crypto:{randomUUID},location:{origin:'https://legalhubcrm.com'},addEventListener:(name,handler)=>handlers[name]=handler,clients:{matchAll:async()=>{order.push('clients');return[]},openWindow:async()=>{order.push('open');return null}}}
 const fetch=async(url,options)=>{assert.equal(url,'/api/notifications/pilot-diagnostics');const body=JSON.parse(options.body);assert.ok(validPushPilotTrace(body));stages.push(body.stage);order.push(body.stage);throw Error('network unavailable')}
 vm.runInNewContext(fs.readFileSync('public/notification-sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout,AbortController,fetch})
 let info;handlers.message({data:{type:'legalhub:pilot-worker-check'},ports:[{postMessage:value=>info=value}]});assert.equal(info.workerVersion,PUSH_PILOT_WORKER_VERSION)
 let pending;handlers.notificationclick({notification:{data:{url:path,pilotDiagnostics:true},close(){}},waitUntil:p=>pending=p});await pending
 assert.equal(order[0],'click-start');assert.ok(order.includes('open'));assert.deepEqual(stages,['click-start','clients-found','open-window-null'])
 stages.length=0;handlers.notificationclick({notification:{data:{url:path,pilotDiagnostics:false},close(){}},waitUntil:p=>pending=p});await pending;assert.deepEqual(stages,[])
})
test('synthetic notification delegates only a same-origin resolver to native navigation; other notifications keep click fallback',async()=>{
 const handlers={},shown=[],self={crypto:{randomUUID},location:{origin:'https://legalhubcrm.com'},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async(title,options)=>shown.push({title,options})},navigator:{},clients:{matchAll:async()=>[]}}
 vm.runInNewContext(fs.readFileSync('public/notification-sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout,AbortController,fetch:async()=>({ok:true})})
 const push=async payload=>{let pending;handlers.push({data:{json:()=>payload},waitUntil:p=>pending=p});await pending;return shown.at(-1)}
 const own=await push({url:path,body:'Safe test',pilotDiagnostics:true})
 assert.equal(own.options.navigate,`https://legalhubcrm.com${path}`);assert.equal(own.options.data.url,path);assert.equal(own.options.data.workerVersion,PUSH_PILOT_WORKER_VERSION)
 for(const url of ['https://foreign.test/','//foreign.test/','/notifications/open/../../settings','javascript:alert(1)']){
  const invalid=await push({url,pilotDiagnostics:true});assert.equal(invalid.options.navigate,'https://legalhubcrm.com/dashboard');assert.equal(invalid.options.data.url,'/dashboard')
 }
 const ordinary=await push({url:path,pilotDiagnostics:false});assert.equal(Object.hasOwn(ordinary.options,'navigate'),false);assert.equal(ordinary.options.data.url,path)
 assert.equal(typeof handlers.notificationclick,'function')
})
