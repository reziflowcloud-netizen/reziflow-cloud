import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { activateNotificationQstash } from '../scripts/activate-notification-qstash.mjs'
const secret = 'synthetic-existing-cron-secret-123456789', token = 'synthetic-rotated-qstash-token-123456789'
const id = 'legalhub-production-notifications', destination = 'https://legalhubcrm.com/api/internal/notifications'
function provider({ missing = false, foreign = false, otherActive = false, authMismatch = false, pending = false, resumeFailure = false, diagnosticFailure = false } = {}) {
  let schedule = { scheduleId:id, destination: foreign ? 'https://foreign.invalid' : destination, method:'POST', cron:'0 0 1 1 *', retries:2, isPaused:true, header:{Authorization:[`REDACTED:${createHash('sha256').update(`Bearer ${authMismatch ? 'wrong' : secret}`).digest('hex')}`]} }
  let queue = {paused:true, parallelism:1, lag:pending ? 1 : -2}
  const calls = []
  const fetchApi = async (url, options) => {
    calls.push({url,options})
    if(url === destination) {
      if(options.headers.Authorization !== `Bearer ${secret}`) return new Response('',{status:401})
      assert.equal(options.method,'POST'); assert.deepEqual(JSON.parse(options.body),{mode:'diagnostic'})
      return Response.json({diagnostic:true,generationInvoked:diagnosticFailure,providerInvoked:false,nextCursorOrchestration:'PASS',chunks:4})
    }
    assert.ok(url.startsWith('https://qstash-eu-central-1.upstash.io/v2/'))
    if(url.endsWith('/schedules')) return Response.json([...(missing ? [] : [schedule]),...(otherActive ? [{scheduleId:'foreign-schedule',isPaused:false}] : [])])
    if(url.endsWith('/schedules/'+destination)) {
      assert.equal(queue.paused,true)
      assert.equal(options.headers['Upstash-Schedule-Id'],id)
      assert.equal(options.headers['Upstash-Forward-Authorization'],`Bearer ${secret}`)
      assert.equal(options.headers['Upstash-Redact-Fields'],'body,header[Authorization]')
      assert.equal(options.headers['Upstash-Queue-Name'],id)
      assert.equal(options.body,'{}')
      schedule={...schedule,cron:options.headers['Upstash-Cron'],isPaused:false}
      return Response.json({scheduleId:id})
    }
    if(url.endsWith('/schedules/'+id)) return Response.json(schedule)
    if(url.endsWith('/queues/'+id)) return Response.json(queue)
    if(url.endsWith('/schedules/'+id+'/resume')) {
      if(resumeFailure) return new Response('',{status:500})
      schedule.isPaused=false
    } else if(url.endsWith('/schedules/'+id+'/pause')) schedule.isPaused=true
    else if(url.endsWith('/queues/'+id+'/resume')) queue.paused=false
    else if(url.endsWith('/queues/'+id+'/pause')) queue.paused=true
    else assert.fail('Unexpected provider endpoint')
    return new Response('')
  }
  return {fetchApi,calls,state:()=>({schedule,queue})}
}
const args = {token,secret,confirmation:'ACTIVATE_TESTREZIDENTS_PILOT'}
test('activation updates only the existing schedule with original auth, verifies diagnostic, then resumes',async()=>{
  const p=provider(),result=await activateNotificationQstash({...args,fetchApi:p.fetchApi})
  assert.equal(result.scheduleActive,true); assert.equal(result.cron,'*/15 * * * *')
  assert.equal(result.manualBusinessGenerationInvoked,false)
  assert.ok(!JSON.stringify(result).includes(secret)&&!JSON.stringify(result).includes(token))
  assert.ok(p.calls.every(c=>!c.url.includes('/publish/')&&!c.url.includes('/enqueue/')))
  assert.equal(p.calls.filter(c=>c.url.endsWith('/schedules/'+destination)).length,1)
  const appCalls=p.calls.filter(c=>c.url===destination)
  assert.equal(appCalls.length,5)
  assert.ok(appCalls.filter(c=>c.options.headers.Authorization===`Bearer ${secret}`).every(c=>c.options.method==='POST'&&c.options.body==='{"mode":"diagnostic"}'))
  const workflow=fs.readFileSync('.github/workflows/notification-scheduler.yml','utf8')
  const job=workflow.split('  activate-qstash-pilot:')[1]
  assert.match(job,/if: inputs.confirmation == 'ACTIVATE_TESTREZIDENTS_PILOT'/)
  assert.doesNotMatch(job,/run-notification-job|actions\/cache|set -x|curl|schedule:/)
  assert.match(workflow,/inputs.confirmation == ''/)
})
test('activation refuses missing/foreign/active schedule, wrong original auth, queued work or unsafe diagnostic before mutation',async()=>{
  for(const flags of [{missing:true},{foreign:true},{otherActive:true},{authMismatch:true},{pending:true},{diagnosticFailure:true}]) {
    const p=provider(flags)
    await assert.rejects(activateNotificationQstash({...args,fetchApi:p.fetchApi}))
    assert.ok(p.calls.filter(c=>c.url.startsWith('https://qstash-')).every(c=>c.options.method==='GET'))
  }
  const p=provider()
  await assert.rejects(activateNotificationQstash({...args,confirmation:'',fetchApi:p.fetchApi}))
  assert.equal(p.calls.length,0)
})
test('partial activation failure pauses both schedule and queue instead of leaving delivery active',async()=>{
  const p=provider({resumeFailure:true})
  await assert.rejects(activateNotificationQstash({...args,fetchApi:p.fetchApi}))
  assert.equal(p.state().schedule.isPaused,true);assert.equal(p.state().queue.paused,true)
  assert.ok(p.calls.some(c=>c.url.endsWith('/queues/'+id+'/pause')))
})
