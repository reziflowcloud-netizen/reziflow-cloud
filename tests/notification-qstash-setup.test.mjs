import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {setupNotificationQstash} from '../scripts/setup-notification-qstash.mjs'
import {verifyNotificationTransport} from '../scripts/verify-notification-transport.mjs'
const secret='synthetic-cron-existing-secret-123456789',token='synthetic-qstash-token-not-real-123456789'
test('bootstrap only configures a paused schedule/queue, forwards existing auth and redacts values', async () => {
  const calls=[],id='legalhub-production-notifications',destination='https://legalhubcrm.com/api/internal/notifications'
  const fetchApi=async (url,options)=>{
    assert.ok(url.startsWith('https://qstash-eu-central-1.upstash.io/v2/'))
    calls.push({url,options})
    if(url.endsWith('/schedules'))return Response.json([])
    if(url.endsWith('/schedules/'+id))return Response.json({scheduleId:id,destination,method:'POST',cron:'0 0 1 1 *',retries:2,isPaused:true,header:{Authorization:[`REDACTED:${createHash('sha256').update(`Bearer ${secret}`).digest('hex')}`]}})
    if(url.endsWith('/schedules/'+destination))return Response.json({scheduleId:id})
    return new Response('')
  }
  const result=await setupNotificationQstash({token,secret,confirmation:'CONFIGURE_PAUSED_ONLY',fetchApi,now:new Date('2026-10-11T10:00Z')})
  assert.ok(result.schedulePaused&&result.queuePaused);assert.equal(result.productionGenerationInvoked,false)
  const create=calls.find(c=>c.url.includes('/schedules/https:'))
  assert.equal(create.options.headers['Upstash-Forward-Authorization'],`Bearer ${secret}`)
  assert.equal(create.options.headers['Upstash-Queue-Name'],id)
  assert.ok(!JSON.stringify(result).includes(secret));assert.ok(!JSON.stringify(result).includes(token))
  assert.ok(calls.every(c=>!c.url.includes('/publish/')&&!c.url.includes('/enqueue/')))
  await assert.rejects(setupNotificationQstash({token,secret,confirmation:'ACTIVATE',fetchApi}))
  const workflow=fs.readFileSync('.github/workflows/notification-scheduler.yml','utf8')
  assert.doesNotMatch(workflow,/schedule:|curl|set -x/)
  assert.match(workflow,/inputs.confirmation == ''/)
  const setupJob=workflow.split('  configure-qstash:')[1]
  assert.match(setupJob,/if: inputs.confirmation == 'CONFIGURE_PAUSED_ONLY'/)
  assert.doesNotMatch(setupJob,/run-notification-job|Run production sweep|actions\/cache/)
  assert.match(workflow,/secrets.NOTIFICATION_PRODUCTION_CRON_SECRET/)
})

test('remote diagnostic gate never invokes authenticated GET or business POST and rejects unsafe responses', async () => {
  const calls = []
  const fetchApi = async (url, options) => {
    calls.push({url, options})
    assert.equal(url, 'https://legalhubcrm.com/api/internal/notifications')
    if(options.method === 'POST') assert.deepEqual(JSON.parse(options.body), {mode:'diagnostic'})
    if(options.headers.Authorization === `Bearer ${secret}`) {
      assert.equal(options.method, 'POST')
      return Response.json({diagnostic:true,generationInvoked:false,providerInvoked:false,nextCursorOrchestration:'PASS',chunks:4})
    }
    return new Response('', {status:401})
  }
  const result = await verifyNotificationTransport({secret, fetchApi})
  assert.equal(calls.length, 5); assert.equal(result.httpStatus, 200); assert.equal(result.generationInvoked, false)
  assert.ok(!JSON.stringify(result).includes(secret))
  await assert.rejects(verifyNotificationTransport({secret, fetchApi: async (url, options) => options.headers.Authorization === `Bearer ${secret}` ? Response.json({diagnostic:true,generationInvoked:true}) : new Response('', {status:401})}))
  const workflow=fs.readFileSync('.github/workflows/notification-scheduler.yml','utf8')
  const job=workflow.split('  verify-transport:')[1].split('  activate-qstash-pilot:')[0]
  assert.match(job,/if: inputs.confirmation == 'VERIFY_TRANSPORT_DIAGNOSTIC'/)
  assert.doesNotMatch(job,/run-notification-job|Run production sweep|actions\/cache|QSTASH_NOTIFICATION_SETUP_TOKEN/)
})
