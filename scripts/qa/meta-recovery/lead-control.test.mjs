import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID,createHash} from 'node:crypto'
import {runLeadControl} from './lead-control.mjs'
const APP='2523488421395251',PAGE='1449474971582722',FORM='2046130655900851'
const TOKEN='EAA'+'SyntheticPageOnly'.repeat(5),SECRET='PlantedGeneratedQaSecretOnly'.repeat(2)
const OLD='900000000000001',NEW='900000000000002',oldAt=new Date(Date.now()-86400000).toISOString()
async function fixture(t){
 const parent=await mkdtemp(join(tmpdir(),'legalhub-lead-control-'));t.after(()=>rm(parent,{recursive:true,force:true}))
 const root=join(parent,'LegalHubStageA-'+randomUUID().replaceAll('-','')),artifacts=join(parent,'artifacts');await mkdir(root);await mkdir(artifacts)
 const c={privateDirectory:root,appId:APP,approvedMetaAppId:APP,pageId:PAGE,formId:FORM,hostname:'unit-handsfree-carpentry.ngrok-free.dev',graphVersion:'v27.0',secrets:{jwt:SECRET}}
 const state={appId:APP,pageId:PAGE,formId:FORM,verifiedAt:new Date().toISOString(),tokenSha256:createHash('sha256').update(TOKEN).digest('hex'),results:{tokenApp:'PASS',tokenPage:'PASS',formOwnership:'PASS'},release:false,approvedLeadId:null,leadCreatedAt:null,dashboardSample:null,originalAppSubscriptions:[],originalPageSubscriptions:[]}
 for(const [name,value] of Object.entries({'qa-owned.txt':'LegalHub Stage A synthetic QA','runtime.json':JSON.stringify(c),'meta-real-private.json':JSON.stringify(state),'meta-page-token.txt':TOKEN}))await writeFile(join(root,name),value,{mode:0o600})
 const resultFile=join(artifacts,'result.json');await writeFile(resultFile,'{"phase":"test_lead","status":"BLOCKED"}')
 return {root,state,resultFile,save:async delta=>writeFile(join(root,'meta-real-private.json'),JSON.stringify({...state,...delta})),read:async()=>JSON.parse(await readFile(join(root,'meta-real-private.json'),'utf8')),options:{privateRoot:root,assertPrivateFile:async()=>true,artifacts:{root:artifacts,paths:[resultFile]}}}
}
const edge=(lead=OLD,time=oldAt)=>({data:[{id:lead,created_time:time}]})
const detail=(lead=OLD,time=oldAt)=>({id:lead,form_id:FORM,created_time:time})
const old=()=>({id:OLD,formId:FORM,createdAt:oldAt,retrievalConfirmed:true,verifiedAt:new Date().toISOString(),deleted:false})
function mock(bodies,transform){const calls=[];return {calls,fetchImpl:async(url,init)=>{const index=calls.length;calls.push({url,init});assert.ok(index<bodies.length);return transform?transform(bodies[index],index):new Response(JSON.stringify(bodies[index]),{status:200})}}}
function safe(result){const text=JSON.stringify(result);for(const value of [TOKEN,SECRET,APP,PAGE,FORM,OLD,NEW,'access_token','field_data'])assert.equal(text.includes(value),false)}
function callsSafe(calls){for(const {url,init}of calls){const parsed=new URL(url);assert.equal(parsed.origin,'https://graph.facebook.com');assert.ok([FORM+'/test_leads',OLD,NEW].some(p=>parsed.pathname==='/v27.0/'+p));assert.equal(init.headers.Authorization,'Bearer '+TOKEN);assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);assert.ok(['GET','DELETE'].includes(init.method));assert.equal(url.includes(TOKEN),false);if(parsed.searchParams.has('fields'))assert.ok(['id,created_time','id,form_id,created_time'].includes(parsed.searchParams.get('fields')))}}

test('old-test check reads only exact technical fields and saves private edge proof',async t=>{
 for(const exists of [false,true]){const f=await fixture(t),m=mock(exists?[edge(),detail()]:[{data:[]}]);const result=await runLeadControl({...f.options,action:'old-test-check',fetchImpl:m.fetchImpl});assert.equal(result.status,'PASS');assert.equal(result.counts.leads,exists?1:0);safe(result);callsSafe(m.calls);const s=await f.read();assert.equal(s.release,false);assert.equal(s.approvedLeadId,null);assert.ok(Date.parse(s.oldTestCheckAt));if(exists){assert.equal(s.previousTestLead.id,OLD);assert.equal(s.previousTestLead.retrievalConfirmed,true)}else assert.equal(s.previousTestLead,null)}
})
test('only explicitly confirmed old synthetic edge ID can be deleted before attempt; empty edge verifies deletion',async t=>{
 const f=await fixture(t);await f.save({previousTestLead:old()});const m=mock([edge(),detail(),{success:true},{data:[]}]);const result=await runLeadControl({...f.options,action:'delete-confirmed-old',deleteOwnSyntheticConfirmed:true,fetchImpl:m.fetchImpl});assert.equal(result.status,'PASS');assert.equal(result.counts.accepted,1);safe(result);callsSafe(m.calls);assert.equal(m.calls[2].init.method,'DELETE');assert.equal(new URL(m.calls[2].url).pathname,'/v27.0/'+OLD);assert.equal((await f.read()).previousTestLead.deleted,true)
 for(const delta of [{createAttemptAt:new Date().toISOString()},{previousTestLead:{...old(),retrievalConfirmed:false}}]){const next=await fixture(t);await next.save({previousTestLead:old(),...delta});const n=mock([]);const blocked=await runLeadControl({...next.options,action:'delete-confirmed-old',deleteOwnSyntheticConfirmed:true,fetchImpl:n.fetchImpl});assert.equal(blocked.status,'BLOCKED');assert.equal(n.calls.length,0);safe(blocked)}
 const next=await fixture(t);await next.save({previousTestLead:old()});const n=mock([]);assert.equal((await runLeadControl({...next.options,action:'delete-confirmed-old',fetchImpl:n.fetchImpl})).code,'OLD_DELETE_REFUSED');assert.equal(n.calls.length,0)
})
test('changed old edge or ambiguous deletion fails closed without retry or state overwrite',async t=>{
 for(const [bodies,expected]of [[[edge(NEW)],'OLD_DELETE_REFUSED'],[[edge(),detail(),{success:'true'}],'DELETE_NOT_CONFIRMED'],[[edge(),detail(),{success:true},edge()],'DELETE_NOT_CONFIRMED']]){const f=await fixture(t);await f.save({previousTestLead:old()});const m=mock(bodies);const r=await runLeadControl({...f.options,action:'delete-confirmed-old',deleteOwnSyntheticConfirmed:true,fetchImpl:m.fetchImpl});assert.equal(r.code,expected);assert.equal((await f.read()).previousTestLead.deleted,false);safe(r);callsSafe(m.calls)}
})
test('mark create attempt is once-only after a verified empty edge and never creates a Lead',async t=>{
 const f=await fixture(t);await f.save({previousTestLead:null,oldTestCheckAt:new Date().toISOString()});const m=mock([{data:[]}]);const r=await runLeadControl({...f.options,action:'mark-create-attempt',fetchImpl:m.fetchImpl});assert.equal(r.status,'PASS');assert.ok(Date.parse((await f.read()).createAttemptAt));callsSafe(m.calls);safe(r);const n=mock([]);assert.equal((await runLeadControl({...f.options,action:'mark-create-attempt',fetchImpl:n.fetchImpl})).code,'CREATE_ATTEMPT_REFUSED');assert.equal(n.calls.length,0)
})
test('new single test ID is captured privately only after attempt and always leaves release false',async t=>{
 const f=await fixture(t),time=new Date(Date.now()-1000).toISOString();await f.save({createAttemptAt:new Date(Date.now()-2000).toISOString(),previousTestLead:{...old(),deleted:true}});const m=mock([edge(NEW,time),detail(NEW,time)]);const r=await runLeadControl({...f.options,action:'capture-created-lead',fetchImpl:m.fetchImpl});assert.equal(r.status,'PASS');safe(r);callsSafe(m.calls);const s=await f.read();assert.equal(s.approvedLeadId,NEW);assert.equal(s.leadCreatedAt,time);assert.equal(s.release,false);const n=mock([]);assert.equal((await runLeadControl({...f.options,action:'capture-created-lead',fetchImpl:n.fetchImpl})).status,'BLOCKED');assert.equal(n.calls.length,0)
})
test('old, stale, future, foreign Form, multiple or paged test candidates cannot become approved',async t=>{
 const when=new Date(Date.now()-1000).toISOString()
 const cases=[[edge(OLD,when)],[edge(NEW,oldAt)],[edge(NEW,new Date(Date.now()+60000).toISOString()),detail(NEW,new Date(Date.now()+60000).toISOString())],[edge(NEW,when),{...detail(NEW,when),form_id:'999999999999999'}],[{data:[...edge(OLD,when).data,...edge(NEW,when).data]}],[{...edge(NEW,when),paging:{next:'https://graph.facebook.com/?access_token='+TOKEN}}]]
 for(const bodies of cases){const f=await fixture(t);await f.save({createAttemptAt:new Date(Date.now()-2000).toISOString(),previousTestLead:{...old(),deleted:true}});const r=await runLeadControl({...f.options,action:'capture-created-lead',fetchImpl:mock(bodies).fetchImpl});assert.equal(r.status,'BLOCKED');assert.equal((await f.read()).approvedLeadId,null);safe(r)}
})
test('closed/provenance/file/artifact guards block before Graph and concurrent state changes are preserved',async t=>{
 for(const delta of [{release:true},{dashboardSample:{}},{tokenSha256:'0'.repeat(64)},{appId:'1160353550276176'}]){const f=await fixture(t);await f.save(delta);const m=mock([]);const r=await runLeadControl({...f.options,action:'old-test-check',fetchImpl:m.fetchImpl});assert.equal(r.status,'BLOCKED');assert.equal(m.calls.length,0);safe(r)}
 const f=await fixture(t);await writeFile(f.resultFile,SECRET);const m=mock([]);assert.equal((await runLeadControl({...f.options,action:'old-test-check',fetchImpl:m.fetchImpl})).code,'ARTIFACT_SCAN_BLOCKED');assert.equal(m.calls.length,0)
 const next=await fixture(t),changed=mock([{data:[]}],async body=>{await next.save({release:true});return new Response(JSON.stringify(body))});const r=await runLeadControl({...next.options,action:'old-test-check',fetchImpl:changed.fetchImpl});assert.equal(r.code,'PRIVATE_WRITE_FAILED');assert.equal((await next.read()).release,true);safe(r)
})
test('provider errors and bounded failures return fixed codes without contact data or credentials',async t=>{
 for(const [fetchImpl,code]of [[async()=>new Response(JSON.stringify({error:{code:190,error_subcode:2534003,message:TOKEN+SECRET+' office@example.test'}}),{status:400}),'GRAPH_HTTP'],[()=>new Promise(()=>{}),'GRAPH_TIMEOUT'],[async()=>new Response('x'.repeat(65537)),'GRAPH_RESPONSE_LIMIT']]){const f=await fixture(t);const r=await runLeadControl({...f.options,action:'old-test-check',fetchImpl,timeoutMs:10});assert.equal(r.code,code);safe(r);assert.equal((await f.read()).approvedLeadId,null)}
})
