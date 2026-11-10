import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,link} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID,createHash} from 'node:crypto'
import {observedDashboardCanonical,armDashboardSample} from './dashboard-arm.mjs'
const APP='2523488421395251',PAGE='1449474971582722',FORM='2046130655900851',DUMMY='444444444444'
const TOKEN='EAA'+'SyntheticPageOnly'.repeat(5),SECRET='PlantedGeneratedQaSecretOnly'.repeat(2)
const sample=()=>({object:'page',entry:[{id:'0',time:1700000000,changes:[{field:'leadgen',value:{page_id:DUMMY,form_id:DUMMY,leadgen_id:DUMMY,ad_id:DUMMY,adgroup_id:DUMMY,created_time:1700000000}}]}]})
async function fixture(t){
 const parent=await mkdtemp(join(tmpdir(),'legalhub-dashboard-arm-'));t.after(()=>rm(parent,{recursive:true,force:true}))
 const root=join(parent,'LegalHubStageA-'+randomUUID().replaceAll('-','')),artifacts=join(parent,'artifacts');await mkdir(root);await mkdir(artifacts)
 const run='stagea'+randomUUID().replaceAll('-',''),uri='postgresql://fixture:fixture@127.0.0.1:55123/legalhub_runner_'+run+'?schema=public'
 const c={privateDirectory:root,repo:join(root,'qa-source'),appId:APP,approvedMetaAppId:APP,pageId:PAGE,formId:FORM,appPort:43126,gatePort:43127,databaseUrl:uri,enabled:false,workerEnabled:false,approvedTuples:[],pilotLeadIds:[],secrets:{jwt:SECRET}}
 const db={config:{targetKind:'synthetic',privateDirectory:root,expectedHost:'127.0.0.1',expectedApplicationHost:'127.0.0.1'},cluster:{RunId:run,Port:55123,Database:'legalhub_runner_'+run,Uri:uri}}
 const t0=new Date(Date.now()-7200000).toISOString()
 const state={appId:APP,pageId:PAGE,formId:FORM,release:false,approvedLeadId:null,leadCreatedAt:null,dashboardSample:null,createAttemptAt:null,verifiedAt:new Date().toISOString(),tokenSha256:createHash('sha256').update(TOKEN).digest('hex'),results:{tokenApp:'PASS',tokenPage:'PASS',formOwnership:'PASS'},closedAt:t0,earliestClosedAt:t0,previousTestLead:null}
 for(const [name,value] of Object.entries({'qa-owned.txt':'LegalHub Stage A synthetic QA','runtime.json':JSON.stringify(c),'cluster-state.json':JSON.stringify(db),'meta-real-private.json':JSON.stringify(state),'meta-page-token.txt':TOKEN}))await writeFile(join(root,name),value,{mode:0o600})
 const publicSampleFile=join(parent,'dashboard-sample-public.json');await writeFile(publicSampleFile,JSON.stringify(sample()))
 const resultFile=join(artifacts,'result.json');await writeFile(resultFile,'{"phase":"dashboard_sample","status":"BLOCKED"}')
 return {root,c,db,state,publicSampleFile,resultFile,read:async()=>JSON.parse(await readFile(join(root,'meta-real-private.json'),'utf8')),options:{privateRoot:root,publicSampleFile,uiObservedInQaDashboard:true,assertPrivateFile:async()=>true,artifacts:{root:artifacts,paths:[resultFile]}}}
}
function safe(result){const text=JSON.stringify(result);for(const value of [TOKEN,SECRET,APP,PAGE,FORM,DUMMY,'expectedCanonical','expiresAt'])assert.equal(text.includes(value),false);assert.equal(result.counts.requests,0);assert.equal(result.counts.tests,0)}

test('observed sample keeps canonical value types and admits only known placeholder schema',()=>{
 const body=sample(),value=observedDashboardCanonical(body)
 assert.equal(value,'{"entry":[{"changes":[{"field":"leadgen","value":{"ad_id":"444444444444","adgroup_id":"444444444444","created_time":1700000000,"form_id":"444444444444","leadgen_id":"444444444444","page_id":"444444444444"}}],"id":"0","time":1700000000}],"object":"page"}')
 const numeric=sample();numeric.entry[0].id=0;numeric.entry[0].changes[0].value.page_id=444444444444
 assert.equal(JSON.parse(observedDashboardCanonical(numeric)).entry[0].id,0)
 for(const mutate of [x=>x.object='instagram',x=>x.extra='anything',x=>x.entry[0].id=PAGE,x=>x.entry[0].changes.push(x.entry[0].changes[0]),x=>x.entry[0].changes[0].field='messages',x=>x.entry[0].changes[0].value.page_id=PAGE,x=>x.entry[0].changes[0].value.form_id=FORM,x=>x.entry[0].changes[0].value.leadgen_id='900000000000001',x=>x.entry[0].changes[0].value.field_data=[],x=>x.entry[0].changes[0].value.email='contact@example.invalid',x=>x.entry[0].changes[0].value.ad_id=APP,x=>x.entry[0].time='1700000000',x=>x.entry[0].changes[0].value.is_organic='false']){const bad=sample();mutate(bad);assert.throws(()=>observedDashboardCanonical(bad),/PUBLIC_SAMPLE_REFUSED/)}
})
test('arming changes only dashboardSample, expires in 55 seconds and preserves proof/closure/runtime/token',async t=>{
 const f=await fixture(t),runtimeBefore=await readFile(join(f.root,'runtime.json'),'utf8'),started=Date.now()
 const result=await armDashboardSample(f.options);assert.equal(result.status,'READY');safe(result)
 const after=await f.read(),arm=after.dashboardSample
 assert.equal(arm.expectedCanonical,observedDashboardCanonical(sample()));assert.ok(Date.parse(arm.expiresAt)>=started+54000);assert.ok(Date.parse(arm.expiresAt)<=Date.now()+55000)
 delete after.dashboardSample;const expected={...f.state};delete expected.dashboardSample;assert.deepEqual(after,expected)
 assert.equal(await readFile(join(f.root,'runtime.json'),'utf8'),runtimeBefore);assert.equal(await readFile(join(f.root,'meta-page-token.txt'),'utf8'),TOKEN)
 const again=await armDashboardSample(f.options);assert.equal(again.code,'PROOF_REFUSED');assert.deepEqual((await f.read()).dashboardSample,arm)
})
test('unobserved/inside-private/noncanonical/hardlinked public sample refuses without arming',async t=>{
 const f=await fixture(t)
 for(const delta of [{uiObservedInQaDashboard:false},{uiObservedInQaDashboard:'true'},{publicSampleFile:join(f.root,'dashboard-sample-public.json')},{publicSampleFile:join(f.root,'runtime.json')}]){const result=await armDashboardSample({...f.options,...delta});assert.equal(result.status,'BLOCKED');safe(result);assert.equal((await f.read()).dashboardSample,null)}
 await link(f.publicSampleFile,join(f.root,'public-alias.json'));assert.equal((await armDashboardSample(f.options)).status,'BLOCKED');assert.equal((await f.read()).dashboardSample,null)
})
test('real data, malformed or oversized public body is never copied to private arm or public result',async t=>{
 for(const text of [JSON.stringify({...sample(),field_data:[{name:'email',values:['contact@example.invalid']}]}),'{broken '+TOKEN,'x'.repeat(8193)]){const f=await fixture(t);await writeFile(f.publicSampleFile,text);const result=await armDashboardSample(f.options);assert.equal(result.status,'BLOCKED');safe(result);assert.equal((await f.read()).dashboardSample,null)}
})
test('strict closed QA tuple/proof/attempt controls and synthetic database guards all fail closed',async t=>{
 for(const [name,delta]of [['state',{release:'false'}],['state',{release:true}],['state',{approvedLeadId:'900000000000001'}],['state',{leadCreatedAt:new Date().toISOString()}],['state',{dashboardSample:{}}],['state',{createAttemptAt:new Date().toISOString()}],['state',{tokenSha256:'0'.repeat(64)}],['state',{verifiedAt:new Date(Date.now()-3600001).toISOString()}],['c',{appId:'1160353550276176'}],['c',{enabled:true}],['c',{approvedTuples:[{}]}],['c',{databaseUrl:'postgresql://fixture:fixture@remote.invalid:55123/anything'}]]){const f=await fixture(t);await writeFile(join(f.root,name==='state'?'meta-real-private.json':'runtime.json'),JSON.stringify({...f[name],...delta}));const result=await armDashboardSample(f.options);assert.equal(result.status,'BLOCKED');safe(result);assert.deepEqual((await f.read()).dashboardSample,delta.dashboardSample??null)}
})
test('STOP, rejected private ACL and unpublished artifact leak prevent arm',async t=>{
 const f=await fixture(t);await writeFile(join(f.root,'STOP'),'closed');assert.equal((await armDashboardSample(f.options)).code,'CLOSED_CYCLE_REFUSED');assert.equal((await f.read()).dashboardSample,null)
 const denied=await fixture(t);assert.equal((await armDashboardSample({...denied.options,assertPrivateFile:async()=>false})).code,'PRIVATE_FILE_REFUSED')
 const leak=await fixture(t);await writeFile(leak.resultFile,TOKEN);assert.equal((await armDashboardSample(leak.options)).code,'ARTIFACT_SCAN_BLOCKED');assert.equal((await leak.read()).dashboardSample,null)
})
test('stage ACL is checked while empty and failed/concurrent write preserves state and T0',async t=>{
 for(const concurrent of [false,true]){const f=await fixture(t),marker=new Date().toISOString();let observedEmpty=false
 const guard=async path=>{if(path.includes('.dashboard-arm-')){observedEmpty=observedEmpty||(await readFile(path,'utf8'))==='';if(concurrent)await writeFile(join(f.root,'meta-real-private.json'),JSON.stringify({...f.state,createAttemptAt:marker}));else return false}return true}
 const result=await armDashboardSample({...f.options,assertPrivateFile:guard});assert.equal(result.code,'PRIVATE_WRITE_FAILED');safe(result);assert.equal(observedEmpty,true);const after=await f.read();assert.equal(after.dashboardSample,null);assert.equal(after.closedAt,f.state.closedAt);if(concurrent)assert.equal(after.createAttemptAt,marker);assert.equal((await readdir(f.root)).some(name=>name.startsWith('.dashboard-arm-')),false)}
})
