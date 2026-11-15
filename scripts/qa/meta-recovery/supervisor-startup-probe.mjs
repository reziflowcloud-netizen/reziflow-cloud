// One metadata/empty-guardian timing probe. Never sends launch, Meta or HTTP requests.
import {spawn} from 'node:child_process'
import {readFile,lstat,realpath} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {dirname,join,resolve} from 'node:path'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {GuardianClient,guardianStoreEnvironment} from './supervisor.mjs'

const refuse=()=>{throw Error('QA_STARTUP_PROBE_REFUSED')}
const noLinks=async path=>{for(let current=path;;){if((await lstat(current)).isSymbolicLink())refuse();const parent=dirname(current);if(parent===current)break;current=parent}if(await realpath(path)!==path)refuse()}
let child,guardian,closed,timer,probeStage='args'
try{
 if(process.platform!=='win32'||process.execPath!=='C:\\Program Files\\nodejs\\node.exe'||process.argv.length!==4||process.argv[2]!=='--pointer')refuse()
 const here=dirname(fileURLToPath(import.meta.url)),pointer=resolve(process.argv[3])
 probeStage='pointer'
 if(pointer!==resolve(here,'../../../.qa/meta-recovery-final-20261115/private-pointer.json'))refuse()
 await noLinks(pointer)
 const st=await lstat(pointer);if(!st.isFile()||st.nlink!==1||st.size>16384)refuse()
 const p=JSON.parse(await readFile(pointer,'utf8'))
 if(!/^D:\\LegalHubStageA-[0-9a-f]{32}$/.test(p.privateDirectory)||p.runtimeFile!==join(p.privateDirectory,'runtime.json')||p.stateFile!==join(p.privateDirectory,'cluster-state.json'))refuse()
 await noLinks(p.privateDirectory);if(!(await lstat(p.privateDirectory)).isDirectory())refuse()
 probeStage='host'
 const host=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')
 await noLinks(host);const hostStat=await lstat(host);if(!hostStat.isFile()||hostStat.nlink!==1||hostStat.size<=0||hostStat.size>16777216)refuse()
 if(createHash('sha256').update(await readFile(host)).digest('hex')!=='2a6769a3330dc1084d0154bfde7d164ab750ca7f700f313f9d417c1be78b2233')refuse()
 probeStage='spawn';const started=performance.now()
 child=spawn(host,['-NoProfile','-NonInteractive','-File',join(here,'supervisor-process.ps1'),'-PointerPath',pointer,'-ParentPid',String(process.pid),'-NodeExe',process.execPath],{cwd:p.privateDirectory,env:guardianStoreEnvironment(p.privateDirectory,host),windowsHide:true,stdio:['pipe','pipe','ignore']})
 closed=new Promise(resolve=>child.once('close',code=>resolve(code)))
 guardian=new GuardianClient(child)
 probeStage='ready'
 await Promise.race([guardian.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_STARTUP_PROBE_TIMEOUT')),60000)})]);clearTimeout(timer)
 const readyMs=Math.round(performance.now()-started)
 probeStage='stop'
 await guardian.stop()
 probeStage='close'
 const code=await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_STARTUP_PROBE_CLOSE_TIMEOUT')),10000)})]);clearTimeout(timer)
 if(code!==0)refuse()
 console.log(JSON.stringify({phase:'prepare',status:'PASS',guardianReadyMs:readyMs,emptyGuardianStop:'PASS',ngrokLaunched:false,providerCredentialFilesOpened:false}))
}catch{
 console.log(JSON.stringify({phase:'prepare',status:'BLOCKED',code:'QA_STARTUP_PROBE_REFUSED',probeStage,ngrokLaunched:false}))
 process.exitCode=1
}finally{
 clearTimeout(timer)
 if(child&&child.exitCode===null){
  child.stdin?.end()
  const exited=await Promise.race([closed.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),5000))])
  if(!exited){child.kill();const ended=await Promise.race([closed.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),5000))]);if(!ended){child.stdin?.destroy();child.stdout?.destroy();child.unref();console.log('{"phase":"shutdown","status":"BLOCKED","code":"QA_STARTUP_PROBE_CLEANUP_UNCERTAIN"}');process.exitCode=1}}
 }
}
