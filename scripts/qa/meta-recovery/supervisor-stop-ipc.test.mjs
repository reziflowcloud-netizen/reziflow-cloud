import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {dirname,join} from 'node:path'
import {tmpdir,homedir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {GuardianClient} from './supervisor.mjs'

test('native dummy Job drains STOPPED through real approved PowerShell pipes',{skip:process.platform!=='win32',timeout:30000},async t=>{
 const here=dirname(fileURLToPath(import.meta.url))
 const host=join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','native','powershell','pwsh.exe')
 const child=spawn(host,['-NoProfile','-NonInteractive','-File',join(here,'supervisor-stop-ipc.fixture.ps1'),'-ParentPid',String(process.pid)],{
  cwd:here,windowsHide:true,stdio:['pipe','pipe','ignore'],
  env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs',TEMP:tmpdir(),TMP:tmpdir()}})
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})))
 const acknowledged=ms=>new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),ms);closed.then(()=>{clearTimeout(timer);resolve(true)})})
 t.after(async()=>{
  if(child.exitCode!==null)return
  child.stdin?.end();if(await acknowledged(5000))return
  child.kill();if(await acknowledged(5000))return
  child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();child.unref()
  throw Error('QA_FIXTURE_CLEANUP_UNCERTAIN')
 })
 const guardian=new GuardianClient(child)
 await guardian.start();await guardian.stop()
 const result=await closed;assert.equal(result.code,0);assert.equal(result.signal,null)
 assert.equal(guardian.pending.length,0);assert.equal(guardian.alive,false)
})
