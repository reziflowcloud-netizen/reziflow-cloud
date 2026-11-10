import {spawn} from 'node:child_process'
import {readFile,lstat,realpath,mkdir,readdir} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {homedir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {guardianEnvironment} from './supervisor.mjs'
const HOST_HASH='2a6769a3330dc1084d0154bfde7d164ab750ca7f700f313f9d417c1be78b2233'
const HOST_SUFFIX='.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
const operations=new Set(['none','configuration','query_time','query_image','open_parent','create_job','job_limits','exit_code','open_nul','attributes_init','attributes_update','create_process','assign_job','resume_thread','terminate_job'])
export const versionPairPlan=()=>Object.freeze({status:'PLAN_ONLY',ownerPermissionRequired:true,cases:2,command:'version',onlyCallerPathVaries:true,originalRuntimeReplay:false,scope:'surrogate_version_only',ngrokStarted:false,metadataVerified:false,qaStateUsed:false})
export function pairCallerEnvironments(scratch,aliasDirectory){
 if(!/^[A-Za-z]:\\/.test(scratch)||/[\r\n\0;]/.test(scratch)||!/^([A-Za-z]:\\Users\\[^\\;\r\n\0]+)\\AppData\\Local\\Microsoft\\WindowsApps$/.test(aliasDirectory))throw Error('PAIR_REFUSED')
 const minimal=guardianEnvironment(scratch),withAlias={...minimal,PATH:minimal.PATH+';'+aliasDirectory}
 return {minimal,withAlias}
}
export function safePairResult(value){
 if(!value||Object.keys(value).some(k=>!['status','case','operation','nativeCode','stopped','activeProcesses','scratchEntries','versionExitedZero'].includes(k))||!['PASS','BLOCKED','METADATA_VERIFIED'].includes(value.status)||!['metadata','minimal','alias_path'].includes(value.case)||!operations.has(value.operation)||!Number.isSafeInteger(value.nativeCode)||value.nativeCode<0||value.nativeCode>65535||typeof value.stopped!=='boolean'||typeof value.versionExitedZero!=='boolean'||![value.activeProcesses,value.scratchEntries].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000))throw Error('PAIR_RESULT_REFUSED')
 return Object.freeze({...value})
}
export function boundPairResult(value,mode,exitCode){
 const result=safePairResult(value),expected={metadata:'metadata',Minimal:'minimal',Alias:'alias_path'}[mode]
 if(!expected||result.case!==expected||exitCode!==(result.status==='BLOCKED'?1:0)||(mode==='metadata'? !['METADATA_VERIFIED','BLOCKED'].includes(result.status):!['PASS','BLOCKED'].includes(result.status))||(result.status==='PASS'&&!result.versionExitedZero))throw Error('PAIR_CHILD_BLOCKED')
 return result
}
export const pairSafelyRecorded=(results,closing)=>!closing&&results.length===2&&results.every(r=>r.stopped&&r.activeProcesses===0&&r.scratchEntries===0)
export function superviseOwnedVersionChild(child,mode,timers={setTimeout,clearTimeout}){
 let requestStop;const promise=new Promise((resolveResult,reject)=>{
  let text='',finished=false,aborting=false,exited=false,grace,killWait
  child.stdin.on('error',()=>{})
  const finish=(error,result,uncertain=false)=>{if(finished)return;finished=true;for(const timer of [watchdog,grace,killWait])timers.clearTimeout(timer);if(error){const failure=Error('PAIR_CHILD_BLOCKED');failure.cleanupUncertain=uncertain;reject(failure)}else resolveResult(result)}
  requestStop=()=>{if(finished||aborting)return;aborting=true;try{child.stdin.end('STOP\n')}catch{};grace=timers.setTimeout(()=>{if(!exited){try{child.kill()}catch{}};killWait=timers.setTimeout(()=>{child.stdout.destroy();child.stdin.destroy();child.unref();finish(true,undefined,true)},2000)},5000)}
  const watchdog=timers.setTimeout(requestStop,25000)
  child.stdout.on('data',bytes=>{if(text.length<=4096)text+=bytes.toString('utf8');if(text.length>4096)requestStop()});child.once('error',()=>{if(child.pid)requestStop();else finish(true)});child.once('exit',()=>{exited=true});child.once('close',code=>{if(aborting){finish(true,undefined,true);return};try{finish(false,boundPairResult(JSON.parse(text),mode,code))}catch{finish(true,undefined,true)}})
 });return {promise,stop:()=>requestStop()}
}
async function noLinks(path){let current=resolve(path);for(;;){const s=await lstat(current);if(s.isSymbolicLink())throw Error('PAIR_PATH_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}if((await realpath(path)).toLowerCase()!==resolve(path).toLowerCase())throw Error('PAIR_PATH_REFUSED')}
async function main(){
 const argument=process.argv[2]
 if(process.argv.length===2||argument==='--plan'){if(process.argv.length>3)throw Error('PAIR_ARGS');console.log(JSON.stringify(versionPairPlan()));return}
 if(process.argv.length!==3||!['--metadata-only','--expected-owner-authorized-version-probe'].includes(argument)||process.platform!=='win32'||process.execPath.toLowerCase()!=='c:\\program files\\nodejs\\node.exe')throw Error('PAIR_ARGS')
 const here=dirname(fileURLToPath(import.meta.url)),checkout=resolve(here,'../../..'),profile=homedir(),pwsh=join(profile,...HOST_SUFFIX.split('/')),aliasDirectory=join(profile,'AppData','Local','Microsoft','WindowsApps')
 await noLinks(pwsh);if(!(await lstat(pwsh)).isFile()||createHash('sha256').update(await readFile(pwsh)).digest('hex')!==HOST_HASH)throw Error('PAIR_HOST')
 let current,closing=false;const stop=()=>{closing=true;current?.stop()}
 const run=async(mode,environment,scratch,deadline)=>{
  const args=['-NoProfile','-NonInteractive','-File',join(here,'version-caller-pair.ps1'),'-AliasDirectory',aliasDirectory,'-ParentPid',String(process.pid)]
  if(mode==='metadata')args.push('-MetadataOnly');else args.push('-ExpectedOwnerAuthorizedVersionProbe','-Case',mode,'-ScratchRoot',scratch,'-DeadlineUtc',deadline)
  const child=spawn(pwsh,args,{env:environment,cwd:checkout,windowsHide:true,stdio:['pipe','pipe','ignore']}),owned=superviseOwnedVersionChild(child,mode);current={child,stop:owned.stop}
  try{return await owned.promise}finally{if(current?.child===child)current=null}
 }
 const base=guardianEnvironment(profile),metadata=await run('metadata',base)
 if(metadata.status!=='METADATA_VERIFIED'){console.log(JSON.stringify(metadata));process.exitCode=1;return}
 if(argument==='--metadata-only'){console.log(JSON.stringify(metadata));return}
 const qa=join(checkout,'.qa');await noLinks(qa)
 const scratch=join(qa,'ngrok-caller-pair-'+randomUUID().replaceAll('-',''));await mkdir(scratch);await noLinks(scratch)
 const env=pairCallerEnvironments(scratch,aliasDirectory),deadline=new Date(Date.now()+45000).toISOString(),results=[]
 process.stdin.resume();process.stdin.once('end',stop);process.stdin.on('data',stop);process.once('SIGINT',stop);process.once('SIGTERM',stop)
 const absoluteTimer=setTimeout(stop,45000);absoluteTimer.unref()
 try{
 for(const [mode,environment] of [['Minimal',env.minimal],['Alias',env.withAlias]]){
  if(closing)break
  const result=await run(mode,environment,scratch,deadline);results.push(result)
  if(!result.stopped||result.scratchEntries!==0||result.activeProcesses!==0)break
  if(result.status!=='PASS'&&!(mode==='Minimal'&&result.operation==='create_process'&&result.nativeCode===5))break
 }
 if((await readdir(scratch)).length!==0)throw Error('PAIR_SCRATCH_CHANGED')
 const recorded=pairSafelyRecorded(results,closing)
 console.log(JSON.stringify({status:recorded?'PAIR_RECORDED':'BLOCKED',results,ngrokTunnelStarted:false,qaStateUsed:false}));if(!recorded)process.exitCode=1
 }finally{clearTimeout(absoluteTimer);process.stdin.pause()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{process.stdin.pause();console.log(JSON.stringify({status:'BLOCKED',code:'VERSION_PAIR_REFUSED',ngrokTunnelStarted:false,cleanupUncertain:error?.cleanupUncertain===true}));process.exitCode=1})
