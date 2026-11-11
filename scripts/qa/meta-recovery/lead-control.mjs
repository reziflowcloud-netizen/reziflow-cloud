import {lstat,realpath,open,rename,unlink} from 'node:fs/promises'
import {resolve,dirname,basename,join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {TextDecoder} from 'node:util'
import {publicTelemetry,assertPublishableText,scanArtifacts} from './secret-safety.mjs'

const APP='2523488421395251',PAGE='1449474971582722',FORM='2046130655900851'
const actions=new Set(['old-test-check','delete-confirmed-old','mark-create-attempt','capture-created-lead'])
const codes=new Set(['INVALID_INPUT','PRIVATE_FILE_REFUSED','PRIVATE_FILE_CHANGED','RUNTIME_REFUSED','ATTESTATION_REFUSED','ARTIFACT_SCAN_BLOCKED','GRAPH_TRANSPORT','GRAPH_TIMEOUT','GRAPH_HTTP','GRAPH_RESPONSE_INVALID','GRAPH_RESPONSE_LIMIT','TEST_EDGE_REFUSED','TEST_IDENTITY_REFUSED','OLD_DELETE_REFUSED','DELETE_NOT_CONFIRMED','CREATE_ATTEMPT_REFUSED','NEW_TEST_REFUSED','PRIVATE_WRITE_FAILED'])
class ControlError extends Error{constructor(code,status,graphCode,graphSubcode){super(codes.has(code)?code:'PRIVATE_FILE_REFUSED');this.code=this.message;for(const [key,value] of Object.entries({httpStatus:status,graphCode,graphSubcode}))if(value!==undefined)this[key]=value}}
const fail=code=>{throw new ControlError(code)}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const id=x=>typeof x==='string'&&/^[1-9][0-9]{4,30}$/.test(x)
const number=x=>Number.isSafeInteger(x)&&x>=0&&x<=2147483647
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&b.nlink===1
const fresh=(time,now,max)=>Number.isFinite(Date.parse(time))&&Date.parse(time)<=now&&now-Date.parse(time)<=max
async function checked(path,guard,directory=false){
 for(let current=resolve(path);;){if((await lstat(current)).isSymbolicLink())fail('PRIVATE_FILE_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}
 const stat=await lstat(path)
 if((directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1)||resolve(await realpath(path)).toLowerCase()!==resolve(path).toLowerCase()||await guard(path)!==true)fail('PRIVATE_FILE_REFUSED')
 return stat
}
async function privateRead(path,guard,max){
 const before=await checked(path,guard);if(before.size>max)fail('PRIVATE_FILE_REFUSED')
 const handle=await open(path,'r')
 try{
  if(!same(before,await handle.stat()))fail('PRIVATE_FILE_CHANGED')
  const bytes=Buffer.alloc(max+1);let length=0
  while(length<bytes.length){const part=await handle.read(bytes,length,bytes.length-length,length);if(!part.bytesRead)break;length+=part.bytesRead}
  if(length>max||!same(before,await handle.stat())||!same(before,await checked(path,guard)))fail('PRIVATE_FILE_CHANGED')
  return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length)).trim(),stat:before}
 }finally{await handle.close()}
}
async function saveState(path,state,before,guard){
 const temp=join(dirname(path),'.lead-control-'+randomUUID()+'.tmp');let handle,created=false
 try{
  handle=await open(temp,'wx',0o600);created=true;await checked(temp,guard)
  await handle.writeFile(JSON.stringify(state)+'\n');await handle.sync();const staged=await handle.stat();await handle.close();handle=undefined
  if(!same(staged,await checked(temp,guard))||!same(before,await checked(path,guard)))fail('PRIVATE_FILE_CHANGED')
  await rename(temp,path);created=false;await checked(path,guard)
 }catch{fail('PRIVATE_WRITE_FAILED')}finally{if(handle)await handle.close().catch(()=>{});if(created)await unlink(temp).catch(()=>{})}
}
async function boundedJson(response,signal){
 const declared=response.headers?.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>65536))fail('GRAPH_RESPONSE_LIMIT')
 if(!response.body?.getReader)fail('GRAPH_RESPONSE_INVALID')
 const reader=response.body.getReader(),chunks=[];let size=0
 try{
  for(;;){if(signal.aborted)fail('GRAPH_TIMEOUT');const part=await reader.read();if(part.done)break;if(!(part.value instanceof Uint8Array)||(size+=part.value.byteLength)>65536)fail('GRAPH_RESPONSE_LIMIT');chunks.push(part.value)}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)))
 }catch(error){if(error instanceof ControlError)throw error;fail('GRAPH_RESPONSE_INVALID')}finally{await reader.cancel().catch(()=>{})}
}
function testEdge(body){
 if(!object(body)||!Array.isArray(body.data)||body.data.length>1||body.paging?.next||body.paging?.previous)fail('TEST_EDGE_REFUSED')
 for(const lead of body.data)if(!id(lead?.id)||!Number.isFinite(Date.parse(lead.created_time)))fail('TEST_EDGE_REFUSED')
 return body.data
}
function technicalLead(body,edge,now){
 if(body?.id!==edge.id||body.form_id!==FORM||!fresh(body.created_time,now,366*86400000)||Date.parse(body.created_time)!==Date.parse(edge.created_time))fail('TEST_IDENTITY_REFUSED')
 return {id:body.id,formId:FORM,createdAt:new Date(body.created_time).toISOString(),retrievalConfirmed:true}
}

// Import-only. No POST, lead payload/contact retrieval, webhook simulation or release.
// The caller freezes writers and provides the genuine owner/ACL/no-reparse guard.
export async function runLeadControl(options){
 const started=Date.now();let requests=0,accepted=0,leadCount=0,timer,knownSecrets=[],artifactCheck
 const controller=new AbortController()
 const output=(status,error)=>{
  const value={phase:'test_lead',status,durationMs:Math.min(Date.now()-started,86400000),counts:{requests,accepted,leads:leadCount}}
  for(const key of ['httpStatus','graphCode','graphSubcode'])if(error?.[key]!==undefined)value[key]=error[key]
  const result={...publicTelemetry(value),...(error?{code:error.code}:{})};assertPublishableText(JSON.stringify(result),{knownSecrets});return Object.freeze(result)
 }
 try{
  if(!object(options)||!actions.has(options.action)||typeof options.privateRoot!=='string'||!/^[A-Za-z]:[\\/]|^\//.test(options.privateRoot)||typeof options.assertPrivateFile!=='function'||!object(options.artifacts)||typeof options.artifacts.root!=='string'||!Array.isArray(options.artifacts.paths)||options.fetchImpl!==undefined&&typeof options.fetchImpl!=='function'||options.timeoutMs!==undefined&&(!Number.isInteger(options.timeoutMs)||options.timeoutMs<5||options.timeoutMs>120000))fail('INVALID_INPUT')
  const root=resolve(options.privateRoot),guard=options.assertPrivateFile
  if(!/^LegalHubStageA-[a-f0-9]{32}$/.test(basename(root))||basename(root)==='LegalHubStageA-e0d6208c7f1b4b61917281dc390a8045')fail('INVALID_INPUT')
  await checked(root,guard,true)
  if((await privateRead(join(root,'qa-owned.txt'),guard,256)).text!=='LegalHub Stage A synthetic QA')fail('PRIVATE_FILE_REFUSED')
  const c=JSON.parse((await privateRead(join(root,'runtime.json'),guard,131072)).text),stateFile=join(root,'meta-real-private.json')
  const saved=await privateRead(stateFile,guard,32768),state=JSON.parse(saved.text),token=(await privateRead(join(root,'meta-page-token.txt'),guard,4096)).text
  if(c.privateDirectory!==root||c.appId!==APP||c.approvedMetaAppId!==APP||c.pageId!==PAGE||c.formId!==FORM||c.hostname!=='unit-handsfree-carpentry.ngrok-free.dev'||c.graphVersion!=='v27.0'||!/^EAA[A-Za-z0-9_-]{30,4090}$/.test(token))fail('RUNTIME_REFUSED')
  knownSecrets=[token,c.databaseUrl,...Object.values(c.secrets||{}),...Object.values(c.passwords||{})].filter(x=>typeof x==='string'&&x.length)
  if(state.appId!==APP||state.pageId!==PAGE||state.formId!==FORM||state.release!==false||state.approvedLeadId!=null||state.leadCreatedAt!=null||state.dashboardSample!==null||!fresh(state.verifiedAt,Date.now(),3600000)||state.tokenSha256!==createHash('sha256').update(token).digest('hex')||!['tokenApp','tokenPage','formOwnership'].every(k=>state.results?.[k]==='PASS'))fail('ATTESTATION_REFUSED')
  artifactCheck=async()=>{try{await scanArtifacts({root:options.artifacts.root,paths:options.artifacts.paths,knownSecrets})}catch{fail('ARTIFACT_SCAN_BLOCKED')}}
  await artifactCheck()
  const fetchImpl=options.fetchImpl||globalThis.fetch;if(typeof fetchImpl!=='function')fail('INVALID_INPUT')
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ControlError('GRAPH_TIMEOUT'))},options.timeoutMs??120000)})
  const request=async(path,fields,method='GET')=>{
   if(controller.signal.aborted||++requests>5||!(path===FORM+'/test_leads'||id(path))||!['GET','DELETE'].includes(method))fail('INVALID_INPUT')
   const url=new URL('https://graph.facebook.com/v27.0/'+path);if(fields)url.searchParams.set('fields',fields)
   let response
   try{response=await Promise.race([fetchImpl(url.toString(),{method,headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',cache:'no-store',signal:controller.signal}),deadline])}catch(error){if(error instanceof ControlError)throw error;fail('GRAPH_TRANSPORT')}
   if(!Number.isInteger(response?.status)||response.status<100||response.status>599)fail('GRAPH_RESPONSE_INVALID')
   const body=await Promise.race([boundedJson(response,controller.signal),deadline])
   if(response.status<200||response.status>=300||body?.error){const e=object(body?.error)?body.error:{};throw new ControlError('GRAPH_HTTP',response.status,number(e.code)?e.code:undefined,number(e.error_subcode)?e.error_subcode:undefined)}
   if(method==='DELETE'){if(body?.success!==true)fail('DELETE_NOT_CONFIRMED');accepted++}
   return body
  }
  const edge=async()=>testEdge(await request(FORM+'/test_leads','id,created_time'))
  const detail=async lead=>technicalLead(await request(lead.id,'id,form_id,created_time'),lead,Date.now())
  if(options.action==='old-test-check'){
   if(state.createAttemptAt!=null)fail('CREATE_ATTEMPT_REFUSED')
   const leads=await edge();leadCount=leads.length
   if(leads.length){
    if(state.previousTestLead&&state.previousTestLead.id!==leads[0].id)fail('TEST_EDGE_REFUSED')
    state.previousTestLead={...await detail(leads[0]),verifiedAt:new Date().toISOString(),deleted:false}
   }else if(state.previousTestLead){state.previousTestLead.deleted=true;state.previousTestLead.deletedAt=new Date().toISOString()}
   else state.previousTestLead=null
   state.oldTestCheckAt=new Date().toISOString()
  }else if(options.action==='delete-confirmed-old'){
   const old=state.previousTestLead
   if(options.deleteOwnSyntheticConfirmed!==true||state.createAttemptAt!=null||!id(old?.id)||old.formId!==FORM||old.retrievalConfirmed!==true||old.deleted===true||!fresh(old.verifiedAt,Date.now(),600000))fail('OLD_DELETE_REFUSED')
   const leads=await edge();if(leads.length!==1||leads[0].id!==old.id||Date.parse(leads[0].created_time)!==Date.parse(old.createdAt))fail('OLD_DELETE_REFUSED')
   await detail(leads[0]);await request(old.id,undefined,'DELETE')
   if((await edge()).length!==0)fail('DELETE_NOT_CONFIRMED')
   state.previousTestLead={...old,deleted:true,deletedAt:new Date().toISOString()};state.oldTestCheckAt=new Date().toISOString()
  }else if(options.action==='mark-create-attempt'){
   if(state.createAttemptAt!=null||!fresh(state.oldTestCheckAt,Date.now(),600000)||state.previousTestLead&&state.previousTestLead.deleted!==true)fail('CREATE_ATTEMPT_REFUSED')
   if((await edge()).length!==0)fail('CREATE_ATTEMPT_REFUSED')
   state.createAttemptAt=new Date().toISOString()
  }else{
   if(!fresh(state.createAttemptAt,Date.now(),600000))fail('NEW_TEST_REFUSED')
   const leads=await edge();if(leads.length!==1||leads[0].id===state.previousTestLead?.id||Date.parse(leads[0].created_time)<Date.parse(state.createAttemptAt)-5000)fail('NEW_TEST_REFUSED')
   const lead=await detail(leads[0]);if(!fresh(lead.createdAt,Date.now(),600000))fail('NEW_TEST_REFUSED')
   state.approvedLeadId=lead.id;state.leadCreatedAt=lead.createdAt;state.release=false;leadCount=1
  }
  if(controller.signal.aborted)fail('GRAPH_TIMEOUT')
  await artifactCheck();await saveState(stateFile,state,saved.stat,guard);await artifactCheck()
  return output('PASS')
 }catch(error){let fixed=error instanceof ControlError?error:new ControlError('PRIVATE_FILE_REFUSED');if(artifactCheck)try{await artifactCheck()}catch{fixed=new ControlError('ARTIFACT_SCAN_BLOCKED')};return output('BLOCKED',fixed)}finally{clearTimeout(timer);controller.abort()}
}
