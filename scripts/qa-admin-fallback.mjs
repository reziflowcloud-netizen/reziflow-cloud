// Real isolated PostgreSQL, authenticated API and real delivery entry point.
// Provider is always injected; no real Push sends or repository env files.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomBytes,createECDH,createHash} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcryptjs'
import {request} from 'playwright'
import evidence from './actualization-source-evidence.cjs'
import {syncDocumentActualization,lockActualizationCase,actualizationTasks,actualizationOwner} from '../src/lib/documentActualization.ts'
import {actualizationDay,actualizationDate} from '../src/lib/documentActualizationPolicy.ts'
import {evaluateNotificationPage} from '../src/lib/notificationJobs.ts'
import {deliverNotificationPush} from '../src/lib/notificationPush.ts'
import {notificationUser,authorizedNotification,listNotifications} from '../src/lib/notifications.ts'
import {encryptSubscription,endpointHash,subscriptionAAD} from '../src/lib/pushSecurity.ts'
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55435');assert.equal(url.pathname,'/actualization_qa')
const db=new PrismaClient(),origin='http://127.0.0.1:3127',contexts=[],report={source:evidence.sourceEvidence(),checks:[]},stamp=Date.now()
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS',name)}
const pair=createECDH('prime256v1');pair.generateKeys()
Object.assign(process.env,{NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'true',NOTIFICATION_SCHEDULED_EVENTS_ENABLED:'true',WEB_PUSH_ENABLED:'true',PUSH_ENVIRONMENT:'development',VAPID_PUBLIC_KEY:pair.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:pair.getPrivateKey().toString('base64url'),VAPID_SUBJECT:'mailto:qa@example.invalid',PUSH_SUBSCRIPTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')})
const now=new Date(),today=actualizationDay(now),base=new Date(today+'T00:00:00Z');base.setUTCDate(base.getUTCDate()-90)
const sync=async(id,activate=true)=>db.$transaction(async tx=>{const r=await tx.case.findUniqueOrThrow({where:{id}});await lockActualizationCase(tx,r.organizationId,id);await syncDocumentActualization(tx,await tx.case.findUniqueOrThrow({where:{id}}),activate)})
const control=async(r)=>(await actualizationTasks(db,r.organizationId,r.id)).find(t=>t.status==='todo')
let org
try {
 await db.organization.updateMany({where:{slug:{startsWith:'admin-fallback-qa-'}},data:{notificationAutomationEnabled:false}})
 org=await db.organization.create({data:{name:'Synthetic Admin Fallback QA',slug:'admin-fallback-qa-'+stamp,settings:{staffScopeFilterEnabled:true}}})
 // Quiesce other synthetic suite tenants only in this dedicated database.
 await db.organization.updateMany({where:{name:'Synthetic Actualization QA'},data:{notificationAutomationEnabled:false}})
 const foreign=await db.organization.create({data:{name:'Synthetic Foreign Fallback',slug:'admin-fallback-foreign-'+stamp}})
 const password=randomBytes(24).toString('hex'),hash=await bcrypt.hash(password,10)
 const mkUser=(name,organizationId,role='admin',restrictedAccess=false)=>db.user.create({data:{name,email:`fallback-${name.toLowerCase()}-${stamp}@example.invalid`,password:hash,organizationId,role,restrictedAccess}})
 const a=await mkUser('adminA',org.id,'owner'),b=await mkUser('adminB',org.id),staff=await mkUser('staff',org.id,'employee',true),other=await mkUser('foreign',foreign.id)
 const employee=await db.employee.create({data:{name:'Synthetic linked employee',organizationId:org.id,userId:staff.id}})
 const foreignEmployee=await db.employee.create({data:{name:'Synthetic foreign employee',organizationId:foreign.id,userId:other.id}})
 const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'Fallback'}})
 const login=async u=>{const c=await request.newContext();contexts.push(c);assert.equal((await c.post(origin+'/api/auth/login',{data:{email:u.email,password}})).status(),200);return c}
 const ca=await login(a),cb=await login(b),cs=await login(staff),cf=await login(other)
 const newCase=async(data={})=>db.case.create({data:{organizationId:org.id,clientId:client.id,predictedDecisionDate:base,...data}})
 const patchCase=async(r,data)=>{const fresh=await db.case.findUniqueOrThrow({where:{id:r.id}});const res=await ca.patch(origin+'/api/cases/'+r.id,{headers:{'X-LegalHub-Case-Write':'versioned'},data:{expectedUpdatedAt:fresh.updatedAt.toISOString(),...data}});assert.equal(res.status(),200,await res.text());return res.json()}
 const r=await newCase();await sync(r.id);let task=await control(r);const taskId=task.id
 await check('all invalid owner mappings, including absent Employee, resolve to fallback',async()=>{
   const cases=[{}, {assignedToId:a.id}, {assignedToId:staff.id,employeeId:employee.id}, {assignedToId:a.id,employeeId:employee.id}, {assignedToId:other.id,employeeId:foreignEmployee.id}, {assignedToId:99999999,employeeId:employee.id}, {assignedToId:staff.id,employeeId:99999999}]
   for(let i=0;i<cases.length;i++){const owner=await actualizationOwner(db,{organizationId:org.id,...cases[i]});assert.equal(owner,i===2?staff.id:null)}
   await db.employee.update({where:{id:employee.id},data:{active:false}});assert.equal(await actualizationOwner(db,{organizationId:org.id,assignedToId:staff.id,employeeId:employee.id}),null);await db.employee.update({where:{id:employee.id},data:{active:true}})
   assert.equal(task.assignedToId,null);assert.equal(JSON.parse(task.description).documentActualization.requiresAssignment,true)
 })
 await check('multiple unlinked admins default/Mine Tasks; linked Case; restricted and foreign denied; one Task',async()=>{
   for(const c of [ca,cb])for(const scope of ['', '?staffScope=mine']){const res=await c.get(origin+'/api/tasks'+scope);assert.equal(res.status(),200,await res.text());assert.equal((await res.json()).filter(t=>t.id===taskId).length,1)}
   assert.equal((await cs.get(origin+'/api/tasks/'+taskId)).status(),404);assert.equal((await cf.get(origin+'/api/tasks/'+taskId)).status(),404)
   assert.equal((await cs.get(origin+'/api/cases/'+r.id)).status(),404);assert.equal((await cf.get(origin+'/api/cases/'+r.id)).status(),404)
   assert.equal((await ca.get(origin+'/api/cases/'+r.id)).status(),200)
   assert.equal((await actualizationTasks(db,org.id,r.id)).length,1)
 })
 await check('master OFF leaves fallback visible and creates no notifications',async()=>{assert.equal((await evaluateNotificationPage({kind:'task',after:''},now,db)).notificationsCreated,0);assert.equal(await db.notification.count({where:{entityId:taskId}}),0)})
 const subs=[]
 for(const u of [a,b]){
   await db.notificationPreference.create({data:{organizationId:org.id,userId:u.id,scope:'mine',pushEnabled:true,showClientName:false}})
   const raw={endpoint:`https://web.push.apple.com/fallback-${stamp}-${u.id}`,keys:{p256dh:pair.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}
   const bind={organizationId:org.id,userId:u.id,endpointHash:endpointHash(raw.endpoint)}
   subs.push(await db.pushSubscription.create({data:{...bind,deviceLabel:'Synthetic QA device',encryptedSubscription:encryptSubscription(raw,subscriptionAAD(bind))}}))
 }
 await db.organization.update({where:{id:org.id},data:{notificationAutomationEnabled:true,notificationAutomationActivatedAt:new Date(now.getTime()-7*86400000)}})
 // Choose a delivery-eligible fixed instant after today's managed reminder.
 const at=new Date(today+'T18:00:00Z')
 const evaluate=()=>evaluateNotificationPage({kind:'task',after:''},at,db)
 await check('repeat/concurrent scheduler creates personal admin copies and dedupes without Team Scope',async()=>{
   await Promise.all([evaluate(),evaluate()]);await evaluate()
   const ns=await db.notification.findMany({where:{entityId:taskId}});assert.equal(ns.length,2);assert.deepEqual(ns.map(n=>n.userId).sort(),[a.id,b.id].sort())
   assert.equal(await db.notificationPushDelivery.count({where:{notification:{entityId:taskId}}}),2)
   for(const u of [a,b]){const fresh=await notificationUser(u.id,org.id,db);const n=ns.find(n=>n.userId===u.id);assert.ok(await authorizedNotification(fresh,n.id,db));assert.ok((await listNotifications(fresh,null,db)).items.some(x=>x.id===n.id))}
   for(const c of [ca,cb]){const response=await c.get(origin+'/api/notifications');assert.equal(response.status(),200);assert.ok((await response.json()).items.some(n=>ns.some(x=>x.id===n.id)))}
 })
 await check('valid responsible and fallback transitions preserve cycle Task and notification history',async()=>{
   await patchCase(r,{employeeId:employee.id});task=await control(r);assert.equal(task.id,taskId);assert.equal(task.assignedToId,staff.id)
   await evaluate();const ns=await db.notification.findMany({where:{entityId:taskId}});assert.equal(ns.length,3)
   const fresh=await notificationUser(a.id,org.id,db);assert.equal(await authorizedNotification(fresh,ns.find(n=>n.userId===a.id).id,db),null)
   let sends=0;await deliverNotificationPush(db,async()=>sends++,at);assert.equal(sends,0)
   await patchCase(r,{employeeId:null});task=await control(r);assert.equal(task.id,taskId);assert.equal(task.assignedToId,null);await evaluate();assert.equal(await db.notification.count({where:{entityId:taskId}}),3)
 })
 const queuedCase=async()=>{const c=await newCase();await sync(c.id);await evaluate();const t=await control(c);const d=await db.notificationPushDelivery.findFirstOrThrow({where:{notification:{entityId:t.id},userId:a.id}});return {c,t,d}}
 const sendScope=q=>({deliveryId:q.d.id,userId:a.id,organizationId:org.id})
 await check('real provider entry sends once per admin, privacy honored, replay sends none',async()=>{
   const q=await queuedCase();let calls=0;const sender=async(_sub,payload)=>{calls++;assert.ok(!JSON.parse(payload).body.includes('Synthetic Fallback'))}
   await deliverNotificationPush(db,sender,at);assert.equal(calls,2);await deliverNotificationPush(db,sender,at);assert.equal(calls,2)
   await patchCase(q.c,{decisionReceived:true})
 })
 await check('fresh revalidation blocks changed role/preferences/master/subscription after early snapshot',async()=>{
   for(const change of ['role','preferences','master','subscription']){
     const q=await queuedCase();let calls=0,changed=false
     // Intercept the first Task snapshot, then mutate before managed lock/revalidation.
     const wrapper=Object.create(db);wrapper.task=new Proxy(db.task,{get(target,key){if(key==='findFirst')return async args=>{const value=await target.findFirst(args);if(!changed){changed=true
       if(change==='role')assert.equal((await cb.patch(origin+'/api/users/'+a.id,{data:{role:'employee'}})).status(),200)
       if(change==='preferences')await db.notificationPreference.update({where:{userId_organizationId:{userId:a.id,organizationId:org.id}},data:{pushEnabled:false}})
       if(change==='master')await db.organization.update({where:{id:org.id},data:{notificationAutomationEnabled:false}})
       if(change==='subscription')await db.pushSubscription.update({where:{id:subs[0].id},data:{disabledAt:new Date()}})
     }return value};return target[key]}})
     await deliverNotificationPush(wrapper,async()=>calls++,at,sendScope(q));assert.equal(calls,0,change);assert.ok(changed,change)
     await db.user.update({where:{id:a.id},data:{role:'owner'}})
     await db.notificationPreference.update({where:{userId_organizationId:{userId:a.id,organizationId:org.id}},data:{pushEnabled:true}})
     await db.organization.update({where:{id:org.id},data:{notificationAutomationEnabled:true}})
     await db.pushSubscription.update({where:{id:subs[0].id},data:{disabledAt:null}})
     await patchCase(q.c,{decisionReceived:true})
   }
 })
 await check('concurrent reassignment API waits for locked provider handoff; no subsequent stale send',async()=>{
   const q=await queuedCase();let entered,release;const entry=new Promise(r=>entered=r),hold=new Promise(r=>release=r);let calls=0
   const sending=deliverNotificationPush(db,async()=>{calls++;entered();await hold},at,sendScope(q))
   await entry;let committed=false;const mutation=patchCase(q.c,{employeeId:employee.id}).then(()=>{committed=true})
   await new Promise(r=>setTimeout(r,150));assert.equal(committed,false);release();await Promise.all([sending,mutation]);assert.equal(calls,1)
   await deliverNotificationPush(db,async()=>calls++,at);assert.equal(calls,1)
 })
 await check('reassignment before scheduler/provider commits prevents stale admin delivery',async()=>{
   const q=await queuedCase();await patchCase(q.c,{employeeId:employee.id});let calls=0
   await Promise.all([evaluate(),deliverNotificationPush(db,async()=>calls++,at,sendScope(q))]);assert.equal(calls,0);assert.equal((await control(q.c)).id,q.t.id)
 })
 await check('scheduler versus confirmed reassignment serializes without stale post-commit delivery',async()=>{
   const q=await queuedCase()
   await Promise.all([evaluate(),patchCase(q.c,{employeeId:employee.id})])
   let calls=0;await deliverNotificationPush(db,async()=>calls++,at,sendScope(q));assert.equal(calls,0)
   const ns=await db.notification.findMany({where:{entityId:q.t.id,userId:a.id}})
   for(const n of ns)assert.equal(await authorizedNotification(await notificationUser(a.id,org.id,db),n.id,db),null)
 })
 await check('Employee mutation API reconciles activated ledger only; inactive and missing links fall back',async()=>{
   const legacy=await newCase({assignedToId:staff.id,employeeId:employee.id}),active=await newCase({assignedToId:staff.id,employeeId:employee.id});await sync(active.id)
   const id=(await control(active)).id
   assert.equal((await ca.patch(origin+'/api/employees/'+employee.id,{data:{active:false}})).status(),200)
   assert.equal((await control(active)).assignedToId,null);assert.equal((await control(active)).id,id);assert.equal((await actualizationTasks(db,org.id,legacy.id)).length,0)
   assert.equal((await ca.patch(origin+'/api/employees/'+employee.id,{data:{active:true}})).status(),200);assert.equal((await control(active)).assignedToId,staff.id)
   assert.equal((await ca.put(origin+'/api/employees/'+employee.id+'/identity',{data:{expectedUserId:staff.id,userId:null,confirmImpact:true}})).status(),200)
   assert.equal((await control(active)).assignedToId,null);assert.equal((await actualizationTasks(db,org.id,legacy.id)).length,0)
 })
 await check('User and Employee deletion APIs reconcile activated cycles and never activate history',async()=>{
   for(const kind of ['users','employees']){
     const temp=await mkUser(kind+'temp',org.id,'employee'),link=await db.employee.create({data:{name:'Synthetic deletion link',organizationId:org.id,userId:temp.id}})
     const active=await newCase({assignedToId:temp.id,employeeId:link.id}),legacy=await newCase({assignedToId:temp.id,employeeId:link.id});await sync(active.id)
     const id=(await control(active)).id
     const response=await ca.delete(origin+'/api/'+kind+'/'+(kind==='users'?temp.id:link.id));assert.equal(response.status(),200,await response.text())
     assert.equal((await control(active)).assignedToId,null);assert.equal((await control(active)).id,id);assert.equal((await actualizationTasks(db,org.id,legacy.id)).length,0)
   }
 })
 await check('personal task event opt-out suppresses only that admin without hiding the Task',async()=>{
   await db.notificationPreference.update({where:{userId_organizationId:{userId:a.id,organizationId:org.id}},data:{events:{task_due:{inApp:false,push:false},task_overdue:{inApp:false,push:false}}}})
   const c=await newCase();await sync(c.id);await evaluate();const t=await control(c)
   assert.equal(await db.notification.count({where:{entityId:t.id,userId:a.id}}),0);assert.equal(await db.notification.count({where:{entityId:t.id,userId:b.id}}),1)
   const response=await ca.get(origin+'/api/tasks?staffScope=mine');assert.ok((await response.json()).some(task=>task.id===t.id))
 })
 await check('latest genuine date +90, service exclusion, decision stop/resume and completed history',async()=>{
   assert.equal(actualizationDate({predictedDecisionDate:'2026-01-01',docUpdates:[{date:'2026-02-01',description:'real'},{date:'2027-01-01',description:'__MOS_ID__:service'}]}),'2026-05-02')
   await patchCase(r,{decisionReceived:true});assert.equal(await control(r),undefined);await patchCase(r,{decisionReceived:false});assert.equal((await control(r)).id,taskId)
   await db.task.update({where:{id:taskId},data:{status:'done'}});await sync(r.id);assert.equal((await db.task.findUniqueOrThrow({where:{id:taskId}})).status,'done')
 })
 await check('ordinary Task Mine scope and Calendar task feed remain unchanged',async()=>{
   const ordinary=await db.task.create({data:{organizationId:org.id,title:'Synthetic ordinary unassigned'}})
   const mine=await ca.get(origin+'/api/tasks?staffScope=mine');assert.equal(mine.status(),200);assert.ok(!(await mine.json()).some(t=>t.id===ordinary.id))
   const all=await ca.get(origin+'/api/tasks?staffScope=all');assert.ok((await all.json()).some(t=>t.id===ordinary.id))
 })
 assert.deepEqual(evidence.sourceEvidence(),report.source);report.runnerSha256=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');report.result='PASS'
 await fs.mkdir('work/admin-fallback-evidence',{recursive:true});await fs.writeFile('work/admin-fallback-evidence/integration.json',JSON.stringify(report,null,2));console.log('PASS admin fallback groups',report.checks.length)
}finally{if(org)await db.organization.update({where:{id:org.id},data:{notificationAutomationEnabled:false}});await Promise.all(contexts.map(c=>c.dispose()));await db.$disconnect()}
