import {lstat,realpath,open,rename,unlink} from 'node:fs/promises'
import {resolve,dirname,basename,join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {TextDecoder} from 'node:util'
import {publicTelemetry,assertPublishableText,scanArtifacts} from './secret-safety.mjs'

const APP='2523488421395251',PAGE='1449474971582722',FORM='2046130655900851',PLACEHOLDER='444444444444'
const fail=code=>{throw new ArmError(code)}
const codes=new Set(['INPUT_REFUSED','PUBLIC_SAMPLE_REFUSED','PRIVATE_FILE_REFUSED','PRIVATE_FILE_CHANGED','RUNTIME_REFUSED','PROOF_REFUSED','CLOSED_CYCLE_REFUSED','ARTIFACT_SCAN_BLOCKED','PRIVATE_WRITE_FAILED'])
class ArmError extends Error{constructor(code){super(codes.has(code)?code:'PRIVATE_FILE_REFUSED');this.code=this.message}}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key))
const epoch=x=>Number.isSafeInteger(x)&&x>=0&&x<=2147483647
const placeholder=x=>(typeof x==='string'||typeof x==='number')&&String(x)===PLACEHOLDER
const canonical=value=>JSON.stringify(value,(_key,v)=>object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const absolute=path=>typeof path==='string'&&(process.platform==='win32'?/^[A-Za-z]:[\\/]/.test(path):path.startsWith('/'))
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&b.nlink===1
const fresh=(time,max)=>typeof time==='string'&&Number.isFinite(Date.parse(time))&&Date.parse(time)<=Date.now()&&Date.now()-Date.parse(time)<=max

// This is the public sample observed in the QA Developer Dashboard, not a Lead.
// Return the same canonical JSON used by the gateway without changing value types.
export function observedDashboardCanonical(event){
 try{
  if(!keys(event,['object','entry'])||event.object!=='page'||!Array.isArray(event.entry)||event.entry.length!==1)fail('PUBLIC_SAMPLE_REFUSED')
  const entry=event.entry[0]
  if(!keys(entry,['id','time','changes'])||!['0',PLACEHOLDER].includes(String(entry.id))||!['string','number'].includes(typeof entry.id)||entry.time!==undefined&&!epoch(entry.time)||!Array.isArray(entry.changes)||entry.changes.length!==1)fail('PUBLIC_SAMPLE_REFUSED')
  const change=entry.changes[0],v=change?.value
  if(!keys(change,['field','value'])||change.field!=='leadgen'||!keys(v,['page_id','form_id','leadgen_id','ad_id','adgroup_id','created_time','is_organic'])||!['page_id','form_id','leadgen_id'].every(key=>placeholder(v[key])))fail('PUBLIC_SAMPLE_REFUSED')
  for(const key of ['ad_id','adgroup_id'])if(v[key]!==undefined&&!placeholder(v[key]))fail('PUBLIC_SAMPLE_REFUSED')
  if(v.created_time!==undefined&&!epoch(v.created_time)||v.is_organic!==undefined&&typeof v.is_organic!=='boolean')fail('PUBLIC_SAMPLE_REFUSED')
  return canonical(event)
 }catch{fail('PUBLIC_SAMPLE_REFUSED')}
}
async function checked(path,guard,directory=false){
 if(!absolute(path))fail('PRIVATE_FILE_REFUSED')
 for(let current=resolve(path);;){if((await lstat(current)).isSymbolicLink())fail('PRIVATE_FILE_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}
 const stat=await lstat(path)
 if((directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1)||resolve(await realpath(path)).toLowerCase()!==resolve(path).toLowerCase()||guard&&await guard(path)!==true)fail('PRIVATE_FILE_REFUSED')
 return stat
}
async function boundedRead(path,guard,max){
 const before=await checked(path,guard);if(before.size>max)fail('PRIVATE_FILE_REFUSED')
 const h=await open(path,'r')
 try{
  if(!same(before,await h.stat()))fail('PRIVATE_FILE_CHANGED')
  const bytes=Buffer.alloc(max+1);let count=0
  while(count<bytes.length){const part=await h.read(bytes,count,bytes.length-count,count);if(!part.bytesRead)break;count+=part.bytesRead}
  if(count>max||!same(before,await h.stat())||!same(before,await checked(path,guard)))fail('PRIVATE_FILE_CHANGED')
  return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)).trim(),stat:before}
 }finally{await h.close()}
}
async function saveArm(path,state,before,guard){
 const temp=join(dirname(path),'.dashboard-arm-'+randomUUID()+'.tmp');let handle,created=false
 try{
  handle=await open(temp,'wx',0o600);created=true;await checked(temp,guard)
  await handle.writeFile(JSON.stringify(state)+'\n');await handle.sync();const staged=await handle.stat();await handle.close();handle=undefined
  if(!same(staged,await checked(temp,guard))||!same(before,await checked(path,guard)))fail('PRIVATE_FILE_CHANGED')
  await rename(temp,path);created=false;await checked(path,guard)
 }catch{fail('PRIVATE_WRITE_FAILED')}finally{if(handle)await handle.close().catch(()=>{});if(created)await unlink(temp).catch(()=>{})}
}

// Import only: no HTTP/Graph, callback change, lead creation, process or listener.
// The root caller must freeze writers and independently inspect the public UI sample.
export async function armDashboardSample(options){
 const started=Date.now();let knownSecrets=[],artifactCheck
 const output=(status,error)=>{
  const summary={...publicTelemetry({phase:'dashboard_sample',status,durationMs:Math.min(Date.now()-started,86400000),counts:{requests:0,tests:0}}),...(error?{code:error.code}:{})}
  assertPublishableText(JSON.stringify(summary),{knownSecrets});return Object.freeze(summary)
 }
 try{
  if(!object(options)||!absolute(options.privateRoot)||!absolute(options.publicSampleFile)||options.uiObservedInQaDashboard!==true||typeof options.assertPrivateFile!=='function'||!object(options.artifacts)||typeof options.artifacts.root!=='string'||!Array.isArray(options.artifacts.paths))fail('INPUT_REFUSED')
  const root=resolve(options.privateRoot),sampleFile=resolve(options.publicSampleFile),guard=options.assertPrivateFile
  if(!/^LegalHubStageA-[a-f0-9]{32}$/.test(basename(root))||basename(root)==='LegalHubStageA-e0d6208c7f1b4b61917281dc390a8045'||basename(sampleFile)!=='dashboard-sample-public.json'||sampleFile.toLowerCase().startsWith(root.toLowerCase()+(process.platform==='win32'?'\\':'/')))fail('INPUT_REFUSED')
  await checked(root,guard,true)
  if((await boundedRead(join(root,'qa-owned.txt'),guard,256)).text!=='LegalHub Stage A synthetic QA')fail('PRIVATE_FILE_REFUSED')
  if(await lstat(join(root,'STOP')).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error}))fail('CLOSED_CYCLE_REFUSED')
  const runtimeFile=join(root,'runtime.json'),dbFile=join(root,'cluster-state.json'),tokenFile=join(root,'meta-page-token.txt')
  const runtimeRead=await boundedRead(runtimeFile,guard,131072),dbRead=await boundedRead(dbFile,guard,131072)
  const c=JSON.parse(runtimeRead.text),dbState=JSON.parse(dbRead.text)
  const stateFile=join(root,'meta-real-private.json'),saved=await boundedRead(stateFile,guard,32768),state=JSON.parse(saved.text)
  const tokenRead=await boundedRead(tokenFile,guard,4096),token=tokenRead.text
  if(c.privateDirectory!==root||resolve(c.repo)!==join(root,'qa-source')||c.appId!==APP||c.approvedMetaAppId!==APP||c.pageId!==PAGE||c.formId!==FORM||c.appPort!==43126||c.gatePort!==43127||c.enabled!==false||c.workerEnabled!==false||!Array.isArray(c.approvedTuples)||c.approvedTuples.length||!Array.isArray(c.pilotLeadIds)||c.pilotLeadIds.length)fail('RUNTIME_REFUSED')
  const run=dbState.cluster?.RunId,url=new URL(c.databaseUrl)
  if(!/^stagea[a-f0-9]{32}$/.test(run||'')||dbState.config?.targetKind!=='synthetic'||dbState.config.privateDirectory!==root||dbState.config.expectedHost!=='127.0.0.1'||dbState.config.expectedApplicationHost!=='127.0.0.1'||!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||!url.port||url.port==='5432'||Number(url.port)!==dbState.cluster.Port||url.pathname!=='/legalhub_runner_'+run||dbState.cluster.Database!==url.pathname.slice(1)||c.databaseUrl!==dbState.cluster.Uri)fail('RUNTIME_REFUSED')
  knownSecrets=[token,c.databaseUrl,...Object.values(c.secrets||{}),...Object.values(c.passwords||{})].filter(x=>typeof x==='string'&&x.length)
  if(!/^EAA[A-Za-z0-9_-]{30,4090}$/.test(token)||state.appId!==APP||state.pageId!==PAGE||state.formId!==FORM||state.release!==false||state.approvedLeadId!==null||state.leadCreatedAt!==null||state.dashboardSample!==null||state.createAttemptAt!=null||!fresh(state.verifiedAt,3600000)||state.tokenSha256!==createHash('sha256').update(token).digest('hex')||!['tokenApp','tokenPage','formOwnership'].every(k=>state.results?.[k]==='PASS'))fail('PROOF_REFUSED')
  const observed=await boundedRead(sampleFile,null,8192),expectedCanonical=observedDashboardCanonical(JSON.parse(observed.text))
  artifactCheck=async()=>{try{await scanArtifacts({root:options.artifacts.root,paths:options.artifacts.paths,knownSecrets})}catch{fail('ARTIFACT_SCAN_BLOCKED')}}
  await artifactCheck()
  if(!same(observed.stat,await checked(sampleFile,null)))fail('PRIVATE_FILE_CHANGED')
  if(!same(runtimeRead.stat,await checked(runtimeFile,guard))||!same(dbRead.stat,await checked(dbFile,guard))||!same(tokenRead.stat,await checked(tokenFile,guard)))fail('PRIVATE_FILE_CHANGED')
  if(await lstat(join(root,'STOP')).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error}))fail('CLOSED_CYCLE_REFUSED')
  state.dashboardSample={expiresAt:new Date(Date.now()+55000).toISOString(),expectedCanonical}
  await saveArm(stateFile,state,saved.stat,guard)
  await artifactCheck()
  return output('READY')
 }catch(error){let fixed=error instanceof ArmError?error:new ArmError('PRIVATE_FILE_REFUSED');if(artifactCheck)try{await artifactCheck()}catch{fixed=new ArmError('ARTIFACT_SCAN_BLOCKED')};return output('BLOCKED',fixed)}
}
