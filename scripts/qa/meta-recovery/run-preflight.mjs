import {open, lstat, realpath} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {join, dirname, resolve, basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {runGraphPreflight} from './graph-preflight.mjs'
import {publicTelemetry, assertPublishableText, scanArtifacts} from './secret-safety.mjs'

const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&b.nlink===1
async function noLinks(path){for(let current=resolve(path);;){if((await lstat(current)).isSymbolicLink())throw Error('LINK_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}if(resolve(await realpath(path)).toLowerCase()!==resolve(path).toLowerCase())throw Error('LINK_REFUSED')}
async function privateRead(path,guard,max){
  if(!await guard(path))throw Error('PRIVATE_REFUSED')
  const before=await lstat(path)
  if(!before.isFile()||before.nlink!==1||before.size>max)throw Error('PRIVATE_REFUSED')
  const h=await open(path,'r')
  try{
    if(!same(before,await h.stat()))throw Error('PRIVATE_CHANGED')
    const bytes=Buffer.alloc(max+1);let length=0
    while(length<bytes.length){const r=await h.read(bytes,length,bytes.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead}
    if(length>max||!same(before,await h.stat())||!same(before,await lstat(path))||!await guard(path))throw Error('PRIVATE_CHANGED')
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length))
  }finally{await h.close()}
}

async function main(){
  const here=dirname(fileURLToPath(import.meta.url))
  const runtimeFile=process.env.QA_STAGE_A_PRIVATE_CONFIG
  const pwsh=process.env.QA_PWSH_EXE
  const refreshClosed=process.env.QA_REFRESH_CLOSED==='true'
  if(process.env.QA_REFRESH_CLOSED!==undefined&&!['true','false'].includes(process.env.QA_REFRESH_CLOSED))throw Error('INPUT_REFUSED')
  if(!runtimeFile||!pwsh||process.env.QA_UI_APP!=='2523488421395251'||process.env.QA_UI_OWNER!=='confirmed')throw Error('INPUT_REFUSED')
  const root=dirname(resolve(runtimeFile))
  const guard=async path=>{
    const result=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',join(here,'assert-private.ps1'),'-PrivateRoot',root,'-Path',path],{windowsHide:true,stdio:'ignore',timeout:20000})
    return !result.error&&result.status===0
  }
  const c=JSON.parse(await privateRead(runtimeFile,guard,65536))
  if(c.privateDirectory!==root||c.qaPwshExecutable!==pwsh||c.appId!=='2523488421395251'||c.approvedMetaAppId!==c.appId||c.enabled!==false||c.workerEnabled!==false)throw Error('RUNTIME_REFUSED')
  const knownSecrets=[c.databaseUrl,...Object.values(c.secrets||{}),...Object.values(c.passwords||{})].filter(x=>typeof x==='string'&&x.length>0)
  for(const leaf of ['meta-user-token.txt','meta-app-secret.txt','meta-page-token.txt']){
    const path=join(root,leaf)
    const value=(await privateRead(path,guard,4096)).trim();if(value)knownSecrets.push(value)
  }
  const resultRoot=resolve(process.env.QA_RESULT_DIRECTORY||'')
  const checkout=resolve(here,'../../..')
  if(dirname(resultRoot)!==join(checkout,'.qa')||!/^meta-recovery-\d{8}$/.test(basename(resultRoot)))throw Error('RESULT_REFUSED')
  await noLinks(resultRoot)
  const file=join(resultRoot,refreshClosed?'graph-preflight-refresh-'+randomUUID()+'.json':'graph-preflight-result.json')
  const paths=refreshClosed?[file,join(resultRoot,'graph-preflight-result.json')]:[file]
  const existing=await lstat(file).catch(error=>{if(error.code==='ENOENT')return null;throw error})
  if(existing)throw Error('RESULT_EXISTS')
  const ignored=spawnSync(process.env.QA_GIT_EXE,['-C',checkout,'check-ignore','--quiet',file],{windowsHide:true,stdio:'ignore',timeout:20000})
  if(ignored.error||ignored.status!==0)throw Error('RESULT_NOT_IGNORED')
  const placeholder=JSON.stringify(publicTelemetry({phase:'preflight',status:'BLOCKED',counts:{requests:0}}))+'\n'
  assertPublishableText(placeholder,{knownSecrets})
  const output=await open(file,'wx',0o600)
  let result,text
  try{
    await output.writeFile(placeholder);await output.sync()
    const before=await output.stat()
    await scanArtifacts({root:resultRoot,paths,knownSecrets})
    result=await runGraphPreflight({privateRoot:root,assertPrivateFile:guard,uiConfirmedAppId:c.appId,uiConfirmedProfile:true,refreshClosed})
    const page=(await privateRead(join(root,'meta-page-token.txt'),guard,4096)).trim();if(page)knownSecrets.push(page)
    text=JSON.stringify(result)
    assertPublishableText(text,{knownSecrets})
    await noLinks(resultRoot)
    if(!same(before,await output.stat())||!same(before,await lstat(file)))throw Error('RESULT_CHANGED')
    const bytes=Buffer.from(text+'\n');let offset=0
    while(offset<bytes.length){const written=await output.write(bytes,offset,bytes.length-offset,offset);if(written.bytesWritten<=0)throw Error('RESULT_WRITE_FAILED');offset+=written.bytesWritten}
    await output.truncate(bytes.length);await output.sync()
  }finally{await output.close()}
  await scanArtifacts({root:resultRoot,paths,knownSecrets})
  console.log(text)
  if(result.status!=='PASS')process.exitCode=1
}
main().catch(()=>{console.log('{"phase":"preflight","status":"BLOCKED","code":"LOCAL_PREFLIGHT_REFUSED"}');process.exitCode=1})
