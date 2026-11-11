import {spawn} from 'node:child_process'
import {readFile,lstat,realpath,readdir} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {homedir} from 'node:os'
import {basename,dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {guardianEnvironment} from './supervisor.mjs'
const HOST_HASH='2a6769a3330dc1084d0154bfde7d164ab750ca7f700f313f9d417c1be78b2233'
const HOST_SUFFIX='.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
const operations=new Set(['none','configuration','query_time','query_image','open_parent','create_job','job_limits','exit_code','open_nul','attributes_init','attributes_update','create_process','assign_job','resume_thread','terminate_job'])
const phases=new Set(['metadata','scratch_prepare','scratch_inventory','caller_environment','parent','source','stdin_prepare','native_job','dummy','version_launch','version_wait','stop'])
const observations=[]
const progress=[]
const actualVersionModes=new Set(['Minimal','Alias','RegisteredAlias'])
const expectedCase=mode=>({metadata:'metadata',preparation:'preparation',Minimal:'minimal',Alias:'alias_path',RegisteredAlias:'registered_alias',InspectMinimal:'minimal',InspectAlias:'alias_path'}[mode])
const callerKeys=new Set(['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])
function validCallerMetadata(value){return value===undefined||value===null||value.inspected===true&&Object.keys(value).every(k=>['inspected','mismatchKeys','pathExact','pathWithHostPrefix','pathExtExeOnly','pathExtExeCpl','otherFieldsExact'].includes(k))&&Array.isArray(value.mismatchKeys)&&value.mismatchKeys.length<=9&&new Set(value.mismatchKeys).size===value.mismatchKeys.length&&value.mismatchKeys.every(k=>callerKeys.has(k))&&['pathExact','pathWithHostPrefix','pathExtExeOnly','pathExtExeCpl','otherFieldsExact'].every(k=>typeof value[k]==='boolean')}
export const versionPairPlan=()=>Object.freeze({status:'PLAN_ONLY',ownerPermissionRequired:true,cases:2,command:'version',onlyCallerPathVaries:true,originalRuntimeReplay:false,scope:'surrogate_version_only',ngrokStarted:false,metadataVerified:false,qaStateUsed:false})
export function pairCallerEnvironments(scratch,aliasDirectory){
 if(!/^[A-Za-z]:\\/.test(scratch)||/[\r\n\0;]/.test(scratch)||!/^([A-Za-z]:\\Users\\[^\\;\r\n\0]+)\\AppData\\Local\\Microsoft\\WindowsApps$/.test(aliasDirectory))throw Error('PAIR_REFUSED')
 const minimal=guardianEnvironment(scratch),withAlias={...minimal,PATH:minimal.PATH+';'+aliasDirectory}
 return {minimal,withAlias}
}
export function safePairResult(value){
 if(!value||Object.keys(value).some(k=>!['status','case','phase','versionAttempted','operation','nativeCode','stopped','activeProcesses','scratchEntries','legitHostCacheEntries','unexpectedEntries','versionExitedZero','callerEnvironment'].includes(k))||!['PASS','BLOCKED','METADATA_VERIFIED','PREPARED','INSPECTED'].includes(value.status)||!['metadata','preparation','minimal','alias_path','registered_alias'].includes(value.case)||!phases.has(value.phase)||typeof value.versionAttempted!=='boolean'||value.versionAttempted!==['version_launch','version_wait'].includes(value.phase)||!operations.has(value.operation)||!Number.isSafeInteger(value.nativeCode)||value.nativeCode<0||value.nativeCode>65535||typeof value.stopped!=='boolean'||typeof value.versionExitedZero!=='boolean'||![value.activeProcesses,value.scratchEntries,value.legitHostCacheEntries,value.unexpectedEntries].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000)||value.scratchEntries!==value.legitHostCacheEntries+value.unexpectedEntries||!validCallerMetadata(value.callerEnvironment))throw Error('PAIR_RESULT_REFUSED')
 return Object.freeze({...value})
}
export function boundPairResult(value,mode,exitCode){
 const result=safePairResult(value),expected=expectedCase(mode),success={metadata:'METADATA_VERIFIED',preparation:'PREPARED',Minimal:'PASS',Alias:'PASS',RegisteredAlias:'PASS',InspectMinimal:'INSPECTED',InspectAlias:'INSPECTED'}[mode]
 if(!expected||result.case!==expected||exitCode!==(result.status==='BLOCKED'?1:0)||![success,'BLOCKED'].includes(result.status)||(result.status==='PASS'&&(!result.versionExitedZero||!result.versionAttempted))||(!actualVersionModes.has(mode)&&result.versionAttempted)||(result.status==='INSPECTED'&&(result.phase!=='caller_environment'||result.callerEnvironment?.inspected!==true)))throw Error('PAIR_CHILD_BLOCKED')
 return result
}
export const pairSafelyRecorded=(results,closing)=>!closing&&results.length===2&&results.every(r=>r.stopped&&r.activeProcesses===0&&r.unexpectedEntries===0)
export const permittedMinimalFailure=result=>result.status==='BLOCKED'&&result.phase==='version_launch'&&result.versionAttempted===true&&result.operation==='create_process'&&result.nativeCode===5
export function safePairProgress(value,mode){if(!value||Object.keys(value).length!==4||Object.keys(value).some(k=>!['event','case','phase','versionAttempted'].includes(k))||value.event!=='phase'||value.case!==expectedCase(mode)||!phases.has(value.phase)||typeof value.versionAttempted!=='boolean'||(value.versionAttempted&&!['version_launch','version_wait','stop'].includes(value.phase))||(!actualVersionModes.has(mode)&&value.versionAttempted)||(['version_launch','version_wait'].includes(value.phase)&&!value.versionAttempted))throw Error('PAIR_PHASE_REFUSED');return Object.freeze({...value})}
export function recognizedHostCache({relative,directory,length,reparse}){return !reparse&&(directory?['AppData','AppData/Local','AppData/Local/Microsoft','AppData/Local/Microsoft/PowerShell'].includes(relative):['AppData/Local/Microsoft/PowerShell/StartupProfileData-NonInteractive','AppData/Local/Microsoft/PowerShell/ModuleAnalysisCache-7A5873E9'].includes(relative)&&Number.isSafeInteger(length)&&length>0&&length<=1048576||relative==='AppData/Local/Microsoft/PowerShell/telemetry.uuid'&&length===16)}
async function cacheInventory(root){let scratchEntries=0,legitHostCacheEntries=0,unexpectedEntries=0;const pending=[''];while(pending.length){const relative=pending.shift();for(const name of await readdir(join(root,relative))){if(++scratchEntries>16)throw Error('CACHE_BOUND');const child=relative?relative+'/'+name:name,s=await lstat(join(root,child)),known=recognizedHostCache({relative:child,directory:s.isDirectory(),length:s.size,reparse:s.isSymbolicLink()});if(known){legitHostCacheEntries++;if(s.isDirectory())pending.push(child)}else unexpectedEntries++}}return {scratchEntries,legitHostCacheEntries,unexpectedEntries}}
export function superviseOwnedVersionChild(child,mode,timers={setTimeout,clearTimeout}){
 let requestStop;const journal=[];const promise=new Promise((resolveResult,reject)=>{
  let text='',totalBytes=0,result,finished=false,aborting=false,exited=false,grace,killWait
  child.stdin.on('error',()=>{})
  const finish=(error,value,uncertain=false)=>{if(finished)return;finished=true;for(const timer of [watchdog,grace,killWait])timers.clearTimeout(timer);if(error){const failure=Error('PAIR_CHILD_BLOCKED');failure.cleanupUncertain=uncertain;failure.versionAttemptsUnknown=actualVersionModes.has(mode);failure.lastPhase=journal.at(-1)?.phase||'unvalidated';failure.lastVersionAttempted=journal.at(-1)?.versionAttempted??null;reject(failure)}else resolveResult(value)}
  const parseLine=line=>{if(!line.trim())return;const value=JSON.parse(line);if(result)throw Error('PAIR_PROTOCOL');if(value?.event==='phase'){if(journal.length>=16)throw Error('PAIR_PHASE_BOUND');const frame=safePairProgress(value,mode);if(journal.at(-1)?.versionAttempted&&!frame.versionAttempted)throw Error('PAIR_ATTEMPT_RESET');journal.push(frame)}else result=safePairResult(value)}
  requestStop=()=>{if(finished||aborting)return;aborting=true;try{child.stdin.end('STOP\n')}catch{};grace=timers.setTimeout(()=>{if(!exited){try{child.kill()}catch{}};killWait=timers.setTimeout(()=>{child.stdout.destroy();child.stdin.destroy();child.unref();finish(true,undefined,true)},2000)},5000)}
  const watchdog=timers.setTimeout(requestStop,25000)
  child.stdout.on('data',bytes=>{totalBytes+=bytes.length;if(totalBytes>4096){requestStop();return};text+=bytes.toString('utf8');try{let end;while((end=text.indexOf('\n'))>=0){parseLine(text.slice(0,end));text=text.slice(end+1)}}catch{requestStop()}});child.once('error',()=>{if(child.pid)requestStop();else finish(true)});child.once('exit',()=>{exited=true});child.once('close',code=>{try{if(text.trim())parseLine(text);if(aborting)throw Error('PAIR_ABORTED');const value=boundPairResult(result,mode,code);if(journal.some(r=>r.versionAttempted)!==value.versionAttempted||value.versionAttempted&&!journal.some(r=>r.phase==='version_launch'&&r.versionAttempted))throw Error('PAIR_ATTEMPT_RESET');finish(false,value)}catch{finish(true,undefined,true)}})
 });return {promise,journal,stop:()=>requestStop()}
}
export async function noLinks(path){let current=resolve(path);for(;;){const s=await lstat(current);if(s.isSymbolicLink())throw Error('PAIR_PATH_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}if((await realpath(path)).toLowerCase()!==resolve(path).toLowerCase())throw Error('PAIR_PATH_REFUSED')}
export async function approvedProbeContext(){if(process.platform!=='win32'||process.execPath.toLowerCase()!=='c:\\program files\\nodejs\\node.exe')throw Error('PAIR_HOST');const here=dirname(fileURLToPath(import.meta.url)),checkout=resolve(here,'../../..'),profile=homedir(),pwsh=join(profile,...HOST_SUFFIX.split('/')),aliasDirectory=join(profile,'AppData','Local','Microsoft','WindowsApps');await noLinks(pwsh);if(!(await lstat(pwsh)).isFile()||createHash('sha256').update(await readFile(pwsh)).digest('hex')!==HOST_HASH)throw Error('PAIR_HOST');return {here,checkout,profile,pwsh,aliasDirectory}}
async function main(){
 const argument=process.argv[2]
 if(process.argv.length===2||argument==='--plan'){if(process.argv.length>3)throw Error('PAIR_ARGS');console.log(JSON.stringify(versionPairPlan()));return}
 const inspect=argument==='--inspect-caller-environment'
 if(process.argv.length!==(inspect?4:3)||!['--metadata-only','--expected-owner-authorized-version-probe','--inspect-caller-environment'].includes(argument)||process.platform!=='win32'||process.execPath.toLowerCase()!=='c:\\program files\\nodejs\\node.exe')throw Error('PAIR_ARGS')
 const {here,checkout,profile,pwsh,aliasDirectory}=await approvedProbeContext()
 let current,closing=false;const stop=()=>{closing=true;current?.stop()}
 const run=async(mode,environment,scratch,deadline)=>{
  const args=['-NoProfile','-NonInteractive','-File',join(here,'version-caller-pair.ps1'),'-AliasDirectory',aliasDirectory,'-ParentPid',String(process.pid)]
  if(mode==='metadata')args.push('-MetadataOnly');else if(mode==='preparation')args.push('-ExpectedOwnerAuthorizedVersionProbe','-PrepareScratch','-ScratchRoot',scratch);else if(mode.startsWith('Inspect'))args.push('-InspectCallerEnvironment','-Case',mode.slice(7),'-ScratchRoot',scratch);else args.push('-ExpectedOwnerAuthorizedVersionProbe','-Case',mode,'-ScratchRoot',scratch,'-DeadlineUtc',deadline)
  const child=spawn(pwsh,args,{env:environment,cwd:checkout,windowsHide:true,stdio:['pipe','pipe','ignore']}),owned=superviseOwnedVersionChild(child,mode);current={child,stop:owned.stop}
  try{return await owned.promise}finally{progress.push(...owned.journal);if(current?.child===child)current=null}
 }
 const base=guardianEnvironment(profile),metadata=await run('metadata',base)
 if(metadata.status!=='METADATA_VERIFIED'){console.log(JSON.stringify(metadata));process.exitCode=1;return}
 if(argument==='--metadata-only'){console.log(JSON.stringify(metadata));return}
 const qa=join(checkout,'.qa');await noLinks(qa)
 if(inspect){const scratch=resolve(process.argv[3]);if(process.argv[3]!==scratch||dirname(scratch).toLowerCase()!==qa.toLowerCase()||!/^ngrok-caller-pair-[a-f0-9]{32}$/.test(basename(scratch)))throw Error('INSPECT_ROOT');await noLinks(scratch);const environments=pairCallerEnvironments(scratch,aliasDirectory),results=[];for(const [mode,environment] of [['InspectMinimal',environments.minimal],['InspectAlias',environments.withAlias]]){const result=await run(mode,environment,scratch);results.push(result);if(result.status!=='INSPECTED')break};console.log(JSON.stringify({status:results.length===2&&results.every(r=>r.status==='INSPECTED')?'CALLER_INSPECTED':'BLOCKED',results,ngrokStarted:false,versionCalls:0}));return}
 const scratch=join(qa,'ngrok-caller-pair-'+randomUUID().replaceAll('-','')),prepared=await run('preparation',base,scratch)
 if(prepared.status!=='PREPARED'){console.log(JSON.stringify(prepared));process.exitCode=1;return};await noLinks(scratch)
 const env=pairCallerEnvironments(scratch,aliasDirectory),deadline=new Date(Date.now()+45000).toISOString(),results=observations
 process.stdin.resume();process.stdin.once('end',stop);process.stdin.on('data',stop);process.once('SIGINT',stop);process.once('SIGTERM',stop)
 const absoluteTimer=setTimeout(stop,45000);absoluteTimer.unref()
 try{
 for(const [mode,environment] of [['Minimal',env.minimal],['Alias',env.withAlias]]){
  if(closing)break
  const result=await run(mode,environment,scratch,deadline);results.push(result)
  if(!result.stopped||result.unexpectedEntries!==0||result.activeProcesses!==0)break
  if(result.status!=='PASS'&&!(mode==='Minimal'&&permittedMinimalFailure(result)))break
 }
 const inventory=await cacheInventory(scratch),recorded=pairSafelyRecorded(results,closing)&&inventory.unexpectedEntries===0
 console.log(JSON.stringify({status:recorded?'PAIR_RECORDED':'BLOCKED',results,progress,...inventory,ngrokTunnelStarted:false,qaStateUsed:false}));if(!recorded)process.exitCode=1
 }finally{clearTimeout(absoluteTimer);process.stdin.pause()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{process.stdin.pause();console.log(JSON.stringify({status:'BLOCKED',code:'VERSION_PAIR_REFUSED',results:observations,progress,lastPhase:phases.has(error?.lastPhase)?error.lastPhase:'unvalidated',versionAttempted:typeof error?.lastVersionAttempted==='boolean'?error.lastVersionAttempted:null,versionAttemptsUnknown:error?.versionAttemptsUnknown===true,ngrokTunnelStarted:false,cleanupUncertain:error?.cleanupUncertain===true}));process.exitCode=1})
