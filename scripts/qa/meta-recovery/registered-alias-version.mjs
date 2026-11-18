import {spawn} from 'node:child_process'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {approvedProbeContext,noLinks,pairCallerEnvironments,superviseOwnedVersionChild} from './version-caller-pair.mjs'
export const ALIAS_SCRATCH='ngrok-caller-pair-903102b5eed94e98afd0c7d49d10fd56'
export const aliasVersionPlan=()=>Object.freeze({status:'PLAN_ONLY',ownerPermissionRequired:true,versionAttempts:1,entryPoint:'verified_registered_app_execution_alias',retainedImage:'pinned_store_image',existingScratchRequired:true,createsDirectories:false,metadataVerified:false,ngrokStarted:false,qaStateUsed:false})
let journal=[]
async function main(){
 const flag=process.argv[2]
 if(process.argv.length===2||flag==='--plan'){if(process.argv.length>3)throw Error('ALIAS_ARGS');console.log(JSON.stringify(aliasVersionPlan()));return}
 if(process.argv.length!==3||flag!=='--expected-owner-authorized-one-alias-version')throw Error('ALIAS_ARGS')
 const {pwsh,here,checkout,aliasDirectory}=await approvedProbeContext(),scratch=join(checkout,'.qa',ALIAS_SCRATCH)
 await noLinks(scratch)
 const environment=pairCallerEnvironments(scratch,aliasDirectory).withAlias,deadline=new Date(Date.now()+45000).toISOString()
 const args=['-NoProfile','-NonInteractive','-File',join(here,'version-caller-pair.ps1'),'-ExpectedOwnerAuthorizedVersionProbe','-RegisteredAliasVersion','-Case','Alias','-ScratchRoot',scratch,'-AliasDirectory',aliasDirectory,'-ParentPid',String(process.pid),'-DeadlineUtc',deadline]
 const child=spawn(pwsh,args,{cwd:checkout,env:environment,windowsHide:true,stdio:['pipe','pipe','ignore']}),owned=superviseOwnedVersionChild(child,'RegisteredAlias');journal=owned.journal
 const stop=()=>owned.stop();process.stdin.resume();process.stdin.once('end',stop);process.stdin.on('data',stop);process.once('SIGINT',stop);process.once('SIGTERM',stop);const timer=setTimeout(stop,45000);timer.unref()
 try{const result=await owned.promise;console.log(JSON.stringify({status:result.status==='PASS'&&result.stopped&&result.activeProcesses===0&&result.unexpectedEntries===0?'PASS':'BLOCKED',result,progress:journal,ngrokTunnelStarted:false,qaStateUsed:false}));if(result.status!=='PASS'||!result.stopped||result.activeProcesses!==0||result.unexpectedEntries!==0)process.exitCode=1}finally{clearTimeout(timer);process.stdin.pause()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{process.stdin.pause();console.log(JSON.stringify({status:'BLOCKED',code:'REGISTERED_ALIAS_VERSION_REFUSED',progress:journal,lastPhase:journal.at(-1)?.phase||'unvalidated',versionAttempted:journal.at(-1)?.versionAttempted??null,versionAttemptsUnknown:error?.versionAttemptsUnknown===true,cleanupUncertain:error?.cleanupUncertain===true,ngrokTunnelStarted:false}));process.exitCode=1})
