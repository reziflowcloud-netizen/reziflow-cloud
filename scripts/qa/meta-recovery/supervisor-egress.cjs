// This preload narrows Next's fetch path; it is not a machine-wide firewall.
// It never manufactures Graph data or logs request/response bodies or URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const refuse=()=>{throw Error('QA_EGRESS_BLOCKED')}
function allowedRequest(input,options,state,now,environment){
 try{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  const method=String(options?.method||input?.method||'GET').toUpperCase()
  const age=now-Date.parse(state.leadCreatedAt)
  const provenanceAge=now-Date.parse(state.verifiedAt)
  const headers=new Headers(options?.headers||input?.headers)
  const token=environment['META_LEAD_ADS_PAGE_TOKEN_1449474971582722']
  if(state.appId!=='2523488421395251'||state.pageId!=='1449474971582722'||state.formId!=='2046130655900851'||state.release!==true||!/^[1-9][0-9]{5,30}$/.test(state.approvedLeadId||'')||!Number.isFinite(age)||age<0||age>600000||!Number.isFinite(provenanceAge)||provenanceAge<0||provenanceAge>3600000||environment.META_LEAD_ADS_ENABLED!=='true'||environment.META_LEAD_ADS_WORKER_ENABLED!=='true'||!/^v\d{1,2}\.\d{1,2}$/.test(environment.META_LEAD_ADS_GRAPH_VERSION||''))return false
  if(url.protocol!=='https:'||url.hostname!=='graph.facebook.com'||url.port||url.username||url.password||url.hash||url.pathname!=='/'+environment.META_LEAD_ADS_GRAPH_VERSION+'/'+state.approvedLeadId||method!=='GET'||options?.body||options?.redirect!=='error')return false
  if(typeof token!=='string'||token.length<32||headers.get('authorization')!=='Bearer '+token||state.tokenSha256!==crypto.createHash('sha256').update(token).digest('hex'))return false
  if(url.searchParams.get('fields')!=='id,form_id,platform,field_data,created_time'||url.searchParams.get('appsecret_proof')!==crypto.createHmac('sha256',environment.META_LEAD_ADS_APP_SECRET).update(token).digest('hex')||[...url.searchParams.keys()].length!==2)return false
  return true
 }catch{return false}
}
module.exports={allowedRequest}
if(process.env.QA_REAL_CONFIG){
 const file=process.env.QA_REAL_CONFIG
 if(!/^D:\\LegalHubStageA-[0-9a-f]{32}\\meta-real-private\.json$/.test(file))refuse()
 const native=global.fetch
 global.fetch=async function(input,options){
  let current=path.resolve(file)
  for(;;){if(fs.lstatSync(current).isSymbolicLink())refuse();const parent=path.dirname(current);if(parent===current)break;current=parent}
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.nlink!==1||stat.size>65536)refuse()
  const state=JSON.parse(fs.readFileSync(file,'utf8'))
  if(fs.existsSync(path.join(path.dirname(file),'STOP'))||!allowedRequest(input,options,state,Date.now(),process.env))refuse()
  return native(input,options)
 }
}else if(require.main===module)refuse()
