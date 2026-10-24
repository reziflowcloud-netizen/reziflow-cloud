// Real HTTP races with test-only PostgreSQL trigger barriers. Dedicated local DB only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
import evidence from './actualization-source-evidence.cjs'
import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcryptjs'
import {request} from 'playwright'
import {lockActualizationCase,syncDocumentActualization,actualizationTasks} from '../src/lib/documentActualization.ts'
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55435');assert.equal(url.pathname,'/actualization_qa')
const db=new PrismaClient(),origin='http://127.0.0.1:3127',stamp=Date.now(),expectOld=process.argv.includes('--expect-deadlock'),report={source:evidence.sourceEvidence(),mode:expectOld?'checkpoint-reproduction':'corrected',checks:[]},contexts=[]
let org
try{
 for(const table of ['DocUpdate','Case','CaseChecklistItem'])await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_fallback_lock_barrier ON "${table}"`)
 const deadlocksBefore=Number((await db.$queryRawUnsafe('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()'))[0].deadlocks)
 const password=randomBytes(24).toString('hex'),hash=await bcrypt.hash(password,10)
 org=await db.organization.create({data:{name:'Synthetic Lock Order QA',slug:'fallback-lock-'+stamp,notificationAutomationEnabled:true,notificationAutomationActivatedAt:new Date('2020-01-01')}})
 const user=await db.user.create({data:{organizationId:org.id,name:'Synthetic Lock Owner',email:`lock-${stamp}@example.invalid`,password:hash,role:'owner'}})
 const ctx=await request.newContext();contexts.push(ctx);assert.equal((await ctx.post(origin+'/api/auth/login',{data:{email:user.email,password}})).status(),200)
 const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'Lock race'}})
 for(const [index,writerKind,identityKind] of [[0,'DocUpdate','deactivation'],[1,'DocUpdate','identity'],[2,'Case','deactivation'],[3,'Checklist','deactivation']]){
   const employee=await db.employee.create({data:{organizationId:org.id,name:'Synthetic Lock Employee '+index}})
   const r=await db.case.create({data:{organizationId:org.id,clientId:client.id,assignedToId:user.id,employeeId:employee.id,predictedDecisionDate:new Date('2026-01-01'),checklistInitializedAt:new Date(),documentsReady:false}})
   // Explicit active link for readiness. Each fixture uses its own User because Employee.userId is unique.
   const responsible=await db.user.create({data:{organizationId:org.id,name:'Synthetic Responsible '+index,email:`lock-staff-${index}-${stamp}@example.invalid`,password:hash,role:'employee'}})
   await db.employee.update({where:{id:employee.id},data:{userId:responsible.id}});await db.case.update({where:{id:r.id},data:{assignedToId:responsible.id}})
   await db.$transaction(async tx=>{await lockActualizationCase(tx,org.id,r.id);await syncDocumentActualization(tx,await tx.case.findUniqueOrThrow({where:{id:r.id}}),true)})
   const previous=(await actualizationTasks(db,org.id,r.id))[0]
   if(index===1)await db.task.update({where:{id:previous.id},data:{status:'done'}})
   const history=await db.notification.create({data:{organizationId:org.id,userId:user.id,type:'task_overdue',title:'Synthetic preserved history',body:'Synthetic only',entityType:'task',entityId:previous.id,deepLink:'/tasks?notificationTask='+previous.id,dedupeKey:'task_overdue:task:'+previous.id+':2026-04-01',inApp:true,pushRequested:false}})
   const item=writerKind==='Checklist'?await db.caseChecklistItem.create({data:{caseId:r.id,name:'Synthetic required item',nameKey:'synthetic required item',required:true,forMos:false,sortOrder:0}}):null
   // Compile real routes before the bounded lock barrier; build/browser load must
   // not consume the barrier's wait budget before the request reaches PostgreSQL.
   if(writerKind==='DocUpdate')await ctx.post(origin+'/api/cases/'+r.id+'/doc-updates',{data:{}})
   if(writerKind==='Case')await ctx.patch(origin+'/api/cases/'+r.id,{data:{}})
   if(writerKind==='Checklist')await ctx.patch(origin+'/api/cases/'+r.id+'/checklist/'+item.id,{data:{}})
   await ctx.patch(origin+'/api/employees/'+employee.id,{data:{name:'Synthetic Lock Employee '+index}})
   if(identityKind==='identity')await ctx.put(origin+'/api/employees/'+employee.id+'/identity',{data:{expectedUserId:responsible.id,userId:responsible.id,confirmImpact:true}})
   const key=7811230+index,table=writerKind==='DocUpdate'?'DocUpdate':writerKind==='Case'?'Case':'CaseChecklistItem',event=writerKind==='DocUpdate'?'INSERT':'UPDATE',field=writerKind==='Case'?'id':'caseId'
   assert.match(r.id,/^[a-z0-9]+$/)
   await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION public.qa_fallback_lock_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."${field}" = '${r.id}' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$`)
   await db.$executeRawUnsafe(`CREATE TRIGGER qa_fallback_lock_barrier AFTER ${event} ON "${table}" FOR EACH ROW EXECUTE FUNCTION public.qa_fallback_lock_barrier()`)
   let release,locked;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>locked=resolve)
   const holding=db.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock($1::bigint)',key);locked();await gate},{timeout:20000})
   await ready
   const fresh=await db.case.findUniqueOrThrow({where:{id:r.id}})
   const pendingWrite=writerKind==='DocUpdate'?ctx.post(origin+'/api/cases/'+r.id+'/doc-updates',{data:{date:'2026-02-01',description:'Synthetic next-cycle race',expectedUpdatedAt:fresh.updatedAt.toISOString()}}):writerKind==='Case'?ctx.patch(origin+'/api/cases/'+r.id,{headers:{'X-LegalHub-Case-Write':'versioned'},data:{expectedUpdatedAt:fresh.updatedAt.toISOString(),predictedDecisionDate:'2026-02-01'}}):ctx.patch(origin+'/api/cases/'+r.id+'/checklist/'+item.id,{data:{expectedVersion:item.version,status:'RECEIVED'}})
   const writing=pendingWrite.then(response=>({response}),error=>({error:error.name}))
   let paused=false
   for(let n=0;n<150;n++){const rows=await db.$queryRawUnsafe('SELECT 1 FROM pg_locks WHERE locktype=\'advisory\' AND objid=$1::oid AND NOT granted',key);if(rows.length){paused=true;break}await new Promise(resolve=>setTimeout(resolve,50))}
   assert.ok(paused,'real API writer reached the test-only barrier after Case lock')
   const changing=identityKind==='identity'?ctx.put(origin+'/api/employees/'+employee.id+'/identity',{data:{expectedUserId:responsible.id,userId:null,confirmImpact:true}}):ctx.patch(origin+'/api/employees/'+employee.id,{data:{active:false}})
   await new Promise(resolve=>setTimeout(resolve,300));release();await holding
   const [writeResult,firstIdentityResponse]=await Promise.all([writing,changing]);let identityResponse=firstIdentityResponse;const initialStatuses=[writeResult.response?.status(),firstIdentityResponse.status()];let confirmedRetry=false
   if(!expectOld&&identityKind==='identity'&&firstIdentityResponse.status()===409){
     const conflict=await firstIdentityResponse.json();assert.match(conflict.error,/concurrently|refresh|retry/i)
     const current=await ctx.get(origin+'/api/employees/'+employee.id+'/identity');assert.equal(current.status(),200);const currentLink=(await current.json()).userId;assert.equal(currentLink,responsible.id)
     identityResponse=await ctx.put(origin+'/api/employees/'+employee.id+'/identity',{data:{expectedUserId:currentLink,userId:null,confirmImpact:true}});confirmedRetry=true
   }
   assert.ok(writeResult.response,'writer request failed: '+writeResult.error);const writeResponse=writeResult.response;const statuses=[writeResponse.status(),identityResponse.status()]
   const bodies=await Promise.all([writeResponse.text(),identityResponse.text()])
   await db.$executeRawUnsafe(`DROP TRIGGER qa_fallback_lock_barrier ON "${table}"`)
   const row={writerKind,identityKind,initialStatuses,confirmedRetry,statuses,deadlock:bodies.some(b=>/deadlock|40P01/i.test(b))}
   report.checks.push(row)
   if(!expectOld){assert.deepEqual(statuses,[200,200],JSON.stringify(row)+' '+bodies.join('\n'));const tasks=await actualizationTasks(db,org.id,r.id);assert.equal(tasks.filter(t=>t.status==='todo').length,1);assert.equal(tasks.find(t=>t.status==='todo').assignedToId,null)
     if(writerKind!=='Checklist'){assert.equal(tasks.find(t=>t.status==='todo').dueDate.toISOString().slice(0,10),'2026-05-02');assert.equal(tasks.find(t=>t.id===previous.id).status,index===1?'done':'inactive')}
   }
   assert.ok(await db.notification.findUnique({where:{id:history.id}}),'stored inactive/completed cycle notification history remains intact')
   console.log(expectOld?'REPRO':'PASS',writerKind,'vs',identityKind,JSON.stringify(row))
 }
 await db.$executeRawUnsafe('DROP FUNCTION public.qa_fallback_lock_barrier()')
 await new Promise(resolve=>setTimeout(resolve,1200))
 const deadlocksAfter=Number((await db.$queryRawUnsafe('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()'))[0].deadlocks)
 report.deadlocks={before:deadlocksBefore,after:deadlocksAfter,delta:deadlocksAfter-deadlocksBefore}
 if(!expectOld)assert.equal(report.deadlocks.delta,0,'PostgreSQL must report zero new deadlocks, including generic error wrappers')
 if(expectOld)assert.ok(report.checks.some(r=>r.deadlock),'checkpoint race must reproduce a real deadlock')
 assert.deepEqual(evidence.sourceEvidence(),report.source);report.runnerSha256=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')
 report.result=expectOld?'DEADLOCK REPRODUCED':'PASS';await fs.mkdir('work/admin-fallback-evidence',{recursive:true});await fs.writeFile('work/admin-fallback-evidence/'+(expectOld?'checkpoint-lock-reproduction.json':'lock-order.json'),JSON.stringify(report,null,2))
}finally{
 // Test DDL is local to this synthetic database and always removed after failure.
 for(const table of ['DocUpdate','Case','CaseChecklistItem'])await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_fallback_lock_barrier ON "${table}"`).catch(()=>{})
 await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS public.qa_fallback_lock_barrier()').catch(()=>{})
 if(org)await db.organization.update({where:{id:org.id},data:{notificationAutomationEnabled:false}})
 await Promise.all(contexts.map(c=>c.dispose()));await db.$disconnect()
}
