import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
import {NextRequest} from 'next/server.js'
import {setOrganizationAutomation,organizationAutomation} from '../src/lib/notificationOrganization.ts'
import {notificationCandidateQuery} from '../src/lib/notificationCandidates.ts'
import {evaluateNotificationPage,parseEvaluationCursor} from '../src/lib/notificationJobs.ts'
import {notifyAssignment} from '../src/lib/notifications.ts'
import {runQstashNotificationChunk,notificationSchedules} from '../src/lib/notificationQstash.mjs'
const require=createRequire(import.meta.url)
function route(db,actor){const cache=new Map(),overrides={'src/lib/prisma':{prisma:db},'src/lib/notificationRequest':{authenticatedNotificationUser:async()=>actor.current}};function load(file){file=file.replaceAll('\\','/').replace(/\.ts$/,'');if(overrides[file])return overrides[file];if(cache.has(file))return cache.get(file);const result={};cache.set(file,result);new Function('require','exports',ts.transpileModule(fs.readFileSync(file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(id=>id.startsWith('@/')?load('src/'+id.slice(2)):id.startsWith('.')?load(path.join(path.dirname(file),id)):require(id),result);return result}return load('src/app/api/notifications/organization/route')}
test('two shared UTC schedules; empty and <=25 stop, genuine more continues once',async()=>{
 assert.equal(notificationSchedules.length,2);assert.equal(notificationSchedules[0].cron,'*/15 * * * *');assert.equal(notificationSchedules[1].cron,'0 6 * * *')
 for(const n of [0,1,25,26,50,51]){
  let input={},pending,remaining=n,calls=0,enqueues=0
  do{pending=null;const r=await runQstashNotificationChunk({input,messageId:'synthetic-run',secret:'synthetic-secret-12345678901234567890',token:'synthetic-token-12345678901234567890',fetchPage:async()=>{calls++;remaining-=Math.min(25,remaining);return Response.json({evaluated:Math.min(25,n),nextCursor:remaining?'n.'+Buffer.from(JSON.stringify({kind:'frequent',after:'task:synthetic',at:'2026-10-11T08:00:00.000Z'})).toString('base64url'):null,push:{processed:n===25?25:0,delivered:0,more:false}})},enqueue:async job=>{enqueues++;pending=job.continuation}});if(pending)input=pending;else assert.equal(r.complete,true)}while(pending)
  assert.equal(calls,Math.max(1,Math.ceil(n/25)));assert.equal(enqueues,calls-1)
 }
 let url;await runQstashNotificationChunk({input:{mode:'daily'},messageId:'daily-run',secret:'synthetic-secret-12345678901234567890',token:'synthetic-token-12345678901234567890',fetchPage:async target=>{url=target;return Response.json({evaluated:0,nextCursor:null,push:{processed:0,delivered:0,more:false}})},enqueue:async()=>assert.fail('Empty daily continued')});assert.equal(url.searchParams.get('cursor'),'case:')
  let slowContinuation;const slow=await runQstashNotificationChunk({input:{},messageId:'slow-push-run',secret:'synthetic-secret-12345678901234567890',token:'synthetic-token-12345678901234567890',fetchPage:async()=>Response.json({evaluated:10,nextCursor:null,push:{processed:10,delivered:3,more:true}}),enqueue:async job=>{slowContinuation=job.continuation}});assert.equal(slow.complete,false);assert.equal(slowContinuation.state.deliveryOnly,true)
})
test('org opt-in PostgreSQL/API: defaults, role/tenant, activation, gap, history and candidate pagination',{skip:!process.env.NOTIFICATIONS_TEST_DATABASE_URL},async t=>{
 const url=process.env.NOTIFICATIONS_TEST_DATABASE_URL;assert.equal(new URL(url).hostname,'127.0.0.1');const db=new PrismaClient({datasources:{db:{url}},log:[]}),orgs=[],saved={...process.env}
 Object.assign(process.env,{NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'true',NOTIFICATION_SCHEDULED_EVENTS_ENABLED:'true'})
 try{
  const org=await db.organization.create({data:{name:'Synthetic opt-in QA',slug:randomUUID()}}),other=await db.organization.create({data:{name:'Synthetic OFF tenant',slug:randomUUID()}});orgs.push(org.id,other.id)
  const make=(organizationId,role,restrictedAccess=false)=>db.user.create({data:{organizationId,email:randomUUID()+'@example.test',name:'Synthetic',password:'synthetic',role,restrictedAccess}})
  const owner=await make(org.id,'owner'),admin=await make(org.id,'admin'),employee=await make(org.id,'employee'),restricted=await make(org.id,'admin',true),foreign=await make(other.id,'owner')
  const staff=await db.employee.create({data:{organizationId:org.id,userId:employee.id,name:'Synthetic'}})
  await db.notificationPreference.create({data:{organizationId:org.id,userId:employee.id,pushEnabled:true,events:{task_due:{inApp:true,push:false}}}})
  await db.pushSubscription.create({data:{organizationId:org.id,userId:employee.id,endpointHash:randomUUID(),encryptedSubscription:'synthetic-unused',deviceLabel:'Synthetic'}})
  assert.equal(org.notificationAutomationEnabled,false);assert.equal(other.notificationAutomationEnabled,false)
  const actor={current:owner},api=route(db,actor),put=body=>api.PUT(new NextRequest('http://localhost/api/notifications/organization',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))
  for(const u of [employee,restricted]){actor.current=u;assert.equal((await put({enabled:true})).status,403)}
  actor.current=owner;assert.equal((await put({enabled:true,organizationId:other.id})).status,400)
  await assert.rejects(setOrganizationAutomation(db,{id:foreign.id,organizationId:org.id},true),/Forbidden/)
  const historic=await db.task.create({data:{organizationId:org.id,assignedToId:employee.id,title:'Synthetic old assignment',description:JSON.stringify({reminderAt:new Date(Date.now()-60000).toISOString()})}})
  await db.$transaction(tx=>notifyAssignment(tx,'task',historic));assert.equal(await db.notification.count({where:{organizationId:org.id}}),0)
  const response=await put({enabled:true});assert.equal(response.status,200);const first=(await response.json()).automation;assert.equal(first.enabled,true);assert.ok(Date.parse(first.activatedAt)>historic.updatedAt.getTime())
  assert.equal((await setOrganizationAutomation(db,admin,true)).activatedAt,first.activatedAt,'Repeated ON keeps watermark')
  assert.equal((await api.GET()).headers.get('cache-control'),'private, no-store')
  await db.$transaction(tx=>notifyAssignment(tx,'task',historic));assert.equal((await evaluateNotificationPage(parseEvaluationCursor(null),new Date(),db)).notificationsCreated,0)
  const fresh=await db.task.create({data:{organizationId:org.id,assignedToId:employee.id,title:'Synthetic new assignment'}});await db.$transaction(tx=>notifyAssignment(tx,'task',fresh));assert.equal(await db.notification.count({where:{entityId:fresh.id}}),1)
  const count=await db.notification.count({where:{organizationId:org.id}}),preferences=await db.notificationPreference.findUnique({where:{userId_organizationId:{userId:employee.id,organizationId:org.id}}})
  await setOrganizationAutomation(db,owner,false)
  const gap=new Date(Date.now()-1),gapTask=await db.task.create({data:{organizationId:org.id,assignedToId:employee.id,title:'Synthetic OFF gap',description:JSON.stringify({reminderAt:gap.toISOString()})}})
  await db.lead.create({data:{organizationId:org.id,assignedToId:employee.id,employeeId:staff.id,fullName:'Synthetic gap',nextContactAt:gap}})
  await db.$transaction(tx=>notifyAssignment(tx,'task',gapTask));assert.equal((await evaluateNotificationPage(parseEvaluationCursor(null),new Date(),db)).notificationsCreated,0)
  await new Promise(r=>setTimeout(r,5));const again=await setOrganizationAutomation(db,owner,true);assert.ok(Date.parse(again.activatedAt)>Date.parse(first.activatedAt));assert.ok(Date.parse(again.activatedAt)>gap.getTime())
  assert.equal((await evaluateNotificationPage(parseEvaluationCursor(null),new Date(),db)).notificationsCreated,0)
  assert.equal(await db.notification.count({where:{organizationId:org.id}}),count);assert.deepEqual(await db.notificationPreference.findUnique({where:{userId_organizationId:{userId:employee.id,organizationId:org.id}}}),preferences);assert.equal(await db.pushSubscription.count({where:{organizationId:org.id}}),1)
  // Explicit isolated historical clock makes batch boundary tests deterministic.
  const now=new Date('2026-10-11T08:15Z');await db.organization.update({where:{id:org.id},data:{notificationAutomationActivatedAt:new Date('2026-10-11T08:00Z')}})
  await db.task.createMany({data:Array.from({length:51},()=>({organizationId:org.id,assignedToId:employee.id,title:'Synthetic eligible',description:JSON.stringify({reminderAt:'2026-10-11T10:01'})}))})
  await db.task.createMany({data:Array.from({length:500},()=>({organizationId:other.id,assignedToId:foreign.id,title:'Synthetic OFF noise',description:JSON.stringify({reminderAt:'2026-10-11T10:01'})}))})
  assert.equal((await db.$queryRaw(notificationCandidateQuery('frequent','',now))).length,26)
  let cursor=parseEvaluationCursor(null),pages=0,visited=0;do{const result=await evaluateNotificationPage(cursor,now,db);visited+=result.evaluated;pages++;cursor=result.nextCursor?parseEvaluationCursor(result.nextCursor):null}while(cursor)
  assert.equal(pages,3);assert.equal(visited,51);assert.equal((await evaluateNotificationPage(parseEvaluationCursor(null),now,db)).evaluated,0)
  assert.equal(await db.notification.count({where:{organizationId:other.id}}),0)
  await t.test('SQL reminder parsing matches Warsaw DST fold/gap; invalid JSON stays safe',async()=>{
   await db.organization.update({where:{id:org.id},data:{notificationAutomationActivatedAt:new Date(0)}})
   for(const [wall,instant,clock] of [['2026-03-29T02:30','2026-03-29T01:30:00.000Z','2026-03-29T02:00Z'],['2026-10-25T02:30','2026-10-25T00:30:00.000Z','2026-10-25T02:00Z'],['2026-10-25T02:30:00+01:00','2026-10-25T01:30:00.000Z','2026-10-25T02:00Z']]){
    const record=await db.task.create({data:{organizationId:org.id,assignedToId:employee.id,title:'Synthetic DST',description:JSON.stringify({reminderAt:wall})}})
    const rows=await db.$queryRaw(notificationCandidateQuery('task','',new Date(clock),1000));const selected=rows.find(r=>r.id===record.id);assert.ok(selected);assert.equal(selected.occurrence,':'+instant)
    assert.equal((await evaluateNotificationPage({kind:'task',after:''},new Date(clock),db)).notificationsCreated>=1,true)
   }
   for(const description of ['null','[]','plain text','{"reminderAt":"invalid"}'])await db.task.create({data:{organizationId:org.id,assignedToId:employee.id,title:'Synthetic malformed description',description,dueDate:new Date('2026-10-26')}})
   const result=await evaluateNotificationPage({kind:'task',after:''},new Date('2026-10-25T08:00Z'),db);assert.equal(result.notificationsCreated,4)
   const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'QA'}})
   for(const [day,clock,trigger] of [['2026-04-05','2026-03-29T06:00Z','2026-03-28T23:00:00.000Z'],['2026-11-01','2026-10-25T06:00Z','2026-10-24T22:00:00.000Z']]){
    const record=await db.case.create({data:{organizationId:org.id,assignedToId:employee.id,clientId:client.id,cardPickupDate:new Date(day)}})
    const rows=await db.$queryRaw(notificationCandidateQuery('daily','',new Date(clock),1000)),selected=rows.find(r=>r.id===record.id);assert.ok(selected);assert.equal(selected.triggerAt.toISOString(),trigger)
   }
  })
  assert.equal(organizationAutomation(await db.organization.findUnique({where:{id:org.id}})).enabled,true,'Isolated pilot returned ON')
 }finally{await db.organization.deleteMany({where:{id:{in:orgs}}});await db.$disconnect();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}
})
