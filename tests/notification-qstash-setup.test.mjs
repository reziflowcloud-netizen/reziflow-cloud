import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {setupNotificationQstash} from '../scripts/setup-notification-qstash.mjs'
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
  assert.match(workflow,/inputs.confirmation != 'CONFIGURE_PAUSED_ONLY'/)
  const setupJob=workflow.split('  configure-qstash:')[1]
  assert.match(setupJob,/if: inputs.confirmation == 'CONFIGURE_PAUSED_ONLY'/)
  assert.doesNotMatch(setupJob,/run-notification-job|Run production sweep|actions\/cache/)
  assert.match(workflow,/secrets.NOTIFICATION_PRODUCTION_CRON_SECRET/)
})
