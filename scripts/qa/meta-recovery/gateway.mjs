import {createServer} from 'node:http'
import {createHmac,timingSafeEqual} from 'node:crypto'
import {readFileSync,existsSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const dashboardFixture=event=>event?.object==='page'&&event.entry?.length===1&&['0','444444444444'].includes(String(event.entry[0].id))&&event.entry[0].changes?.length===1&&event.entry[0].changes[0].field==='leadgen'&&['page_id','form_id','leadgen_id'].every(key=>String(event.entry[0].changes[0].value?.[key])==='444444444444')&&!Object.hasOwn(event.entry[0].changes[0].value,'field_data')
// The real profile never generates or replays provider events and never stores request bodies.
export function realGateway(c,secret){
 if(typeof c.appId!=='string'||!/^[1-9][0-9]{5,30}$/.test(c.appId)||c.appId==='1160353550276176'||c.appId!==c.approvedMetaAppId||c.pageId!=='1449474971582722'||typeof c.formId!=='string'||!/^[1-9][0-9]{5,30}$/.test(c.formId))throw Error('QA_TARGET_REFUSED')
 if(!Number.isInteger(c.appPort)||c.appPort<1024||c.appPort>65535||typeof secret!=='string'||secret.length<24||typeof c.secrets?.verifyToken!=='string'||c.secrets.verifyToken.length<24)throw Error('QA_GATE_CONFIGURATION_REFUSED')
 const audit={requests:0,challenge200:0,postReceived:0,dashboardSamples:0,hmacValid:0,qaTupleValid:0,forwarded:0,statuses:{},upstreamStatuses:{}}
 const auditFile=join(c.privateDirectory,'real-http-audit.json'),realFile=join(c.privateDirectory,'meta-real-private.json')
 let closed=false,windowStart=Date.now(),windowCount=0,active=0
 const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
 const server=createServer(async(req,res)=>{
  audit.requests++;active++;let finished=false
  const record=()=>{if(finished)return;finished=true;active--;audit.statuses[res.statusCode]=(audit.statuses[res.statusCode]||0)+1;writeFileSync(auditFile,JSON.stringify(audit),{mode:0o600})}
  res.once('finish',record);res.once('close',record)
  const reply=(status,body='')=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(body)}
  try{
   if(closed||existsSync(c.stopFile))return reply(503)
   if(Date.now()-windowStart>60000){windowStart=Date.now();windowCount=0}
   if(++windowCount>60||active>8)return reply(429)
   const url=new URL(req.url,'http://127.0.0.1')
   if(url.pathname!=='/api/webhooks/meta/lead-ads')return reply(404)
   if(req.method==='GET'){
    const challenge=url.searchParams.get('hub.challenge')||''
    if(url.searchParams.get('hub.mode')!=='subscribe'||!equal(url.searchParams.get('hub.verify_token')||'',c.secrets.verifyToken)||!/^[-a-zA-Z0-9_]{1,200}$/.test(challenge))return reply(403)
    audit.challenge200++;res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end(challenge)
   }
   if(req.method!=='POST')return reply(405)
   audit.postReceived++
   if(Number(req.headers['content-length'])>65536)return reply(413)
   let bytes=0;const chunks=[]
   for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)return reply(413);chunks.push(chunk)}
   const raw=Buffer.concat(chunks),signature=req.headers['x-hub-signature-256'],expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex')
   if(!equal(signature,expected))return reply(401)
   audit.hmacValid++
   let event;try{event=JSON.parse(raw.toString('utf8'))}catch{return reply(400)}
   const sampleState=JSON.parse(readFileSync(realFile,'utf8'))
   if(dashboardFixture(event) && sampleState.dashboardSample && Date.parse(sampleState.dashboardSample.expiresAt)>Date.now() && Date.parse(sampleState.dashboardSample.expiresAt)-Date.now()<=60000 && sampleState.dashboardSample.expectedCanonical===canonical(event)){
    sampleState.dashboardSample=null;writeFileSync(realFile,JSON.stringify(sampleState),{mode:0o600});audit.dashboardSamples++;return reply(200,'{"sampleOnly":true,"crmProcessing":false}')
   }
   if(event?.object!=='page'||!Array.isArray(event.entry)||!event.entry.length)return reply(400)
   const ids=[]
   for(const entry of event.entry){
    if(String(entry?.id)!==c.pageId||!Array.isArray(entry.changes)||!entry.changes.length)return reply(403)
    for(const change of entry.changes){const v=change?.value
     if(change?.field!=='leadgen'||String(v?.form_id)!==c.formId||(v.page_id!==undefined&&String(v.page_id)!==c.pageId)||!/^\d{1,31}$/.test(String(v?.leadgen_id||'')))return reply(403)
     ids.push(String(v.leadgen_id))
    }
   }
   audit.qaTupleValid++
   const real=JSON.parse(readFileSync(realFile,'utf8'))
   if(real.release!==true||!real.approvedLeadId||!ids.every(id=>id===real.approvedLeadId)){res.setHeader('Retry-After','30');return reply(503,'{"qaGate":"awaiting_exact_test_id_approval"}')}
   const leadAge=Date.now()-Date.parse(real.leadCreatedAt)
   if(!Number.isFinite(leadAge)||leadAge<0||leadAge>600000)return reply(503)
   const upstream=await fetch('http://127.0.0.1:'+c.appPort+'/api/webhooks/meta/lead-ads',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Hub-Signature-256':signature},body:raw,signal:AbortSignal.timeout(8000)})
   audit.forwarded++;audit.upstreamStatuses[upstream.status]=(audit.upstreamStatuses[upstream.status]||0)+1
   await upstream.body?.cancel();return reply(upstream.status,upstream.ok?'{"accepted":true}':'{}')
  }catch{return reply(503)}
 })
 server.headersTimeout=5000;server.requestTimeout=10000;server.timeout=10000;server.maxHeadersCount=40
 server.on('clientError',(_e,s)=>s.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'))
 server.audit=audit;server.seal=()=>{closed=true;server.closeAllConnections();server.close();writeFileSync(auditFile,JSON.stringify(audit),{mode:0o600})}
 return server
}
