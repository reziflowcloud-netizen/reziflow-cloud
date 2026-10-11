// Provider configuration only; never invokes application generation or publish.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {notificationSchedules,notificationScheduleId,notificationQueue,notificationDestination,qstashOrigin} from '../src/lib/notificationQstash.mjs'
export async function rolloutOrganizationSchedules({token,secret,confirmation,fetchApi=fetch,now=new Date()}){
 assert.ok(token?.length>=32&&secret?.length>=32)
 assert.ok(['PREPARE_ORG_SCHEDULES_PAUSED','ACTIVATE_ORG_SCHEDULES'].includes(confirmation))
 const api=async(path,method='GET',headers={},body)=>{
  assert.ok(path.startsWith('/v2/schedules')||path.startsWith('/v2/queues'))
  const r=await fetchApi(qstashOrigin+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body})})
  if(!r.ok)throw new Error('Provider configuration failed')
  const text=await r.text();return text?JSON.parse(text):null
 }
 const authHash=`REDACTED:${createHash('sha256').update(`Bearer ${secret}`).digest('hex')}`
 const check=(actual,expected,cron)=>{
  assert.equal(actual.scheduleId,expected.scheduleId);assert.equal(actual.destination,notificationDestination)
  assert.equal(actual.method,'POST');assert.equal(actual.cron,cron);assert.equal(actual.retries,2)
  assert.deepEqual(Object.entries(actual.header||{}).find(([k])=>k.toLowerCase()==='authorization')?.[1],[authHash])
  assert.equal(actual.body,`REDACTED:${createHash('sha256').update(JSON.stringify(expected.body)).digest('hex')}`)
 }
 const all=await api('/v2/schedules')
 assert.ok(all.every(s=>[notificationScheduleId,...notificationSchedules.map(x=>x.scheduleId)].includes(s.scheduleId)),'Unexpected schedule; STOP')
 const queue=await api('/v2/queues/'+notificationQueue);assert.equal(queue.parallelism,1)
 if(confirmation==='PREPARE_ORG_SCHEDULES_PAUSED'){
  assert.ok(now.getUTCMonth()!==0||now.getUTCDate()!==1,'Annual bootstrap safety day excluded')
  const upsert=async(s,cron)=>{
   const created=await api('/v2/schedules/'+notificationDestination,'POST',{'Upstash-Schedule-Id':s.scheduleId,'Upstash-Cron':cron,'Upstash-Queue-Name':notificationQueue,'Upstash-Method':'POST','Upstash-Retries':'2','Upstash-Retry-Delay':'15000','Upstash-Timeout':'55s','Upstash-Forward-Authorization':`Bearer ${secret}`,'Upstash-Redact-Fields':'body,header[Authorization]'},JSON.stringify(s.body))
   assert.equal(created.scheduleId,s.scheduleId)
   await api(`/v2/schedules/${s.scheduleId}/pause`,'POST')
   const actual=await api('/v2/schedules/'+s.scheduleId);check(actual,s,cron);assert.equal(actual.isPaused,true)
  }
  // Annual bootstrap never fires today; each new schedule is paused before the next is created.
  for(const s of notificationSchedules){const existing=all.find(x=>x.scheduleId===s.scheduleId);assert.ok(!existing||existing.isPaused);await upsert(s,'0 0 1 1 *')}
  await api(`/v2/schedules/${notificationScheduleId}/pause`,'POST')
  assert.equal((await api('/v2/schedules/'+notificationScheduleId)).isPaused,true)
  await api(`/v2/queues/${notificationQueue}/pause`,'POST')
  // Old pilot is paused before cadence updates, even if provider upsert briefly resets pause.
  for(const s of notificationSchedules)await upsert(s,s.cron)
 }else{
  const old=await api('/v2/schedules/'+notificationScheduleId);assert.equal(old.isPaused,true)
  for(const s of notificationSchedules){const actual=await api('/v2/schedules/'+s.scheduleId);check(actual,s,s.cron);assert.equal(actual.isPaused,true)}
  await api(`/v2/queues/${notificationQueue}/resume`,'POST')
  for(const s of notificationSchedules)await api(`/v2/schedules/${s.scheduleId}/resume`,'POST')
 }
 const final=await api('/v2/schedules'),active=final.filter(s=>!s.isPaused)
 assert.equal(active.length,confirmation==='ACTIVATE_ORG_SCHEDULES'?2:0)
 assert.equal(final.find(s=>s.scheduleId===notificationScheduleId)?.isPaused,true)
 return {configurationOnly:true,applicationInvoked:false,secretExposed:false,oldPilotPaused:true,activeSchedules:active.length,schedules:notificationSchedules.map(s=>({scheduleId:s.scheduleId,cron:s.cron,mode:s.mode,paused:confirmation!=='ACTIVATE_ORG_SCHEDULES'})),authentication:'PASS',destination:notificationDestination,queueParallelism:1}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await rolloutOrganizationSchedules({token:process.env.QSTASH_NOTIFICATION_SETUP_TOKEN,secret:process.env.NOTIFICATION_PRODUCTION_CRON_SECRET,confirmation:process.env.QSTASH_ORG_ROLLOUT_CONFIRMATION})))}catch{console.error('Organization schedule configuration stopped; no credentials printed.');process.exitCode=1}}
