import {spawn} from 'node:child_process'
import {readFile, writeFile, lstat, realpath} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {writeFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join, resolve, win32} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {createInterface} from 'node:readline'
import {realGateway} from './gateway.mjs'
import {publicTelemetry} from './secret-safety.mjs'

export const QA = Object.freeze({appId:'2523488421395251',pageId:'1449474971582722',formId:'2046130655900851'})
const fixedFailure=()=>{throw Error('QA_SUPERVISOR_BLOCKED')}
const fresh=(value,now,max)=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=now&&now-Date.parse(value)<=max
const numeric=value=>typeof value==='string'&&/^[1-9][0-9]{5,30}$/.test(value)
const key=value=>typeof value==='string'&&value.length>=32&&value.length<=4096&&!/[\r\n\0]/.test(value)
const port=value=>Number.isInteger(value)&&value>=1024&&value<=65535
const guardianStages=new Set(['host','git_dependency','runtime','approval','executables','private_acl','parent','http_ports','native_job','health','launch_app','launch_tunnel','stop_child','app_ready','stop'])
const launchStages=new Set(['arguments','metadata','runtime_config','ngrok_binary','private_acl','credentials','ngrok_config','graph_preflight','stop_marker','prisma_import','guardian_spawn','supervisor_start','supervisor_enable','supervisor_tunnel','supervisor_release','guardian_timeout','guardian_protocol',...[...guardianStages].map(s=>'guardian_'+s)])
class LaunchFailure extends Error {constructor(stage){super('QA_LAUNCH_BLOCKED');this.stage=launchStages.has(stage)?stage:'guardian_protocol'}}
export function launchFailureTelemetry(error,stage='arguments'){
 const selected=error instanceof LaunchFailure?error.stage:stage
 return Object.freeze({...publicTelemetry({phase:'prepare',status:'BLOCKED'}),code:'QA_LAUNCH_'+(launchStages.has(selected)?selected:'guardian_protocol').toUpperCase()})
}
export function guardianEnvironment(root){return{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd',PATHEXT:'.EXE',TEMP:root,TMP:root,USERPROFILE:root,APPDATA:root,LOCALAPPDATA:root}}

// Pure checks are exported for planted-data tests; they never load credentials.
export function validateSupervisorConfig(c,state,now=Date.now()) {
 if(!c||!state||!/^D:\\LegalHubStageA-[0-9a-f]{32}$/.test(c.privateDirectory||'')||win32.normalize(c.repo||'')!==win32.join(c.privateDirectory,'qa-source'))fixedFailure()
 if(c.appId!==QA.appId||c.approvedMetaAppId!==QA.appId||c.pageId!==QA.pageId||c.formId!==QA.formId||!numeric(c.appId))fixedFailure()
 if(!port(c.appPort)||!port(c.gatePort)||c.appPort===c.gatePort||c.appPort!==43126||c.gatePort!==43127)fixedFailure()
 const run=state.cluster?.RunId,url=new URL(c.databaseUrl)
 if(!/^stagea[0-9a-f]{32}$/.test(run||'')||state.config?.targetKind!=='synthetic'||state.config?.privateDirectory!==c.privateDirectory||state.config?.expectedHost!=='127.0.0.1'||state.config?.expectedApplicationHost!=='127.0.0.1'||!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||!url.port||url.port==='5432'||Number(url.port)!==state.cluster.Port||url.pathname!=='/legalhub_runner_'+run||state.cluster.Database!==url.pathname.slice(1)||c.databaseUrl!==state.cluster.Uri)fixedFailure()
 if(c.enabled!==false||c.workerEnabled!==false||!Array.isArray(c.approvedTuples)||c.approvedTuples.length||!Array.isArray(c.pilotLeadIds)||c.pilotLeadIds.length||!c.organizationId||!Object.values(c.secrets||{}).length)fixedFailure()
 for(const name of ['jwt','verifyToken','receiptHmac','worker'])if(!key(c.secrets[name]))fixedFailure()
 const a=c.supervisorApproval
 if(!a||a.appId!==QA.appId||a.pageId!==QA.pageId||a.formId!==QA.formId||a.hostname!==c.hostname||c.hostname!=='unit-handsfree-carpentry.ngrok-free.dev'||typeof a.allowEnable!=='boolean'||typeof a.allowTunnel!=='boolean'||!fresh(a.approvedAt,now,3600000))fixedFailure()
 const deadline=Date.parse(a.deadlineAt)
 if(!Number.isFinite(deadline)||deadline<=now||deadline-now>35*60000)fixedFailure()
 if(!/^[A-Za-z]:\\/.test(c.qaPwshExecutable||'')||win32.basename(c.qaPwshExecutable).toLowerCase()!=='pwsh.exe'||a.approvedPwshExecutable!==c.qaPwshExecutable||c.ngrokExe!==a.ngrokExe||!/^C:\\Program Files\\WindowsApps\\[^\\]*ngrok[^\\]*\\ngrok\.exe$/i.test(c.ngrokExe||'')||!/^[a-f0-9]{64}$/.test(a.ngrokSha256||''))fixedFailure()
 if(a.freePlanVerified!==true||a.fullCaptureDisabled!==true||a.hostnameVerified!==true||!fresh(a.ngrokVerifiedAt,now,3600000)||!/^v\d{1,2}\.\d{1,2}$/.test(c.graphVersion||''))fixedFailure()
 return Object.freeze({deadline})
}

export function validateNgrokConfig(text) {
 if(typeof text!=='string'||text.length>8192||text.includes('\0'))fixedFailure()
 // Deliberately accept only the reviewed minimal agent config. No global merge,
 // endpoints, traffic policies, logging, inspection or remote control is loaded.
 const lines=text.replace(/\r/g,'').trim().split('\n')
 if(lines.length!==8||lines[0]!=='version: "3"'||lines[1]!=='agent:'||!/^  authtoken: "[A-Za-z0-9_-]{20,512}"$/.test(lines[2])||lines.slice(3).join('\n')!==['  console_ui: false','  inspect_db_size: -1','  web_addr: false','  log: false','  remote_management: false'].join('\n'))fixedFailure()
 return true
}

export function validatePreflight(c,s,token,secret,now=Date.now(),closed=false) {
 if(!s||s.appId!==QA.appId||s.pageId!==QA.pageId||s.formId!==QA.formId||!fresh(s.verifiedAt,now,3600000)||!key(token)||!key(secret)||s.tokenSha256!==createHash('sha256').update(token).digest('hex')||!['tokenApp','tokenPage','formOwnership'].every(k=>s.results?.[k]==='PASS'))fixedFailure()
 if(closed&&(s.release!==false||s.approvedLeadId!==null||s.leadCreatedAt!==null||s.dashboardSample!==null))fixedFailure()
 return true
}

export function released(c,s,now=Date.now()) {
 return s?.appId===QA.appId&&s.pageId===QA.pageId&&s.formId===QA.formId&&s.release===true&&numeric(s.approvedLeadId)&&fresh(s.leadCreatedAt,now,600000)
}

export function appEnvironment(c,preflight,token,secret,enabled,systemRoot='C:\\Windows') {
 const env={SystemRoot:systemRoot,WINDIR:systemRoot,PATH:systemRoot+'\\System32;C:\\Program Files\\nodejs',TEMP:c.privateDirectory,TMP:c.privateDirectory,USERPROFILE:c.privateDirectory,APPDATA:c.privateDirectory,LOCALAPPDATA:c.privateDirectory,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:c.databaseUrl,DIRECT_URL:c.databaseUrl,JWT_SECRET:c.secrets.jwt,NOTIFICATIONS_ENABLED:'true',NOTIFICATION_EVENTS_ENABLED:'true',NOTIFICATION_SCHEDULED_EVENTS_ENABLED:'false',WEB_PUSH_ENABLED:'false',META_LEAD_ADS_APP_ID:c.appId,META_LEAD_ADS_APP_SECRET:secret,META_LEAD_ADS_VERIFY_TOKEN:c.secrets.verifyToken,META_LEAD_ADS_RECEIPT_HMAC_KEY:c.secrets.receiptHmac,META_LEAD_ADS_WORKER_SECRET:c.secrets.worker,META_LEAD_ADS_ENABLED:enabled?'true':'false',META_LEAD_ADS_WORKER_ENABLED:enabled?'true':'false',META_LEAD_ADS_RETENTION_ENABLED:'false',META_LEAD_ADS_APPROVED_TUPLES:'[]',META_LEAD_ADS_PILOT_ORGANIZATION_ID:c.organizationId,META_LEAD_ADS_GRAPH_VERSION:c.graphVersion,META_LEAD_ADS_ACTIVATED_AT:new Date().toISOString(),QA_REAL_CONFIG:win32.join(c.privateDirectory,'meta-real-private.json')}
 if(enabled){env['META_LEAD_ADS_PAGE_TOKEN_'+c.pageId]=token;env.META_LEAD_ADS_APPROVED_TUPLES=JSON.stringify([{appId:c.appId,pageId:c.pageId,formId:c.formId,organizationId:c.organizationId,tokenSha256:preflight.tokenSha256,tokenAppId:c.appId,tokenPageId:c.pageId,formPageId:c.pageId,verifiedAt:preflight.verifiedAt}])}
 return env
}

// Job ownership and native handles are held by the guardian, not guessed from a
// port or a PID list. Tests inject a fake guardian and never start real services.
export class QaSupervisor {
 constructor(c,deps){this.c=c;this.d=deps;this.mode='closed';this.closing=false;this.children=new Set();this.busy=false;this.controller=new AbortController();this.lastWorker=0}
 emit(phase,status,extra={}){this.d.emit(publicTelemetry({phase,status,...extra}))}
 async start(){
  try{await this.d.preflight();if(this.closing)fixedFailure();await this.d.guardian.start();if(this.closing)fixedFailure();await this.d.db.assertQa();if(this.closing)fixedFailure();await this.d.guardian.launch('app',false);this.children.add('app');if(this.closing)fixedFailure();await this.d.ready();if(this.closing)fixedFailure();this.gate=await this.d.gateway();if(this.closing){this.gate.seal();fixedFailure()}this.emit('prepare','READY')}
  catch(error){await this.stop();throw error instanceof LaunchFailure?error:new LaunchFailure('supervisor_start')}
 }
 async enable(){
  if(this.closing||this.mode!=='closed'||this.c.supervisorApproval.allowEnable!==true)fixedFailure()
  try{await this.d.preflight();if(this.closing)fixedFailure();await this.d.db.enableBinding();if(this.closing){await this.d.db.disableBinding();fixedFailure()}await this.d.guardian.stopChild('app');this.children.delete('app');if(this.closing)fixedFailure();await this.d.guardian.launch('app',true);this.children.add('app');if(this.closing)fixedFailure();await this.d.ready();if(this.closing)fixedFailure();this.mode='enabled';this.emit('prepare','READY')}
  catch(error){await this.stop();throw error instanceof LaunchFailure?error:new LaunchFailure('supervisor_enable')}
 }
 async tunnel(){
  if(this.closing||this.children.has('tunnel')||this.c.supervisorApproval.allowTunnel!==true)fixedFailure()
  try{await this.d.preflight();if(this.closing)fixedFailure();await this.d.guardian.launch('tunnel',false);this.children.add('tunnel');if(this.closing)fixedFailure();this.emit('webhook','READY')}
  catch(error){await this.stop();throw error instanceof LaunchFailure?error:new LaunchFailure('supervisor_tunnel')}
 }
 async release(){
  if(this.closing||this.mode!=='enabled'||this.c.supervisorApproval.allowEnable!==true)fixedFailure()
  try{const real=await this.d.readReal();if(this.closing||real.appId!==QA.appId||real.pageId!==QA.pageId||real.formId!==QA.formId||real.release!==false||!numeric(real.approvedLeadId)||!fresh(real.leadCreatedAt,this.d.now(),600000))fixedFailure();await this.d.db.allowLead(real.approvedLeadId);if(this.closing)fixedFailure();await this.d.releaseGate(real);if(this.closing)fixedFailure();this.emit('test_lead','READY')}
  catch(error){await this.stop();throw error instanceof LaunchFailure?error:new LaunchFailure('supervisor_release')}
 }
 async tick(){
  if(this.closing||this.busy)return
  this.busy=true
  try{
   if(this.d.now()>=Date.parse(this.c.supervisorApproval.deadlineAt)||!await this.d.guardian.healthy()){await this.stop();return}
   const real=await this.d.readReal()
   if(real.leadCreatedAt&&!fresh(real.leadCreatedAt,this.d.now(),600000)){await this.stop();return}
   if(this.mode==='enabled'&&released(this.c,real,this.d.now())&&this.d.now()-this.lastWorker>=5000){this.lastWorker=this.d.now();await this.d.worker(this.controller.signal)}
  }catch{await this.stop()}finally{this.busy=false}
 }
 async command(line){
  if(line==='STOP')return this.stop()
  if(line==='ENABLE')return this.enable()
  if(line==='TUNNEL')return this.tunnel()
  if(line==='RELEASE')return this.release()
  if(line==='STATUS'){this.emit('prepare',this.closing?'BLOCKED':'READY');return}
  await this.stop();throw Error('QA_SUPERVISOR_BLOCKED')
 }
 async stop(){
  if(this.stopPromise)return this.stopPromise
  this.closing=true;this.controller.abort()
  this.stopPromise=(async()=>{let ok=true
   for(const action of [()=>this.d.closeFiles(),()=>this.gate?.seal(),()=>this.d.guardian.stop(),()=>this.d.db.disableBinding(),()=>this.d.db.close()])try{await action()}catch{ok=false}
   this.mode='stopped';this.emit('shutdown',ok?'PASS':'BLOCKED');return ok
  })()
  return this.stopPromise
 }
}

async function noLinks(path){let current=resolve(path);for(;;){if((await lstat(current)).isSymbolicLink())fixedFailure();const parent=dirname(current);if(parent===current)break;current=parent}return realpath(path)}
async function privateRead(path,max=65536){await noLinks(path);const st=await lstat(path);if(!st.isFile()||st.nlink!==1||st.size>max)fixedFailure();return readFile(path,'utf8')}

export class GuardianClient {
 constructor(child,{plan=()=>({})}={}){this.child=child;this.pending=[];this.alive=true;this.plan=plan;this.ready=new Promise((resolve,reject)=>{this.boot={resolve,reject}});let bytes=0,buffer=''
  child.stdout.on('data',chunk=>{try{bytes+=chunk.length;buffer+=chunk.toString('utf8');if(bytes>262144)fixedFailure();for(;;){const end=buffer.indexOf('\n');if(end<0)break;if(end>4096)fixedFailure();const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);const value=JSON.parse(line);if(Object.keys(value).some(key=>!['status','kind','pid','stage'].includes(key))||(value.stage!==undefined&&!guardianStages.has(value.stage))||!['READY','LAUNCHED','CHILD_STOPPED','HEALTHY','APP_READY','APP_WAIT','STOPPED','BLOCKED'].includes(value.status))fixedFailure();const failure=new LaunchFailure('guardian_'+value.stage);if(this.boot){const b=this.boot;this.boot=null;if(value.status!=='READY')b.reject(failure);else b.resolve(value)}else{const waiter=this.pending.shift();if(!waiter)fixedFailure();value.status==='BLOCKED'?waiter.reject(failure):waiter.resolve(value)}}if(buffer.length>4096)fixedFailure()}catch{this.fail()}})
  child.once('error',()=>this.fail());child.once('exit',()=>this.fail());child.stderr?.resume()
 }
 fail(){if(!this.alive)return;this.alive=false;this.boot?.reject(Error('QA_GUARDIAN_BLOCKED'));this.boot=null;for(const w of this.pending.splice(0))w.reject(Error('QA_GUARDIAN_BLOCKED'));this.child.stdin?.end();this.child.stdout?.destroy();this.onFailure?.()}
 async request(command){if(!this.alive)fixedFailure();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.fail();reject(Error('QA_GUARDIAN_TIMEOUT'))},20000);this.pending.push({resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});this.child.stdin.write(JSON.stringify(command)+'\n',error=>{if(error)this.fail()})})}
 async start(){await Promise.race([this.ready,new Promise((_,reject)=>{const timer=setTimeout(()=>{this.fail();reject(Error('QA_GUARDIAN_TIMEOUT'))},20000);timer.unref()})])}
 async launch(kind,enabled){const r=await this.request({command:'launch',kind,enabled,...this.plan(kind,enabled)});if(r.status!=='LAUNCHED'||r.kind!==kind||!Number.isSafeInteger(r.pid)||r.pid<=0)fixedFailure()}
 async stopChild(kind){const r=await this.request({command:'stopChild',kind});if(r.status!=='CHILD_STOPPED'||r.kind!==kind)fixedFailure()}
 async healthy(){const r=await this.request({command:'health'});return r.status==='HEALTHY'}
 async appReady(){const r=await this.request({command:'appReady'});if(!['APP_READY','APP_WAIT'].includes(r.status))fixedFailure();return r.status==='APP_READY'}
 async stop(){if(!this.alive)fixedFailure();const r=await this.request({command:'stop'});this.child.stdin.end();if(r.status!=='STOPPED')fixedFailure()}
}

let launchStage='arguments'
async function main(){
 if(process.platform!=='win32'||process.argv.length!==4||process.argv[2]!=='--pointer')fixedFailure()
 launchStage='metadata';const pointerPath=resolve(process.argv[3]),p=JSON.parse(await privateRead(pointerPath)),c=JSON.parse(await privateRead(p.runtimeFile)),state=JSON.parse(await privateRead(p.stateFile));launchStage='runtime_config';validateSupervisorConfig(c,state)
 if(resolve(p.runtimeFile)!==join(c.privateDirectory,'runtime.json')||resolve(p.stateFile)!==join(c.privateDirectory,'cluster-state.json')||p.privateDirectory!==c.privateDirectory)fixedFailure()
 if((await privateRead(join(c.privateDirectory,'qa-owned.txt'),128)).trim()!=='LegalHub Stage A synthetic QA')fixedFailure()
 launchStage='ngrok_binary';await noLinks(c.qaPwshExecutable);await noLinks(c.ngrokExe);await noLinks(c.repo)
 if(createHash('sha256').update(await readFile(c.ngrokExe)).digest('hex')!==c.supervisorApproval.ngrokSha256)fixedFailure()
 const scripts=dirname(fileURLToPath(import.meta.url)),env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs',TEMP:c.privateDirectory,TMP:c.privateDirectory,USERPROFILE:c.privateDirectory,APPDATA:c.privateDirectory,LOCALAPPDATA:c.privateDirectory}
 const guardianEnv=guardianEnvironment(c.privateDirectory)
 launchStage='guardian_git_dependency'
 await noLinks('C:\\Program Files\\Git\\cmd\\git.exe');if(!(await lstat('C:\\Program Files\\Git\\cmd\\git.exe')).isFile())throw new LaunchFailure('guardian_git_dependency')
 const guardianArgs=['-NoProfile','-NonInteractive','-File',join(scripts,'supervisor-process.ps1'),'-PointerPath',pointerPath,'-ParentPid',String(process.pid),'-NodeExe',process.execPath]
 const checkInputs=()=>new Promise((resolve,reject)=>{let output='';const check=spawn(c.qaPwshExecutable,[...guardianArgs,'-CheckOnly'],{env:guardianEnv,cwd:c.privateDirectory,windowsHide:true,stdio:['ignore','pipe','ignore']});const timer=setTimeout(()=>{check.stdin?.end();reject(new LaunchFailure('guardian_timeout'))},20000);check.stdout.on('data',bytes=>{output+=bytes.toString('utf8');if(output.length>4096){output='';reject(new LaunchFailure('guardian_protocol'))}});check.once('error',()=>{clearTimeout(timer);reject(new LaunchFailure('guardian_protocol'))});check.once('exit',code=>{clearTimeout(timer);try{const value=JSON.parse(output);if(value.status==='BLOCKED'&&guardianStages.has(value.stage)){reject(new LaunchFailure('guardian_'+value.stage));return}if(code!==0||value.status!=='VALIDATED')fixedFailure();resolve()}catch{reject(new LaunchFailure('guardian_protocol'))}})})
 launchStage='private_acl'
 await checkInputs()
 launchStage='credentials'
 const realFile=join(c.privateDirectory,'meta-real-private.json'),secret=(await privateRead(join(c.privateDirectory,'meta-app-secret.txt'),4096)).trim(),token=(await privateRead(join(c.privateDirectory,'meta-page-token.txt'),8192)).trim()
 launchStage='ngrok_config';validateNgrokConfig(await privateRead(join(c.privateDirectory,'ngrok.yml'),8192));launchStage='graph_preflight';let real=JSON.parse(await privateRead(realFile));validatePreflight(c,real,token,secret,Date.now(),true)
 launchStage='stop_marker';c.stopFile=join(c.privateDirectory,'STOP');try{await lstat(c.stopFile);fixedFailure()}catch(error){if(error.code!=='ENOENT')throw error}
 const emit=value=>process.stdout.write(JSON.stringify(value)+'\n')
 launchStage='prisma_import'
 const require=createRequire(join(c.repo,'package.json')),{PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasources:{db:{url:c.databaseUrl}}})
 launchStage='guardian_spawn';const child=spawn(c.qaPwshExecutable,guardianArgs,{env:guardianEnv,cwd:c.privateDirectory,windowsHide:true,stdio:['pipe','pipe','ignore']})
 const plan=(kind,enabled)=>kind==='app'?{exe:process.execPath,args:['--require',join(scripts,'supervisor-egress.cjs'),join(c.repo,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',String(c.appPort)],env:appEnvironment(c,real,token,secret,enabled,env.SystemRoot)}:{exe:c.ngrokExe,args:['http','http://127.0.0.1:'+c.gatePort,'--url','https://'+c.hostname,'--inspect=false','--config',join(c.privateDirectory,'ngrok.yml')],env}
 const guardian=new GuardianClient(child,{plan})
 const tuple={appId:c.appId,pageId:c.pageId,formId:c.formId},bindingWhere={appId_pageId_formId:tuple};let bindingId
 const deps={
  guardian,emit,now:Date.now,readReal:async()=>{const current=JSON.parse(await privateRead(realFile));validatePreflight(c,current,token,secret);return current},
  preflight:async()=>{await checkInputs();validateSupervisorConfig(c,state);validateNgrokConfig(await privateRead(join(c.privateDirectory,'ngrok.yml'),8192));real=JSON.parse(await privateRead(realFile));validatePreflight(c,real,token,secret)},
  db:{
   assertQa:async()=>{const [total,org,other]=await Promise.all([db.organization.count(),db.organization.findUnique({where:{id:c.organizationId},select:{name:true}}),db.metaLeadAdsBinding.count({where:{enabled:true}})]);if(total!==1||org?.name!=='LegalHub Internal QA'||other!==0)fixedFailure()},
   enableBinding:async()=>{const existing=await db.metaLeadAdsBinding.findUnique({where:bindingWhere});if(existing&&existing.organizationId!==c.organizationId)fixedFailure();const b=await db.metaLeadAdsBinding.upsert({where:bindingWhere,create:{...tuple,organizationId:c.organizationId,enabled:true,mode:'pilot',activatedAt:new Date(),pilotLeadIds:[]},update:{enabled:true,mode:'pilot',activatedAt:new Date(),pilotLeadIds:[]}});bindingId=b.id},
   allowLead:async id=>{if(!bindingId)fixedFailure();const result=await db.metaLeadAdsBinding.updateMany({where:{id:bindingId,organizationId:c.organizationId,...tuple,enabled:true,mode:'pilot'},data:{pilotLeadIds:[id]}});if(result.count!==1)fixedFailure()},
   disableBinding:()=>db.metaLeadAdsBinding.updateMany({where:{organizationId:c.organizationId,...tuple,...(bindingId?{id:bindingId}:{})},data:{enabled:false,mode:'off',pilotLeadIds:[]}}),
   close:()=>db.$disconnect(),
  },
  releaseGate:current=>{validatePreflight(c,current,token,secret);if(current.release!==false||existsSync(c.stopFile))fixedFailure();current.release=true;writeFileSync(realFile,JSON.stringify(current),{mode:0o600})},
  gateway:()=>new Promise((resolve,reject)=>{const gate=realGateway(c,secret);gate.once('error',reject);gate.listen(c.gatePort,'127.0.0.1',()=>resolve(gate))}),
  ready:async()=>{for(let n=0;n<100;n++){if(await guardian.appReady()){try{const response=await fetch('http://127.0.0.1:'+c.appPort+'/login',{redirect:'error',signal:AbortSignal.timeout(1000)});await response.body?.cancel();if(response.status===200&&await guardian.appReady())return}catch{}}await new Promise(r=>setTimeout(r,250))}fixedFailure()},
  worker:async signal=>{const r=await fetch('http://127.0.0.1:'+c.appPort+'/api/internal/meta-lead-ads',{method:'POST',headers:{Authorization:'Bearer '+c.secrets.worker},signal:AbortSignal.any([signal,AbortSignal.timeout(55000)]),redirect:'error'});await r.body?.cancel();emit(publicTelemetry({phase:'crm',status:r.ok?'PASS':'BLOCKED',httpStatus:r.status}))},
  closeFiles:async()=>{await writeFile(c.stopFile,'closed',{mode:0o600});const current=JSON.parse(await privateRead(realFile));current.release=false;current.closedAt=new Date().toISOString();await writeFile(realFile,JSON.stringify(current),{mode:0o600});c.enabled=false;c.workerEnabled=false;c.approvedTuples=[];c.pilotLeadIds=[];await writeFile(p.runtimeFile,JSON.stringify(c),{mode:0o600})},
 }
 const service=new QaSupervisor(c,deps),lines=createInterface({input:process.stdin});let serial=Promise.resolve();const finish=()=>void service.stop().then(ok=>{process.exitCode=ok?0:1;lines.close()})
 guardian.onFailure=()=>{if(!service.closing){emit(launchFailureTelemetry(null,'guardian_protocol'));finish()}}
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,finish)
 process.once('uncaughtException',finish);process.once('unhandledRejection',finish)
 lines.on('line',line=>{if(line==='STOP'){finish();return}serial=serial.then(()=>service.command(line)).catch(error=>{const stage=line==='ENABLE'?'supervisor_enable':line==='TUNNEL'?'supervisor_tunnel':line==='RELEASE'?'supervisor_release':'supervisor_start';emit(launchFailureTelemetry(error,stage));finish()})})
 lines.once('close',finish);process.stdin.once('end',finish)
 const timer=setInterval(()=>void service.tick(),500);timer.unref();const deadlineTimer=setTimeout(finish,Date.parse(c.supervisorApproval.deadlineAt)-Date.now());deadlineTimer.unref()
 try{await service.start()}catch(error){await service.stop();emit(launchFailureTelemetry(error,'supervisor_start'));process.exitCode=1}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{process.stdout.write(JSON.stringify(launchFailureTelemetry(error,launchStage))+'\n');process.exitCode=1})
