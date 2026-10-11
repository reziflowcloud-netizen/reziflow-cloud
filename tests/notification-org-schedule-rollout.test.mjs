import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {rolloutOrganizationSchedules} from '../scripts/rollout-org-notification-schedules.mjs'
import {notificationScheduleId,notificationSchedules,notificationDestination,notificationQueue,qstashOrigin} from '../src/lib/notificationQstash.mjs'
test('provider transition never has three active schedules, preserves old pilot paused, forwards auth and daily mode',async()=>{
 const secret='synthetic-existing-cron-12345678901234567890',token='synthetic-existing-qstash-12345678901234567890'
 const schedules=new Map([[notificationScheduleId,{scheduleId:notificationScheduleId,isPaused:false,destination:notificationDestination}]])
 let paused=false,maxActive=1;const calls=[]
 const fetchApi=async(url,options)=>{
  assert.ok(url.startsWith(qstashOrigin+'/v2/'));assert.equal(options.headers.Authorization,'Bearer '+token);calls.push(url)
  const route=url.slice(qstashOrigin.length)
  if(route==='/v2/schedules')return Response.json([...schedules.values()])
  if(route==='/v2/queues/'+notificationQueue)return Response.json({parallelism:1,paused})
  if(route==='/v2/schedules/'+notificationDestination){
   const h=options.headers,id=h['Upstash-Schedule-Id'];assert.ok(id!==notificationScheduleId)
   assert.equal(h['Upstash-Forward-Authorization'],'Bearer '+secret);assert.equal(h['Upstash-Queue-Name'],notificationQueue)
   const plan=notificationSchedules.find(s=>s.scheduleId===id);assert.equal(options.body,JSON.stringify(plan.body))
   schedules.set(id,{scheduleId:id,isPaused:false,method:'POST',cron:h['Upstash-Cron'],destination:notificationDestination,retries:2,header:{Authorization:['REDACTED:'+createHash('sha256').update('Bearer '+secret).digest('hex')]},body:'REDACTED:'+createHash('sha256').update(options.body).digest('hex')})
   maxActive=Math.max(maxActive,[...schedules.values()].filter(s=>!s.isPaused).length);assert.ok(maxActive<=2)
   if(h['Upstash-Cron']!=='0 0 1 1 *'){assert.equal(paused,true);assert.equal(schedules.get(notificationScheduleId).isPaused,true)}
   return Response.json({scheduleId:id})
  }
  const action=route.match(/^\/v2\/(schedules|queues)\/([^/]+)\/(pause|resume)$/)
  if(action){if(action[1]==='queues')paused=action[3]==='pause';else schedules.get(action[2]).isPaused=action[3]==='pause';return new Response('')}
  const id=route.match(/^\/v2\/schedules\/([^/]+)$/)?.[1];if(id)return Response.json(schedules.get(id))
  throw new Error('Unexpected API path')
 }
 const prepared=await rolloutOrganizationSchedules({token,secret,confirmation:'PREPARE_ORG_SCHEDULES_PAUSED',fetchApi,now:new Date('2026-10-11T10:00Z')})
 assert.equal(prepared.activeSchedules,0);assert.equal(paused,true)
 const active=await rolloutOrganizationSchedules({token,secret,confirmation:'ACTIVATE_ORG_SCHEDULES',fetchApi})
 assert.equal(active.activeSchedules,2);assert.equal(paused,false);assert.equal(schedules.get(notificationScheduleId).isPaused,true)
 assert.ok(calls.every(x=>!x.includes('/enqueue/')&&!x.includes('/publish/')))
 assert.ok(!JSON.stringify(active).includes(secret)&&!JSON.stringify(active).includes(token))
})
test('configuration refuses unrecognized confirmation and provider auth failure before mutation',async()=>{
 const args={token:'synthetic-qstash-token-12345678901234567890',secret:'synthetic-cron-secret-12345678901234567890'}
 let calls=0
 await assert.rejects(rolloutOrganizationSchedules({...args,confirmation:'GENERATE',fetchApi:async()=>{calls++;return new Response('')}}));assert.equal(calls,0)
 await assert.rejects(rolloutOrganizationSchedules({...args,confirmation:'ACTIVATE_ORG_SCHEDULES',fetchApi:async()=>{calls++;return new Response('',{status:401})}}));assert.equal(calls,1)
})
