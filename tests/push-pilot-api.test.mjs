import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { randomBytes, createECDH, randomUUID } from 'node:crypto'
import { isSameOriginRequest } from '../src/lib/requestSecurity.ts'
import { pushUserAllowed, endpointHash, encryptSubscription, subscriptionAAD, validatePushSubscription } from '../src/lib/pushSecurity.ts'
import { isPushPilotNotification } from '../src/lib/pushPilotPolicy.ts'
import { entityLink } from '../src/lib/notificationPolicy.ts'
const require=createRequire(import.meta.url)
const { NextRequest }=require('next/server')
function load(file,dependencies) {
 const exports={}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 new Function('require','exports',code)(id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),exports)
 return exports
}
test('manual test API: auth, cross-origin, strict recipient-free request, safe errors',async()=>{
 let user={id:1,organizationId:'own'},calls=0
 class PushPilotError extends Error{constructor(status){super('sensitive provider details');this.status=status}}
 const route=load('src/app/api/notifications/test-push/route.ts',{
  '@/lib/requestSecurity':{isSameOriginRequest},'@/lib/notificationRequest':{authenticatedNotificationUser:async()=>user},
  '@/lib/pushPilot':{PushPilotError,sendPushPilot:async(...args)=>{calls++;assert.equal(args[0],user);return{status:'accepted'}}},
 })
 const request=(body={},origin='https://legalhubcrm.com')=>new NextRequest('https://legalhubcrm.com/api/notifications/test-push',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
 const valid={subscriptionId:'own-device',requestId:randomUUID()}
 assert.equal((await route.POST(request(valid,'https://evil.test'))).status,403);assert.equal(calls,0)
 user=null;assert.equal((await route.POST(request(valid))).status,401);assert.equal(calls,0)
 user={id:1,organizationId:'own'}
 for(const extra of [{userId:2},{organizationId:'foreign'},{body:'PII'},{endpoint:'https://evil.test'},{language:'invalid'}])assert.equal((await route.POST(request({...valid,...extra}))).status,400)
 assert.equal((await route.POST(request(valid))).status,200);assert.equal(calls,1)
 const failing=load('src/app/api/notifications/test-push/route.ts',{'@/lib/requestSecurity':{isSameOriginRequest},'@/lib/notificationRequest':{authenticatedNotificationUser:async()=>user},'@/lib/pushPilot':{PushPilotError,sendPushPilot:async()=>{throw new PushPilotError(429)}}})
 const response=await failing.POST(request(valid));assert.equal(response.status,429);assert.ok(!(await response.text()).includes('sensitive'))
})
test('subscription API binds body to session, hides foreign devices, unsubscribe scoped',async()=>{
 const user={id:1,organizationId:'own'},rows=[]
 process.env.WEB_PUSH_PILOT_USER_IDS='1'
 process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY=randomBytes(32).toString('hex')
 const db={pushSubscription:{
  findUnique:async({where})=>rows.find(row=>row.endpointHash===where.endpointHash),
  count:async()=>rows.length,
  create:async({data})=>rows.push({...data,id:'own-device'}),
  findFirst:async({where})=>rows.find(row=>row.userId===where.userId&&row.organizationId===where.organizationId&&row.endpointHash===where.endpointHash&&!row.disabledAt),
  findMany:async({where})=>rows.filter(row=>row.userId===where.userId&&row.organizationId===where.organizationId).map(({id,deviceLabel})=>({id,deviceLabel})),
  deleteMany:async({where})=>{assert.equal(where.userId,1);assert.equal(where.organizationId,'own');rows.splice(0,1)},
 },notificationPreference:{upsert:async({where})=>assert.deepEqual(where.userId_organizationId,{userId:1,organizationId:'own'})}}
 db.$transaction=async run=>run(db)
 const route=load('src/app/api/notifications/subscriptions/route.ts',{'@/lib/prisma':{prisma:db},'@/lib/notificationRequest':{authenticatedNotificationUser:async()=>user},'@/lib/pushSecurity':{endpointHash,encryptSubscription,pushConfigured:()=>true,pushUserAllowed,subscriptionAAD,validatePushSubscription}})
 const pair=createECDH('prime256v1');pair.generateKeys()
 const raw={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:pair.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')},userId:2,organizationId:'foreign'}
 const req=(method,body)=>new NextRequest('https://legalhubcrm.com/api/notifications/subscriptions',{method,...(body?{body:JSON.stringify(body)}:{})})
 assert.equal((await route.POST(req('POST',raw))).status,200)
 assert.equal(rows[0].userId,1);assert.equal(rows[0].organizationId,'own');assert.ok(!rows[0].encryptedSubscription.includes(raw.endpoint))
 assert.equal((await route.POST(req('POST',{...raw,endpoint:'https://127.0.0.1/secret'}))).status,400)
 const list=await(await route.GET(req('GET'))).json();assert.deepEqual(list.devices,[{id:'own-device',deviceLabel:'Desktop'}]);assert.ok(!JSON.stringify(list).includes('endpoint'))
 process.env.WEB_PUSH_PILOT_USER_IDS='';assert.equal((await route.POST(req('POST',raw))).status,503)
 assert.equal((await route.DELETE(req('DELETE',raw))).status,200);assert.equal(rows.length,0)
 delete process.env.WEB_PUSH_PILOT_USER_IDS
})
test('notification resolver rechecks auth/access, marks own pilot read and returns safe Dashboard',async()=>{
 let user=null,notification=null,read=0
 const route=load('src/app/notifications/open/[id]/route.ts',{'@/lib/notificationRequest':{authenticatedNotificationUser:async()=>user},'@/lib/notifications':{authorizedNotification:async()=>notification,markNotificationsRead:async()=>read++},'@/lib/notificationPolicy':{entityLink},'@/lib/pushPilotPolicy':{isPushPilotNotification},'@/lib/prisma':{prisma:{notification:{updateMany:async({where})=>{assert.equal(where.userId,1);assert.equal(where.organizationId,'own')}}}}})
 const id=randomUUID(),request=new NextRequest(`https://legalhubcrm.com/notifications/open/${id}`),params={params:{id}}
 assert.equal((await route.GET(request,params)).headers.get('location'),'/login?'+new URLSearchParams({next:`/notifications/open/${id}`}))
 user={id:1,organizationId:'own'};assert.equal((await route.GET(request,params)).headers.get('location'),'/dashboard');assert.equal(read,0)
 notification={id,entityId:id,type:'push_test',entityType:'push_test',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`}
 assert.equal((await route.GET(request,params)).headers.get('location'),'/dashboard');assert.equal(read,1)
})
test('real enable handler requests permission only on click before worker/network waits',async()=>{
 const source=fs.readFileSync('src/app/settings/notifications/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 let enable
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='enable')enable=node.getText(ast);ts.forEachChild(node,visit)}visit(ast)
 assert.ok(enable);assert.equal((source.match(/Notification\.requestPermission\(/g)||[]).length,1)
 for(const state of ['default','granted','denied','unsupported']){
  const calls=[],noOp=()=>{},preferences={pushEnabled:false},config={pushAvailable:true,publicKey:'synthetic'}
  const subscription={toJSON:()=>({}),unsubscribe:async()=>calls.push('unsubscribe')}
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{calls.push('subscribe');return subscription}}}
  const Notification={permission:state,requestPermission:()=>{calls.push('permission');return Promise.resolve('granted')}}
  const navigator={serviceWorker:{register:async()=>{calls.push('worker');return registration},ready:Promise.resolve(registration)}}
  const fetch=async()=>{calls.push('network');return{ok:true}}
  const names=['preferences','config','pushSupported','Notification','setBusy','setMessage','setPermission','navigator','vapidBytes','fetch','persist','setActive','setConfig','active','refreshDevices']
  const values=[preferences,config,()=>state!=='unsupported',Notification,noOp,noOp,noOp,navigator,noOp,fetch,async()=>{},noOp,noOp,false,async()=>{}]
  const code=ts.transpileModule(enable,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
  const handler=new Function(...names,code+';return enable')(...values)
  assert.deepEqual(calls,[]);const pending=handler()
  if(state==='default')assert.deepEqual(calls,['permission'])
  await pending
  if(state==='default')assert.deepEqual(calls,['permission','worker','subscribe','network'])
  if(state==='granted')assert.deepEqual(calls,['worker','subscribe','network'])
  if(state==='denied'||state==='unsupported')assert.deepEqual(calls,[])
 }
})
