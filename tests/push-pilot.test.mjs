import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import { MessageChannel } from 'node:worker_threads'
import { createECDH, randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { pushPilotUserIds, pushUserAllowed, encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
import { sendPushPilot } from '../src/lib/pushPilot.ts'
import { deliverNotificationPush, pushPayload } from '../src/lib/notificationPush.ts'
import { authorizedNotification, listNotifications, markNotificationsRead, notificationUser } from '../src/lib/notifications.ts'
import { isPushPilotNotification, pushPilotText } from '../src/lib/pushPilotPolicy.ts'
import { notificationPreferences } from '../src/lib/notificationPolicy.ts'

test('allowlist fails closed, supports legacy ID, rejects malformed/blank overrides', () => {
  delete process.env.PUSH_TEST_USER_ID; delete process.env.WEB_PUSH_PILOT_USER_IDS
  assert.deepEqual(pushPilotUserIds(),[]); assert.equal(pushUserAllowed(1),false)
  process.env.PUSH_TEST_USER_ID='1'; assert.equal(pushUserAllowed(1),true)
  for(const raw of ['', '1,', '*', '0', '-1', '1.2','9007199254740993','1,evil']) {process.env.WEB_PUSH_PILOT_USER_IDS=raw;assert.deepEqual(pushPilotUserIds(),[])}
  process.env.WEB_PUSH_PILOT_USER_IDS='1, 2,1';assert.deepEqual(pushPilotUserIds(),[1,2]);assert.equal(pushUserAllowed(3),false)
  delete process.env.WEB_PUSH_PILOT_USER_IDS;delete process.env.PUSH_TEST_USER_ID
})
test('synthetic payload never includes identity even with privacy option enabled', () => {
  const notification={id:randomUUID(),type:'push_test',entityType:'push_test',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`};notification.entityId=notification.id
  assert.equal(isPushPilotNotification(notification),true)
  for(const language of ['uk','ru','pl']) {
    const payload=pushPayload(notification,notificationPreferences({language,showClientName:true}),'PRIVATE IDENTITY',1)
    assert.equal(payload.title,'LegalHub CRM');assert.equal(payload.body,`${pushPilotText[language].title}\n${pushPilotText[language].body}`)
    assert.ok(!JSON.stringify(payload).includes('PRIVATE'));assert.equal(payload.url,`/notifications/open/${notification.id}`)
  }
  assert.equal(isPushPilotNotification({...notification,entityId:'foreign'}),false)
  assert.equal(isPushPilotNotification({...notification,deepLink:'https://evil.test'}),false)
})
test('existing Service Worker: stable tags, badge, safe click/focus, no data cache',async () => {
  const handlers={},shown=[],badges=[],navigated=[],opened=[]
  let windows=[{url:'https://legalhubcrm.com/dashboard',postMessage(message,ports){ports?.[0].postMessage('not-handled')},navigate:async url=>{navigated.push(url);return windows[0]},focus:async()=>navigated.push('focus')}]
  const self={location:{origin:'https://legalhubcrm.com'},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async(...args)=>shown.push(args)},navigator:{setAppBadge:async n=>badges.push(n),clearAppBadge:async()=>badges.push(0)},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}}
  self.crypto={randomUUID}
  vm.runInNewContext(fs.readFileSync('public/notification-sw.js','utf8'),{self,URL,MessageChannel,setTimeout,clearTimeout})
  async function dispatch(type,data){let pending;handlers[type]({...data,waitUntil:p=>pending=p});await pending}
  const payload={body:'Synthetic only',tag:'same-id',url:'/notifications/open/test-id',unread:1}
  await dispatch('push',{data:{json:()=>payload}});await dispatch('push',{data:{json:()=>payload}})
  assert.equal(shown[0][1].tag,shown[1][1].tag);assert.deepEqual(badges,[1,1]);assert.equal(handlers.fetch,undefined)
  await dispatch('notificationclick',{notification:{close(){},data:{url:payload.url}}});assert.deepEqual(navigated,['focus','https://legalhubcrm.com/notifications/open/test-id','focus'])
  windows=[];await dispatch('notificationclick',{notification:{close(){},data:{url:'https://evil.test'}}});assert.deepEqual(opened,['https://legalhubcrm.com/dashboard'])
  await dispatch('push',{data:{json:()=>({...payload,unread:0,url:'//evil.test'})}});assert.equal(badges.at(-1),0);assert.equal(shown.at(-1)[1].data.url,'/dashboard')
  delete self.navigator.setAppBadge;delete self.navigator.clearAppBadge
  await dispatch('push',{data:{json:()=>payload}})
})

const databaseUrl=process.env.NOTIFICATIONS_TEST_DATABASE_URL
test('isolated pilot: exact recipient/device, events OFF, idempotency, cooldown, cleanup', {skip:!databaseUrl},async t=>{
 const url=new URL(databaseUrl);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.includes('notifications_qa'))
 const db=new PrismaClient({datasources:{db:{url:databaseUrl}},log:[]})
 const pair=createECDH('prime256v1');pair.generateKeys()
 Object.assign(process.env,{NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'false',WEB_PUSH_ENABLED:'true',PUSH_ENVIRONMENT:process.env.VERCEL_ENV||'development',VAPID_PUBLIC_KEY:pair.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:pair.getPrivateKey().toString('base64url'),VAPID_SUBJECT:'https://qa.example.test',PUSH_SUBSCRIPTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')})
 const org=await db.organization.create({data:{name:'Push Pilot QA',slug:`pilot-${randomUUID()}`}})
 const otherOrg=await db.organization.create({data:{name:'Foreign Pilot QA',slug:`pilot-${randomUUID()}`}})
 t.after(async()=>{await db.organization.deleteMany({where:{id:{in:[org.id,otherOrg.id]}}});await db.$disconnect()})
 const makeUser=organizationId=>db.user.create({data:{organizationId,email:`${randomUUID()}@example.test`,name:'Synthetic',password:'not-a-login-hash',role:'admin'}})
 const own=await makeUser(org.id),sameTenant=await makeUser(org.id),foreign=await makeUser(otherOrg.id)
 process.env.WEB_PUSH_PILOT_USER_IDS=String(own.id)
 await db.notificationPreference.create({data:{userId:own.id,organizationId:org.id,pushEnabled:true}})
 const sub=async user=>{
  const devicePair=createECDH('prime256v1');devicePair.generateKeys()
  const raw={endpoint:`https://fcm.googleapis.com/fcm/send/${randomUUID()}`,keys:{p256dh:devicePair.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}
  const identity={organizationId:user.organizationId,userId:user.id,endpointHash:endpointHash(raw.endpoint)}
  return db.pushSubscription.create({data:{...identity,encryptedSubscription:encryptSubscription(raw,subscriptionAAD(identity)),deviceLabel:'Synthetic iOS'}})
 }
 const a=await sub(own),b=await sub(own),c=await sub(sameTenant),d=await sub(foreign)
 const user=await notificationUser(own.id,org.id,db),sent=[]
 const sender=async(raw,payload,options)=>{sent.push({raw,payload:JSON.parse(payload),options})}
 const id=randomUUID(),now=new Date()
 await t.test('one exact device and concurrent repeat makes one outbox/one send',async()=>{
  const results=await Promise.all([sendPushPilot(user,a.id,id,db,sender,now),sendPushPilot(user,a.id,id,db,sender,now)])
  assert.equal(sent.length,1);assert.equal(results.filter(result=>result.status==='accepted').length>=1,true)
  assert.equal(await db.notificationPushDelivery.count({where:{userId:own.id}}),1)
  assert.equal(sent[0].raw.endpoint.includes('fcm.googleapis.com'),true);assert.equal(sent[0].options.TTL,3600)
  assert.equal(sent[0].payload.body,'Тестове сповіщення\nPush-повідомлення працюють.')
  const feed=await listNotifications(user,null,db);assert.equal(feed.unread,1);assert.equal(feed.items.length,1)
  assert.equal(await authorizedNotification(await notificationUser(sameTenant.id,org.id,db),feed.items[0].id,db),null)
  await sendPushPilot(user,a.id,id,db,sender,now);assert.equal(sent.length,1)
  await assert.rejects(sendPushPilot(user,b.id,id,db,sender,now),e=>e.status===409)
  await assert.rejects(sendPushPilot(user,a.id,randomUUID(),db,sender,now),e=>e.status===429)
  await markNotificationsRead(user,feed.items[0].id,db);assert.equal((await listNotifications(user,null,db)).unread,0)
 })
 await t.test('foreign devices, malformed input, blank gate and flags OFF rejected',async()=>{
  for(const subscription of [c,d])await assert.rejects(sendPushPilot(user,subscription.id,randomUUID(),db,sender),e=>e.status===404)
  await assert.rejects(sendPushPilot(user,a.id,'invalid',db,sender),e=>e.status===400)
  await assert.rejects(sendPushPilot(sameTenant,c.id,randomUUID(),db,sender),e=>e.status===503)
  process.env.WEB_PUSH_PILOT_USER_IDS='';await assert.rejects(sendPushPilot(user,a.id,randomUUID(),db,sender),e=>e.status===503);process.env.WEB_PUSH_PILOT_USER_IDS=String(own.id)
  process.env.WEB_PUSH_ENABLED='false';await assert.rejects(sendPushPilot(user,a.id,randomUUID(),db,sender),e=>e.status===503);process.env.WEB_PUSH_ENABLED='true'
  assert.deepEqual(await deliverNotificationPush(db,sender),{processed:0,delivered:0});assert.equal(sent.length,1)
 })
 await t.test('404/410 erase keys and transient manual failures never retry automatically',async()=>{
  let offset=31000
  for(const statusCode of [404,410,500]) {
   const device=await sub(own),requestId=randomUUID(),later=new Date(now.getTime()+offset);offset+=31000
   let attempts=0
   const fail=async()=>{attempts++;throw Object.assign(new Error('Synthetic provider failure'),{statusCode})}
   assert.equal((await sendPushPilot(user,device.id,requestId,db,fail,later)).status,'failed')
   await sendPushPilot(user,device.id,requestId,db,fail,later).catch(error=>assert.equal(error.status,404));assert.equal(attempts,1)
   const stored=await db.pushSubscription.findUnique({where:{id:device.id}})
   if(statusCode!==500){assert.ok(stored.disabledAt);assert.equal(stored.encryptedSubscription,'')}
  }
 })
 await t.test('unsubscribe removes target; re-enable restores an isolated new device',async()=>{
  await db.pushSubscription.delete({where:{id:a.id}})
  await assert.rejects(sendPushPilot(user,a.id,randomUUID(),db,sender,new Date(now.getTime()+200000)),e=>e.status===404)
  const replacement=await sub(own)
  assert.equal((await sendPushPilot(user,replacement.id,randomUUID(),db,sender,new Date(now.getTime()+200000))).status,'accepted')
  assert.equal(sent.length,2)
 })
 await t.test('UI language is fixed in record; crash ambiguity never resends',async()=>{
  const later=new Date(now.getTime()+300000),requestId=randomUUID()
  const result=await sendPushPilot(user,b.id,requestId,db,sender,later,'pl')
  assert.equal(result.status,'accepted');assert.equal(sent.at(-1).payload.body,`${pushPilotText.pl.title}\n${pushPilotText.pl.body}`)
  const id=randomUUID(),stuckRequest=randomUUID()
  await db.notification.create({data:{id,entityId:id,userId:own.id,organizationId:org.id,type:'push_test',entityType:'push_test',title:pushPilotText.uk.title,body:pushPilotText.uk.body,deepLink:'/dashboard',dedupeKey:`push-pilot:${stuckRequest}`,pushRequested:true}})
  await db.notificationPushDelivery.create({data:{userId:own.id,organizationId:org.id,notificationId:id,subscriptionId:b.id,attempts:1,leaseToken:randomUUID(),leaseUntil:new Date(0),nextAttemptAt:new Date(0)}})
  const before=sent.length
  assert.equal((await sendPushPilot(user,b.id,stuckRequest,db,sender,new Date(now.getTime()+400000))).status,'pending')
  assert.equal(sent.length,before)
  process.env.NOTIFICATION_EVENTS_ENABLED='true';assert.deepEqual(await deliverNotificationPush(db,sender,new Date(now.getTime()+400000)),{processed:0,delivered:0});process.env.NOTIFICATION_EVENTS_ENABLED='false'
 })
 await t.test('master OFF, malformed synthetic markers and daily limit fail closed',async()=>{
  const before=(await listNotifications(user,null,db)).items.length
  await db.notification.create({data:{userId:own.id,organizationId:org.id,type:'push_test',entityType:'push_test',entityId:'foreign',title:'QA',body:'QA',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`}})
  assert.equal((await listNotifications(user,null,db)).items.length,before)
  await db.notificationPreference.update({where:{userId_organizationId:{userId:own.id,organizationId:org.id}},data:{pushEnabled:false}})
  await assert.rejects(sendPushPilot(user,b.id,randomUUID(),db,sender,new Date(now.getTime()+600000)),e=>e.status===403)
  await db.notificationPreference.update({where:{userId_organizationId:{userId:own.id,organizationId:org.id}},data:{pushEnabled:true}})
  const count=await db.notification.count({where:{userId:own.id,type:'push_test'}})
  await db.notification.createMany({data:Array.from({length:20-count},()=>{const id=randomUUID();return{id,entityId:id,userId:own.id,organizationId:org.id,type:'push_test',entityType:'push_test',title:'QA',body:'QA',deepLink:'/dashboard',dedupeKey:`push-pilot:${randomUUID()}`}})})
  await assert.rejects(sendPushPilot(user,b.id,randomUUID(),db,sender,new Date(now.getTime()+600000)),e=>e.status===429)
 })
})
