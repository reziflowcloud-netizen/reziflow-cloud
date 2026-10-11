import assert from 'node:assert/strict'
import test from 'node:test'
import {randomUUID} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
import {assignmentEventsEnabled,notificationEventAllowed} from '../src/lib/notificationEventGate.ts'
import {pushUserAllowed} from '../src/lib/pushSecurity.ts'
import {scheduledOccurrences,occurrenceTriggerAt} from '../src/lib/notificationOccurrence.ts'
import {evaluateNotificationPage,parseEvaluationCursor} from '../src/lib/notificationJobs.ts'
import {notifyAssignment} from '../src/lib/notifications.ts'
const activation='2026-10-11T08:00:00.000Z'
function env(run){const saved={...process.env};try{Object.assign(process.env,{NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'true',NOTIFICATION_SCHEDULED_EVENTS_ENABLED:'true',NOTIFICATION_EVENTS_GLOBAL_ENABLED:'true',NOTIFICATION_EVENTS_GLOBAL_SINCE:activation,NOTIFICATION_EVENTS_PILOT_ORG_IDS:'old-pilot',NOTIFICATION_EVENTS_PILOT_USER_IDS:'16',WEB_PUSH_PILOT_USER_IDS:'16'});return run()}finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}}
test('global flag is independent of old allowlists; tenant persistence gates generation',()=>env(()=>{
 assert.equal(notificationEventAllowed('lead_assigned','other-tenant',99),true);assert.equal(pushUserAllowed(99),true);assert.equal(pushUserAllowed(-1),false)
 delete process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS;delete process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS
 assert.equal(assignmentEventsEnabled(),true)
 process.env.NOTIFICATION_EVENTS_ENABLED='false';assert.equal(assignmentEventsEnabled(),false)
}))
test('original Warsaw triggers block historical backlog but retain future occurrences and unchanged identities',()=>{
 const since=new Date(activation),now=new Date('2026-10-11T08:15:00Z')
 for(const r of [{status:'todo',dueDate:'2026-10-10'},{status:'todo',dueDate:'2026-10-12'},{status:'todo',description:JSON.stringify({reminderAt:'2026-10-11T09:59'})}])assert.equal(scheduledOccurrences('task',r,now,since).length,0)
 assert.equal(scheduledOccurrences('lead',{nextContactAt:'2026-10-11T07:59:59Z'},now,since).length,0)
 assert.equal(scheduledOccurrences('case',{cardPickupDate:'2026-10-18'},now,since).length,0)
 assert.deepEqual(scheduledOccurrences('task',{status:'todo',description:JSON.stringify({reminderAt:'2026-10-11T10:00'})},now,since),[{type:'task_due',occurrence:':2026-10-11T08:00:00.000Z'}])
 assert.equal(scheduledOccurrences('lead',{nextContactAt:activation},now,since).length,1)
 assert.equal(scheduledOccurrences('task',{dueDate:'2026-10-11',status:'todo'},new Date('2026-10-12T00:00Z'),since)[0].type,'task_overdue')
 assert.equal(scheduledOccurrences('task',{dueDate:'2026-10-13',status:'todo'},new Date('2026-10-12T00:00Z'),since)[0].type,'task_due')
 assert.equal(scheduledOccurrences('case',{cardPickupDate:'2026-10-19'},new Date('2026-10-12T00:00Z'),since)[0].occurrence,'cardPickupDate:2026-10-19:7d')
 assert.equal(scheduledOccurrences('case',{cardPickupDate:'2026-10-13'},new Date('2026-10-12T00:00Z'),since)[0].occurrence,'cardPickupDate:2026-10-13:1d')
 assert.equal(new Date(occurrenceTriggerAt({type:'task_due',occurrence:'2026-03-30:default'})).toISOString(),'2026-03-28T23:00:00.000Z')
 assert.equal(new Date(occurrenceTriggerAt({type:'task_overdue',occurrence:'2026-10-25'})).toISOString(),'2026-10-25T23:00:00.000Z')
 // Pilot history keeps original catch-up and read/badge semantics.
 assert.equal(scheduledOccurrences('lead',{nextContactAt:'2020-01-01'},now,null).length,1)
})
test('general mode PostgreSQL: independent tenants, own/team, unlinked skip, preferences, historical boundary and retry', {skip:!process.env.NOTIFICATIONS_TEST_DATABASE_URL},async()=>{
 const saved={...process.env},url=process.env.NOTIFICATIONS_TEST_DATABASE_URL;assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));const db=new PrismaClient({datasources:{db:{url}},log:[]});const orgs=[]
 Object.assign(process.env,{NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'true',NOTIFICATION_SCHEDULED_EVENTS_ENABLED:'true',NOTIFICATION_EVENTS_GLOBAL_ENABLED:'true',NOTIFICATION_EVENTS_GLOBAL_SINCE:activation});delete process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS;delete process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS
 try{
  const tenants=[];for(let i=0;i<2;i++){const org=await db.organization.create({data:{name:'Synthetic general QA', notificationAutomationEnabled: true, notificationAutomationActivatedAt: new Date(activation),slug:randomUUID()}});orgs.push(org.id);const user=await db.user.create({data:{organizationId:org.id,email:randomUUID()+'@example.test',name:'Synthetic',password:'synthetic',role:'employee'}});const owner=await db.user.create({data:{organizationId:org.id,email:randomUUID()+'@example.test',name:'Synthetic',password:'synthetic',role:'owner'}});await db.notificationPreference.create({data:{organizationId:org.id,userId:owner.id,scope:'team'}});const employee=await db.employee.create({data:{organizationId:org.id,userId:user.id,name:'Synthetic'}});tenants.push({org,user,owner,employee})}
  const records=[];for(const t of tenants){
   const historic=await db.task.create({data:{organizationId:t.org.id,assignedToId:t.user.id,title:'Synthetic historical',dueDate:new Date('2026-10-10')}})
   const task=await db.task.create({data:{organizationId:t.org.id,assignedToId:t.user.id,title:'Synthetic upcoming',description:JSON.stringify({reminderAt:'2026-10-11T10:01'})}});records.push(task)
   await db.lead.create({data:{organizationId:t.org.id,assignedToId:t.user.id,employeeId:t.employee.id,fullName:'Synthetic historical',nextContactAt:new Date('2020-01-01')}})
   await db.lead.create({data:{organizationId:t.org.id,assignedToId:t.user.id,fullName:'Synthetic upcoming',nextContactAt:new Date('2026-10-11T08:01Z')}})
   const orphan=await db.employee.create({data:{organizationId:t.org.id,name:'Synthetic unlinked'}})
   await db.lead.create({data:{organizationId:t.org.id,assignedToId:t.user.id,employeeId:orphan.id,fullName:'Synthetic unlinked',nextContactAt:new Date('2026-10-11T08:01Z')}})
   await db.task.create({data:{organizationId:t.org.id,assignedToId:tenants.find(x=>x!==t).user.id,title:'Synthetic foreign',description:JSON.stringify({reminderAt:'2026-10-11T10:01'})}})
   assert.equal(await db.notification.count({where:{entityId:historic.id}}),0)
  }
  const sweep=async()=>{let cursor=parseEvaluationCursor(null);while(cursor){const r=await evaluateNotificationPage(cursor,new Date('2026-10-11T08:15Z'),db);cursor=r.nextCursor?parseEvaluationCursor(r.nextCursor):null}}
  await sweep();await sweep();const notes=await db.notification.findMany({where:{organizationId:{in:orgs}}});assert.equal(notes.length,8)
  for(const t of tenants){assert.equal(notes.filter(n=>n.organizationId===t.org.id&&n.userId===t.user.id).length,2);assert.equal(notes.filter(n=>n.organizationId===t.org.id&&n.userId===t.owner.id).length,2)}
  assert.equal(await db.notificationPushDelivery.count({where:{organizationId:{in:orgs}}}),0,'non-subscribed users have no deliveries')
  for(const r of records){await db.$transaction(tx=>notifyAssignment(tx,'task',r));await db.$transaction(tx=>notifyAssignment(tx,'task',r))};assert.equal(await db.notification.count({where:{organizationId:{in:orgs},type:'task_assigned'}}),4)
 }finally{await db.notification.deleteMany({where:{organizationId:{in:orgs}}});for(const kind of ['task','lead','employee','user'])await db[kind].deleteMany({where:{organizationId:{in:orgs}}});await db.organization.deleteMany({where:{id:{in:orgs}}});await db.$disconnect();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}
})
