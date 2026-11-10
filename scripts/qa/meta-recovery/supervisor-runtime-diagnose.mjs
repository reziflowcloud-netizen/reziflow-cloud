// Read-only guard probe. No SQL, credentials output, services or providers.
import {readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {guardianEnvironment} from './supervisor.mjs'
const stages=new Set(['host','pointer_acl','pointer_parse','root','marker','runtime_acl','runtime_parse','database_target','postgres_ownership','repo','source_path','git_resolution','source_git_bare_resolution','source_git_bare_command_missing','source_git_head','source_git_security_ownership','source_git_security_access','source_git_security_execution','source_git_invocation_failure','source_git_not_started','source_git_native_failure','source_git_command_missing','source_git_property_missing','source_git_last_exit_missing','source_git_head_failure','source_guard','full_guard'])
try{
 if(![4,5].includes(process.argv.length)||process.argv[2]!=='--pointer'||(process.argv.length===5&&process.argv[4]!=='--without-pathext'))throw Error('BLOCKED')
 const pointer=resolve(process.argv[3]),p=JSON.parse(await readFile(pointer,'utf8')),c=JSON.parse(await readFile(p.runtimeFile,'utf8'))
 if(!/^D:\\LegalHubStageA-[0-9a-f]{32}$/.test(p.privateDirectory||'')||c.privateDirectory!==p.privateDirectory)throw Error('BLOCKED')
 const environment=guardianEnvironment(p.privateDirectory);if(process.argv[4]==='--without-pathext')delete environment.PATHEXT
 const child=spawn(c.qaPwshExecutable,['-NoProfile','-NonInteractive','-File',join(dirname(fileURLToPath(import.meta.url)),'supervisor-runtime-diagnose.ps1'),'-PointerPath',pointer],{env:environment,windowsHide:true,stdio:['ignore','pipe','ignore']})
 let output='';child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>4096)output='invalid'})
 child.on('error',()=>{process.stdout.write('{"status":"BLOCKED","stage":"probe"}\n');process.exitCode=1})
 child.on('exit',code=>{try{const value=JSON.parse(output);if(!['PASS','BLOCKED'].includes(value.status)||!stages.has(value.stage))throw Error('BLOCKED');const safe={status:value.status,stage:value.stage};if(Number.isSafeInteger(value.nativeCode)&&value.nativeCode>=0&&value.nativeCode<=65535)safe.nativeCode=value.nativeCode;process.stdout.write(JSON.stringify(safe)+'\n');process.exitCode=code===0?0:1}catch{process.stdout.write('{"status":"BLOCKED","stage":"probe"}\n');process.exitCode=1}})
}catch{process.stdout.write('{"status":"BLOCKED","stage":"probe"}\n');process.exitCode=1}
