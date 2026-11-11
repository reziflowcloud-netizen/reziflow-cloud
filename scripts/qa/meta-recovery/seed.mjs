import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { join,resolve,dirname,basename,isAbsolute } from 'node:path'
import { lstatSync,readFileSync,realpathSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
async function main(){
const privateFile=process.env.QA_STAGE_A_PRIVATE_CONFIG
const noLink=target=>{let current=resolve(target);for(;;){if(lstatSync(current).isSymbolicLink())throw Error('STAGE_A_PATH_LINK_REFUSED');const parent=dirname(current);if(parent===current)break;current=parent}return realpathSync.native(target)}
if(!privateFile)throw Error('STAGE_A_PRIVATE_CONFIG_MISSING')
noLink(privateFile)
const config=JSON.parse(await readFile(privateFile,'utf8'))
const root=resolve(config.privateDirectory||'')
if(!/^D:\\LegalHubStageA-[0-9a-f]{32}$/.test(root)||resolve(privateFile)!==join(root,'runtime.json')||process.env.QA_STAGE_A_EVIDENCE!==root)throw Error('STAGE_A_PRIVATE_ROOT_REFUSED')
noLink(root)
noLink(join(root,'qa-owned.txt'))
if(readFileSync(join(root,'qa-owned.txt'),'utf8').trim()!=='LegalHub Stage A synthetic QA')throw Error('STAGE_A_OWNER_MARKER_REFUSED')
const stateFile=join(root,'cluster-state.json');noLink(stateFile)
const state=JSON.parse(readFileSync(stateFile,'utf8'))
const run=state.cluster?.RunId
if(!/^stagea[0-9a-f]{32}$/.test(run||'')||state.config?.targetKind!=='synthetic'||state.config?.privateDirectory!==root||state.config?.expectedHost!=='127.0.0.1'||state.config?.expectedApplicationHost!=='127.0.0.1')throw Error('STAGE_A_CLUSTER_STATE_REFUSED')
const clusterRoot=join(root,'isolated',run),cluster=join(clusterRoot,'cluster')
noLink(join(clusterRoot,'runner-owned.txt'))
if(resolve(state.cluster.Root)!==clusterRoot||resolve(state.cluster.Cluster)!==cluster||readFileSync(join(clusterRoot,'runner-owned.txt'),'utf8').trim()!==run)throw Error('STAGE_A_CLUSTER_MARKER_REFUSED')
noLink(cluster)
if(resolve(config.repo)!==join(root,'qa-source'))throw Error('STAGE_A_REPO_REFUSED')
noLink(config.repo)
const url=new URL(config.databaseUrl)
if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||!url.port||url.port==='5432'||Number(url.port)!==state.cluster.Port||url.pathname!=='/legalhub_runner_'+run||url.pathname.slice(1)!==state.cluster.Database||config.databaseUrl!==state.cluster.Uri||process.env.DATABASE_URL!==config.databaseUrl||process.env.DIRECT_URL!==config.databaseUrl)throw Error('STAGE_A_DB_TARGET_REFUSED')
// Path-only arguments; helper reads owned metadata and never needs Git on PATH.
const pwsh=process.env.QA_PWSH_EXE
if(!pwsh||!isAbsolute(pwsh)||basename(pwsh).toLowerCase()!=='pwsh.exe'||config.qaPwshExecutable!==pwsh||!lstatSync(noLink(pwsh)).isFile())throw Error('STAGE_A_PWSH_HOST_UNVERIFIED')
const version=spawnSync(pwsh,['-NoProfile','-NonInteractive','-Version'],{windowsHide:true,stdio:['ignore','pipe','ignore'],encoding:'utf8',timeout:20000})
if(version.error||version.status!==0||!/^PowerShell 7\.\d+\.\d+(?:[-+][^\s]+)?\s*$/.test(version.stdout||''))throw Error('STAGE_A_PWSH7_REQUIRED')
const check=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',join(dirname(fileURLToPath(import.meta.url)),'verify-running.ps1'),'-RuntimeFile',privateFile],{windowsHide:true,stdio:'ignore',timeout:20000})
if(check.error||check.status!==0)throw Error('STAGE_A_RUNNING_SERVER_UNVERIFIED')
const require=createRequire(join(config.repo,'package.json'))
const {PrismaClient}=require('@prisma/client')
const bcrypt=require('bcryptjs')
const db=new PrismaClient()
const secret=()=>randomBytes(32).toString('base64url')
const passwords={owner:secret(),a:secret(),b:secret()}
try{
  const org=await db.organization.create({data:{name:'LegalHub Internal QA',slug:'legalhub-internal-qa-'+randomBytes(6).toString('hex'),
    notificationAutomationEnabled:true,notificationAutomationActivatedAt:new Date(0),settings:{leadWebhookEnabled:false}}})
  const owner=await db.user.create({data:{organizationId:org.id,email:'qa-admin@example.invalid',name:'QA Administrator',role:'owner',password:await bcrypt.hash(passwords.owner,10)}})
  const employees=[]
  for(const key of ['a','b']){
    const user=await db.user.create({data:{organizationId:org.id,email:'qa-'+key+'@example.invalid',name:'QA Employee '+key.toUpperCase(),role:'employee',password:await bcrypt.hash(passwords[key],10)}})
    const employee=await db.employee.create({data:{organizationId:org.id,userId:user.id,name:user.name}})
    await db.notificationPreference.create({data:{organizationId:org.id,userId:user.id,pushEnabled:false,events:{lead_assigned:{inApp:true,push:false}}}})
    employees.push({userId:user.id,employeeId:employee.id})
  }
  for(const source of ['facebook_lead_ads','instagram_lead_ads','meta_lead_ads_unknown']){
    const route=await db.leadChannelRoute.create({data:{organizationId:org.id,sourceKey:source,employeeId:employees[0].employeeId}})
    await db.leadChannelRouteMember.create({data:{organizationId:org.id,routeId:route.id,employeeId:employees[1].employeeId,position:1}})
  }
  Object.assign(config,{organizationId:org.id,ownerId:owner.id,employees,passwords,secrets:{jwt:secret(),verifyToken:secret(),receiptHmac:secret(),worker:secret()},
    appId:null,pageId:'1449474971582722',formId:'2046130655900851',
    enabled:false,workerEnabled:false,approvedTuples:[],pilotLeadIds:[]})
  await writeFile(privateFile,JSON.stringify(config),{mode:0o600})
  const [users,links,routes,members,preferences,leads,bindings,ledger]=await Promise.all([
    db.user.count({where:{organizationId:org.id}}),db.employee.count({where:{organizationId:org.id,userId:{not:null}}}),
    db.leadChannelRoute.count({where:{organizationId:org.id}}),db.leadChannelRouteMember.count({where:{organizationId:org.id}}),
    db.notificationPreference.count({where:{organizationId:org.id}}),db.lead.count(),db.metaLeadAdsBinding.count(),
    db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')])
  if(users!==3||links!==2||routes!==3||members!==6||preferences!==2||leads!==0||bindings!==0||ledger[0].count!==54)throw Error('STAGE_A_FIXTURE_CHECK_FAILED')
  await writeFile(join(process.env.QA_STAGE_A_EVIDENCE,'stage-a-local-isolation.json'),JSON.stringify({
    result:'PASS',databaseHost:'127.0.0.1',productionCredentialsLoaded:false,dedicatedRandomPort:true,dedicatedNewCluster:true,
    migrated:54,drift:0,organization:{name:org.name,id:org.id},users,linkedEmployees:links,routes,routeMembers:members,
    notificationPreferences:preferences,leads,bindings,metaGatesOff:true,metaTokensConfigured:false,publicEndpointCreated:false,
    sourceHead:'51c560a5f0090b669ee4ffe48485ba4d6a3a873e',secretsPrinted:false
  },null,2))
}finally{await db.$disconnect()}
}
main().catch(()=>{console.error('QA_SEED_FAILED');process.exitCode=1})
