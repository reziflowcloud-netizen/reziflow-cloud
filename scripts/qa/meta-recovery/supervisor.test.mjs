import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac} from 'node:crypto'
import {createRequire} from 'node:module'
import {PassThrough,Writable} from 'node:stream'
import {EventEmitter} from 'node:events'
import {QA,validateSupervisorConfig,validateNgrokConfig,validatePreflight,appEnvironment,guardianEnvironment,launchFailureTelemetry,earliestCleanupTime,released,QaSupervisor,GuardianClient} from './supervisor.mjs'
const {allowedRequest}=createRequire(import.meta.url)('./supervisor-egress.cjs')
const now=Date.parse('2026-11-10T12:00:00Z'),secret='planted-secret-'.repeat(4),token='planted-page-token-'.repeat(4)
const run='stagea'+'a'.repeat(32),root='D:\\LegalHubStageA-'+'b'.repeat(32)
const databaseUrl='postgresql://fixture:planted@127.0.0.1:55123/legalhub_runner_'+run+'?schema=public'
const configuration=()=>({privateDirectory:root,repo:root+'\\qa-source',databaseUrl,appId:QA.appId,approvedMetaAppId:QA.appId,pageId:QA.pageId,formId:QA.formId,organizationId:'synthetic-organization',appPort:43126,gatePort:43127,enabled:false,workerEnabled:false,approvedTuples:[],pilotLeadIds:[],secrets:{jwt:secret,verifyToken:secret,receiptHmac:secret,worker:secret},hostname:'unit-handsfree-carpentry.ngrok-free.dev',qaPwshExecutable:'C:\\Program Files\\PowerShell\\7\\pwsh.exe',ngrokExe:'C:\\Program Files\\WindowsApps\\Ngrok.Ngrok_fixture\\ngrok.exe',graphVersion:'v27.0',supervisorApproval:{...QA,approvedPwshExecutable:'C:\\Program Files\\PowerShell\\7\\pwsh.exe',approvedAt:new Date(now).toISOString(),deadlineAt:new Date(now+600000).toISOString(),allowEnable:false,allowTunnel:false,hostname:'unit-handsfree-carpentry.ngrok-free.dev',ngrokExe:'C:\\Program Files\\WindowsApps\\Ngrok.Ngrok_fixture\\ngrok.exe',ngrokSha256:'c'.repeat(64),freePlanVerified:true,fullCaptureDisabled:true,hostnameVerified:true,ngrokVerifiedAt:new Date(now).toISOString()}})
const state=()=>({config:{targetKind:'synthetic',privateDirectory:root,expectedHost:'127.0.0.1',expectedApplicationHost:'127.0.0.1'},cluster:{RunId:run,Database:'legalhub_runner_'+run,Port:55123,Uri:databaseUrl}})
const attestation=()=>({...QA,verifiedAt:new Date(now).toISOString(),tokenSha256:createHash('sha256').update(token).digest('hex'),results:{tokenApp:'PASS',tokenPage:'PASS',formOwnership:'PASS'},release:false,approvedLeadId:null,leadCreatedAt:null,dashboardSample:null})
const yaml='version: "3"\nagent:\n  authtoken: "planted_ngrok_token_123456789"\n  console_ui: false\n  inspect_db_size: -1\n  web_addr: false\n  log: false\n  remote_management: false\n'
function fixture(){
 const c=configuration(),calls=[],events=[];let clock=now,real=attestation(),healthy=true
 const d={now:()=>clock,emit:x=>events.push(x),preflight:async()=>calls.push('preflight'),guardian:{start:async()=>calls.push('guardian.start'),launch:async(kind,enabled)=>calls.push('launch.'+kind+'.'+enabled),stopChild:async kind=>calls.push('stopChild.'+kind),healthy:async()=>healthy,stop:async()=>calls.push('guardian.stop')},db:{assertQa:async()=>calls.push('db.assert'),enableBinding:async()=>calls.push('db.enable'),allowLead:async()=>calls.push('db.allowLead'),disableBinding:async()=>calls.push('db.disable'),close:async()=>calls.push('db.close')},ready:async()=>calls.push('app.ready'),gateway:async()=>{calls.push('gate.open');return{seal:()=>calls.push('gate.seal')}},readReal:async()=>real,releaseGate:async r=>{calls.push('gate.release');r.release=true},worker:async()=>calls.push('worker'),closeFiles:async()=>calls.push('files.close')}
 return{c,d,calls,events,service:new QaSupervisor(c,d),setClock:x=>clock=x,setReal:x=>real=x,setHealthy:x=>healthy=x}
}
test('exact synthetic DB, replacement App and bounded explicit approval are required',()=>{
 assert.doesNotThrow(()=>validateSupervisorConfig(configuration(),state(),now))
 const changes=[c=>c.appId='1160353550276176',c=>c.approvedMetaAppId='different',c=>c.pageId='other',c=>c.formId='other',c=>c.databaseUrl=c.databaseUrl.replace('127.0.0.1','remote.invalid'),c=>c.databaseUrl=c.databaseUrl.replace('55123','5432'),c=>c.enabled=true,c=>c.approvedTuples=[{}],c=>c.qaPwshExecutable='C:\\other.exe',c=>c.supervisorApproval.allowEnable='false',c=>c.supervisorApproval.fullCaptureDisabled=false,c=>c.supervisorApproval.freePlanVerified=false,c=>c.supervisorApproval.ngrokSha256='invalid',c=>c.supervisorApproval.deadlineAt=new Date(now+36*60000).toISOString(),c=>c.supervisorApproval.approvedAt=new Date(now+1).toISOString(),c=>c.ngrokExe='C:\\unapproved\\ngrok.exe']
 for(const change of changes){const c=configuration();change(c);assert.throws(()=>validateSupervisorConfig(c,state(),now),/QA_SUPERVISOR_BLOCKED/)}
})
test('missing ngrok token, inspection, extra endpoints or global configuration fail closed',()=>{
 assert.equal(validateNgrokConfig(yaml),true)
 for(const text of [yaml.replace('planted_ngrok_token_123456789',''),yaml.replace('web_addr: false','web_addr: true'),yaml.replace('inspect_db_size: -1','inspect_db_size: 100'),yaml.replace('remote_management: false','remote_management: true'),yaml+'endpoints: []\n'])assert.throws(()=>validateNgrokConfig(text))
})
test('preflight fingerprints exact fresh token and never accepts open startup gate',()=>{
 assert.equal(validatePreflight(configuration(),attestation(),token,secret,now,true),true)
 for(const change of [r=>r.appId='1160353550276176',r=>r.pageId='other',r=>r.results.tokenPage='BLOCKED',r=>r.tokenSha256='d'.repeat(64),r=>r.verifiedAt=new Date(now-3600001).toISOString(),r=>r.verifiedAt=new Date(now+1).toISOString(),r=>r.release=true]){const r=attestation();change(r);assert.throws(()=>validatePreflight(configuration(),r,token,secret,now,true))}
 assert.throws(()=>validatePreflight(configuration(),attestation(),'',secret,now,true))
})
test('app environment is explicit and closed by default with external notifications off',()=>{
 const c=configuration(),env=appEnvironment(c,attestation(),token,secret,false)
 assert.equal(env.META_LEAD_ADS_ENABLED,'false');assert.equal(env.META_LEAD_ADS_WORKER_ENABLED,'false');assert.equal(env.WEB_PUSH_ENABLED,'false');assert.equal(env.META_LEAD_ADS_APPROVED_TUPLES,'[]');assert.equal(env['META_LEAD_ADS_PAGE_TOKEN_'+QA.pageId],undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.HTTP_PROXY,undefined)
 const active=appEnvironment(c,attestation(),token,secret,true);assert.equal(active['META_LEAD_ADS_PAGE_TOKEN_'+QA.pageId],token);assert.equal(JSON.parse(active.META_LEAD_ADS_APPROVED_TUPLES)[0].appId,QA.appId)
})
test('closed startup starts only local app/gateway; no tunnel or worker',async()=>{
 const f=fixture();await f.service.start();await f.service.tick();assert.deepEqual(f.calls,['preflight','guardian.start','db.assert','launch.app.false','app.ready','gate.open']);assert.equal(f.events[0].status,'READY');await f.service.stop()
})
test('enable and tunnel need separate explicit booleans',async()=>{
 const f=fixture();await f.service.start();await assert.rejects(f.service.enable());await assert.rejects(f.service.tunnel());assert.equal(f.calls.includes('db.enable'),false);assert.equal(f.calls.some(x=>x.startsWith('launch.tunnel')),false);await f.service.stop()
})
test('pilot ID is committed before release and worker waits for genuine exact fresh gate',async()=>{
 const f=fixture();f.c.supervisorApproval.allowEnable=true;f.c.supervisorApproval.allowTunnel=true;await f.service.start();await f.service.enable();await f.service.tunnel();await f.service.tick();assert.equal(f.calls.includes('worker'),false)
 const real={...attestation(),approvedLeadId:'900000000000001',leadCreatedAt:new Date(now).toISOString()};f.setReal(real);await f.service.release();await f.service.tick();assert.equal(f.calls.filter(x=>x==='worker').length,1);assert.ok(f.calls.indexOf('db.allowLead')<f.calls.indexOf('gate.release'));await f.service.stop()
})
test('truthy malformed release never enables worker and stale/future lead closes service',async()=>{
 for(const release of ['false',1,false])assert.equal(released(configuration(),{...attestation(),release,approvedLeadId:'900000000000001',leadCreatedAt:new Date(now).toISOString()},now),false)
 for(const date of [new Date(now-600001).toISOString(),new Date(now+1).toISOString(),'bad']){const f=fixture();await f.service.start();f.setReal({...attestation(),leadCreatedAt:date});await f.service.tick();assert.equal(f.service.closing,true)}
})
test('single STOP seals ingress before job termination and always attempts binding cleanup',async()=>{
 const f=fixture();await f.service.start();f.calls.length=0;const first=f.service.stop();const second=f.service.stop();assert.equal(await first,true);assert.equal(await second,true);assert.deepEqual(f.calls,['files.close','gate.seal','guardian.stop','db.disable','db.close']);assert.equal(f.service.controller.signal.aborted,true)
})
test('stop failure is BLOCKED, no raw child/provider error is emitted',async()=>{
 const f=fixture();await f.service.start();f.d.guardian.stop=async()=>{f.calls.push('guardian.unverified');throw Error('planted-private-credential')};assert.equal(await f.service.stop(),false);assert.ok(f.calls.includes('db.disable'));assert.equal(f.events.at(-1).status,'BLOCKED');assert.equal(JSON.stringify(f.events).includes('planted-private'),false)
})
test('guardian parent-death/unhealthy and absolute deadline invoke STOP',async()=>{
 for(const cause of ['parent','deadline']){const f=fixture();await f.service.start();if(cause==='parent')f.setHealthy(false);else f.setClock(now+600001);await f.service.tick();assert.equal(f.service.closing,true);assert.ok(f.calls.includes('guardian.stop'))}
})
test('STOP during preparation cannot launch an app afterwards',async()=>{
 const f=fixture();let release;f.d.preflight=()=>new Promise(r=>release=r);const starting=f.service.start();await f.service.stop();release();await assert.rejects(starting);assert.equal(f.calls.some(x=>x.startsWith('launch.')),false)
})
test('database isolation and Next readiness failures have distinct fixed stage codes',async()=>{
 for(const [slot,code] of [['db','QA_LAUNCH_DB_ISOLATION'],['ready','QA_LAUNCH_NEXT_READY']]){const f=fixture();if(slot==='db')f.d.db.assertQa=async()=>{throw Error('planted-private-provider-error')};else f.d.ready=async()=>{throw Error('planted-private-provider-error')};let report;try{await f.service.start()}catch(error){report=launchFailureTelemetry(error)}assert.equal(report.code,code);assert.equal(JSON.stringify(report).includes('planted-private'),false)}
})
test('cleanup T0 always preserves the earliest closure across repeated STOP and rearm',()=>{
 const early=new Date(now-3600000).toISOString(),late=new Date(now-1000).toISOString();assert.equal(earliestCleanupTime([late,early,null],now),early);assert.equal(earliestCleanupTime([early],now+600000),early);assert.equal(earliestCleanupTime([],now),new Date(now).toISOString());assert.throws(()=>earliestCleanupTime(['invalid'],now));assert.throws(()=>earliestCleanupTime([new Date(now+1).toISOString()],now))
})
test('unknown stdin command closes gates; repeated STOP remains idempotent',async()=>{
 const f=fixture();await f.service.start();await assert.rejects(f.service.command('UNTRUSTED'));await f.service.command('STOP');assert.equal(f.calls.filter(x=>x==='guardian.stop').length,1)
})
function fakeGuardian(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const commands=[];child.stdin=new Writable({write(data,_enc,done){commands.push(JSON.parse(data));done()}});return{child,commands,send:value=>child.stdout.write(JSON.stringify(value)+'\n')}}
test('guardian protocol accepts only fixed bounded acknowledgements',async()=>{
 const f=fakeGuardian(),g=new GuardianClient(f.child);f.send({status:'READY'});await g.start();let pending=g.launch('app',false);assert.deepEqual(f.commands[0],{command:'launch',kind:'app',enabled:false});f.send({status:'LAUNCHED',kind:'app',pid:42});await pending;pending=g.healthy();f.send({status:'HEALTHY'});assert.equal(await pending,true);pending=g.stop();f.send({status:'STOPPED'});await pending;f.child.stdout.end();f.child.stderr.end()
})
test('malformed guardian output cannot leak through protocol errors',async()=>{
 const f=fakeGuardian(),g=new GuardianClient(f.child);const ready=g.start();f.send({status:'planted-private-token'});await assert.rejects(ready,/QA_GUARDIAN_BLOCKED/);f.child.stdout.end();f.child.stderr.end()
})
test('app readiness waits for exact owned listener acknowledgement',async()=>{
 const f=fakeGuardian(),g=new GuardianClient(f.child);f.send({status:'READY'});await g.start();let pending=g.appReady();f.send({status:'APP_WAIT'});assert.equal(await pending,false);pending=g.appReady();f.send({status:'APP_READY'});assert.equal(await pending,true);pending=g.appReady();f.send({status:'BLOCKED'});await assert.rejects(pending,/QA_LAUNCH_BLOCKED/);f.child.stdout.end();f.child.stderr.end()
})
test('only guardian receives approved Git dependency; app and relay baseline remain minimal',()=>{
 const env=guardianEnvironment(root);assert.equal(env.PATH,'C:\\Windows\\System32;C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd');assert.equal(env.PATHEXT,'.EXE');assert.equal(appEnvironment(configuration(),attestation(),token,secret,false).PATH,'C:\\Windows\\System32;C:\\Program Files\\nodejs');assert.equal(appEnvironment(configuration(),attestation(),token,secret,false).PATHEXT,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.HTTP_PROXY,undefined)
})
test('fixed launch-stage diagnostics never inspect raw errors or print provider text',async()=>{
 const poison={get message(){throw Error('do not read')},get stack(){throw Error('do not read')}}
 assert.equal(launchFailureTelemetry(poison,'credentials').code,'QA_LAUNCH_CREDENTIALS');assert.equal(launchFailureTelemetry(poison,'planted-secret').code,'QA_LAUNCH_GUARDIAN_PROTOCOL')
 const f=fakeGuardian(),g=new GuardianClient(f.child);const ready=g.start();f.send({status:'BLOCKED',stage:'git_dependency'});let captured;try{await ready}catch(error){captured=launchFailureTelemetry(error)}assert.equal(captured.code,'QA_LAUNCH_GUARDIAN_GIT_DEPENDENCY');assert.equal(JSON.stringify(captured).includes('planted-secret'),false);f.child.stdout.end();f.child.stderr.end()
})
test('egress permits only exact genuine Lead GET with matching authorization/proof',()=>{
 const c=configuration(),env=appEnvironment(c,attestation(),token,secret,true),r={...attestation(),release:true,approvedLeadId:'900000000000001',leadCreatedAt:new Date(now).toISOString()};const url=new URL('https://graph.facebook.com/v27.0/'+r.approvedLeadId);url.searchParams.set('fields','id,form_id,platform,field_data,created_time');url.searchParams.set('appsecret_proof',createHmac('sha256',secret).update(token).digest('hex'));const options={headers:{Authorization:'Bearer '+token},redirect:'error'}
 assert.equal(allowedRequest(url,options,r,now,env),true)
 for(const mutate of [x=>x.release='false',x=>x.appId='1160353550276176',x=>x.leadCreatedAt=new Date(now+1).toISOString(),x=>x.approvedLeadId='other']){const value={...r};mutate(value);assert.equal(allowedRequest(url,options,value,now,env),false)}
 for(const bad of ['https://other.invalid/v27.0/'+r.approvedLeadId,'http://graph.facebook.com/v27.0/'+r.approvedLeadId,url.href+'&access_token=planted'])assert.equal(allowedRequest(bad,options,r,now,env),false)
 assert.equal(allowedRequest(url,{...options,method:'POST'},r,now,env),false);assert.equal(allowedRequest(url,{...options,headers:{Authorization:'Bearer wrong'}},r,now,env),false)
})
