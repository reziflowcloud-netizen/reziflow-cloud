// Synthetic PostgreSQL + authenticated real APIs + mocked providers. Never reads env files.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { request } from 'playwright'
import bcrypt from 'bcryptjs'
const url = new URL(process.env.DATABASE_URL || '')
assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,'55435'); assert.equal(url.pathname,'/actualization_qa')
const db = new PrismaClient(), origin='http://127.0.0.1:3127', suffix=Date.now(), contexts=[]
const report={source:{head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},checks:[]}
const run=async(name,fn)=>{await fn(); report.checks.push(name); console.log('PASS',name)}
const password='Synthetic-only-meta-qa-2026', hash=await bcrypt.hash(password,10)
const org=await db.organization.create({data:{name:'Synthetic Meta QA',slug:'meta-qa-'+suffix,settings:{facebookMessagesEnabled:true,facebookLeadPageAccessToken:'synthetic-token',instagramMessagesPageAccessToken:'synthetic-token'}}})
// getLeadWebhookSettings uses the organization's existing nested integration key.
const settingsModule=await fs.readFile('src/lib/leadWebhook.ts','utf8')
const settingsKey=settingsModule.match(/const raw = .*?settings\?\.([A-Za-z]+)/)?.[1]
const mkUser=(name,role='employee',restrictedAccess=false,organizationId=org.id)=>db.user.create({data:{organizationId,email:`meta-${name}-${suffix}@example.invalid`,password:hash,name:'Synthetic '+name,role,restrictedAccess}})
const owner=await mkUser('owner','owner'), admin=await mkUser('admin','admin'), staff=await mkUser('staff','employee',true), other=await mkUser('other')
const employee=await db.employee.create({data:{organizationId:org.id,userId:staff.id,name:'Synthetic Responsible'}})
const foreign=await db.organization.create({data:{name:'Synthetic Foreign Meta QA',slug:'foreign-meta-'+suffix}})
const foreignUser=await mkUser('foreign','owner',false,foreign.id)
async function context(user){const c=await request.newContext({baseURL:origin});contexts.push(c);const r=await c.post('/api/auth/login',{data:{email:user.email,password}});assert.equal(r.status(),200);return c}
const a=await context(owner),b=await context(admin),s=await context(staff),f=await context(foreignUser)
const get=async(c,path)=>{const r=await c.get(path);assert.equal(r.status(),200,`${path}: ${r.status()} ${await r.text()}`);return r.json()}
const poll=c=>get(c,'/api/notifications/meta-messages')
const list=c=>get(c,'/api/leads?view=list')
const lead=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic FB',source:'facebook',messengerId:'facebook:fb-user',employeeId:employee.id,assignedToId:staff.id}})
const ig=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic IG',source:'instagram',messengerId:'instagram:ig-user'}})
async function webhook(channel,events){const body=JSON.stringify({object:channel==='instagram'?'instagram':'page',entry:[{id:'qa-page',messaging:events}]});const r=await a.post(`/api/webhooks/meta/messages/${org.slug}`,{headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256','synthetic-meta-qa-secret').update(body).digest('hex')},data:body});assert.equal(r.status(),200,await r.text());return r.json()}
const event=(sender,mid,extra={})=>({sender:{id:sender},recipient:{id:'qa-page'},timestamp:Date.now(),message:{mid,text:'Synthetic incoming'},...extra})
async function snapshot(c,id){const r=await c.get(`/api/leads/${id}/messages`);assert.equal(r.status(),200);return {token:r.headers()['x-meta-message-snapshot'],messages:await r.json()}}
const ack=(c,id,token)=>c.post(`/api/leads/${id}/messages/read`,{data:{snapshot:token}})
async function counts(c,id){return (await list(c)).find(x=>x.id===id)?.metaUnreadCount}
// Barrier confirms the competing request is waiting in PostgreSQL before release.
async function waitLock(fragment){const until=Date.now()+15000;while(Date.now()<until){const r=await db.$queryRawUnsafe(`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1`,'%'+fragment+'%');if(r.length)return;await new Promise(resolve=>setTimeout(resolve,20))}throw Error('DB barrier did not observe '+fragment)}
async function held(sql,params,fn){let release,ready;const gate=new Promise(r=>release=r),started=new Promise(r=>ready=r);const holding=db.$transaction(async tx=>{await tx.$queryRawUnsafe(sql,...params);ready();await gate},{timeout:20000});await started;try{return await fn(release)}finally{release();await holding}}
try {
 // Explicit synthetic integration settings; discover parser shape from source, never env.
 const rawKey=settingsModule.match(/const raw =[^\n]*?\.([a-zA-Z]+)\s*\|\|/)?.[1]
 console.log('Synthetic settings parser key',rawKey || settingsKey || 'inspect')
 await run('non-Meta tenant retains polling stop gate',async()=>assert.equal((await poll(f)).enabled,false))
 await run('empty first inbox, default sound OFF',async()=>{const p=await poll(a);assert.equal(p.enabled,true);assert.equal(p.latest,null);assert.equal(p.sound,false)})
 const empty=await snapshot(a,ig.id)
 await run('FB first, repeat, concurrent duplicate and attachment persisted once',async()=>{
  await webhook('facebook',[event('fb-user','fb-first')]); await webhook('facebook',[event('fb-user','fb-first')]);
  await Promise.all([webhook('facebook',[event('fb-user','fb-race')]),webhook('facebook',[event('fb-user','fb-race')])]);
  await webhook('facebook',[event('fb-user','fb-attachment',{message:{mid:'fb-attachment',attachments:[{type:'image',payload:{url:'https://example.invalid/synthetic.jpg'}}]}})])
  assert.equal(await db.leadMessage.count({where:{organizationId:org.id,liveIncoming:true,leadId:lead.id}}),3);assert.equal(await counts(s,lead.id),3)
 })
 await run('IG bursts, provider timestamps out of order, fallback for both admins',async()=>{
  await webhook('instagram',[event('ig-user','ig-first',{timestamp:Date.UTC(2030,0,1)}),event('ig-user','ig-later',{timestamp:Date.UTC(2000,0,1)})]);assert.equal(await counts(a,ig.id),2);assert.equal((await poll(a)).unread[0].leadId,ig.id);assert.equal((await poll(b)).unread[0].leadId,ig.id)
 })
 await run('empty snapshot never acknowledges first future event',async()=>{assert.equal((await ack(a,ig.id,empty.token)).status(),200);assert.equal(await counts(a,ig.id),2)})
 await run('authorized list badges independent from recipient-only global alerts',async()=>{assert.equal(await counts(a,lead.id),3);assert.equal((await poll(a)).unread.some(x=>x.leadId===lead.id),false);assert.equal((await poll(s)).unread.some(x=>x.leadId===lead.id),true);assert.equal(await counts(s,ig.id),undefined)})
 await run('outgoing echo and manual incoming are ineligible',async()=>{
  await webhook('facebook',[event('qa-page','fb-echo',{recipient:{id:'fb-user'},message:{mid:'fb-echo',text:'Synthetic echo',is_echo:true}})])
  assert.equal((await a.post(`/api/leads/${lead.id}/messages`,{data:{text:'Synthetic manual',direction:'incoming',channel:'facebook'}})).status(),200)
  assert.equal(await counts(a,lead.id),3)
 })
 await run('historical sync and replay of synced message stay ineligible',async()=>{
  await webhook('instagram',[{sender:{id:'ig-user'},recipient:{id:'qa-page'},read:{watermark:Date.now()}}]);const history=await db.leadMessage.findFirst({where:{organizationId:org.id,externalMessageId:'synced-ig-user'}});assert.ok(history);assert.equal(history.liveIncoming,false)
  await webhook('instagram',[event('ig-user','synced-ig-user')]);assert.equal(await counts(a,ig.id),2)
 })
 const snap=await snapshot(a,ig.id)
 await run('per-user read persistence across sessions and devices; stale ACK monotonic',async()=>{
  assert.equal((await ack(a,ig.id,snap.token)).status(),200);assert.equal(await counts(a,ig.id),0);assert.equal(await counts(b,ig.id),2);const second=await context(owner);assert.equal(await counts(second,ig.id),0)
  await webhook('instagram',[event('ig-user','ig-new')]);assert.equal((await ack(a,ig.id,empty.token)).status(),200);assert.equal(await counts(a,ig.id),1)
 })
 await run('tampered, foreign user/tenant/lead snapshot and auth-cookie substitution rejected',async()=>{
  for(const [c,id,t] of [[a,ig.id,snap.token.slice(0,-6)+'badbad'],[b,ig.id,snap.token],[a,lead.id,snap.token]]) assert.equal((await ack(c,id,t)).status(),400)
  assert.equal((await ack(f,ig.id,snap.token)).status(),404);assert.equal((await ack(s,ig.id,snap.token)).status(),404)
  const forged=await request.newContext({baseURL:origin,extraHTTPHeaders:{Cookie:'auth-token='+snap.token}});assert.equal((await forged.get('/api/notifications/meta-messages')).status(),401);await forged.dispose()
 })
 await run('latest read retains actionable older fallback unread without cursor regression',async()=>{const latest=await poll(b);await ack(b,ig.id,(await snapshot(b,ig.id)).token);const remaining=await poll(b);assert.equal(remaining.latest.id,latest.latest.id);assert.equal(remaining.unread.length,0)})
 await run('server persisted sound ON/OFF independent from push and org master',async()=>{
  const p=await get(a,'/api/notifications/preferences');for(const enabled of [true,false]){const r=await a.put('/api/notifications/preferences',{data:{...p.preferences,metaMessageSound:enabled}});assert.equal(r.status(),200,await r.text());assert.equal((await poll(a)).sound,enabled);assert.equal((await poll(await context(owner))).sound,enabled)}
 })
 await run('serialized eligible commit order barrier, invisible arrival ACK, duplicate race',async()=>{
  const before=await snapshot(a,ig.id);let firstId
  await held('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',[org.id],async release=>{
   const pending=webhook('instagram',[event('ig-user','ig-barrier')]);await waitLock('Organization');assert.equal((await snapshot(a,ig.id)).messages.some(x=>x.externalMessageId==='ig-barrier'),false);release();await pending
  })
  assert.equal((await ack(a,ig.id,before.token)).status(),200);assert.equal(await counts(a,ig.id),1)
  let unblock,inserted;const gate=new Promise(r=>unblock=r),ready=new Promise(r=>inserted=r)
  const one=db.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',org.id);const row=await tx.leadMessage.create({data:{organizationId:org.id,leadId:ig.id,channel:'instagram',text:'Synthetic held',liveIncoming:true,externalMessageId:'ig-held'}});firstId=row.id;inserted();await gate},{timeout:20000});await ready
  const two=webhook('instagram',[event('ig-user','ig-ordered')]);await waitLock('Organization');const middle=await snapshot(a,ig.id);assert.equal(middle.messages.some(x=>x.id===firstId),false);unblock();await one;await two
  const second=await db.leadMessage.findFirst({where:{organizationId:org.id,externalMessageId:'ig-ordered'}});assert.ok(second.id>firstId);await ack(a,ig.id,middle.token);assert.equal(await counts(a,ig.id),2)
 })
 await run('ACK waits leading Organization before User and rechecks revoked permissions',async()=>{
  const token=(await snapshot(s,lead.id)).token
  await held('SELECT id FROM "Organization" WHERE id=$1 FOR NO KEY UPDATE',[org.id],async release=>{
   const pending=ack(s,lead.id,token);await waitLock('Organization');await db.user.update({where:{id:staff.id},data:{restrictedAccess:true}});await db.lead.update({where:{id:lead.id},data:{assignedToId:other.id,employeeId:null}});release();assert.equal((await pending).status(),404)
  })
  assert.equal(await db.metaMessageRead.count({where:{userId:staff.id}}),0)
 })
 await run('ACK versus reassignment and deletion barriers return safe status without deadlocks',async()=>{
  const token=(await snapshot(a,ig.id)).token
  await held('SELECT id FROM "Lead" WHERE id=$1 FOR UPDATE',[ig.id],async release=>{const pending=ack(a,ig.id,token);await waitLock('Lead');release();assert.equal((await pending).status(),200)})
  const doomed=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic delete'}}),t=(await snapshot(a,doomed.id)).token
  let release,ready;const gate=new Promise(r=>release=r),started=new Promise(r=>ready=r)
  const deleting=db.$transaction(async tx=>{await tx.lead.delete({where:{id:doomed.id}});ready();await gate},{timeout:20000});await started;const pending=ack(a,doomed.id,t);await waitLock('Lead');release();await deleting;assert.equal((await pending).status(),404)
 })
 await run('unread list includes every match beyond five-item alert preview',async()=>{
  for(let i=0;i<31;i++){const l=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic page '+i}});await db.leadMessage.create({data:{organizationId:org.id,leadId:l.id,channel:'facebook',text:'Synthetic bounded preview fixture',liveIncoming:true}})}
  const p=await poll(a);assert.equal(p.unread.length,5);assert.equal((await list(a)).filter(x=>x.metaUnreadCount>0).length,32)
 })
 await fs.mkdir('docs/qa/meta-messages',{recursive:true});await fs.writeFile('docs/qa/meta-messages/integration.json',JSON.stringify(report,null,2)+'\n')
 await fs.writeFile('work/meta-fixtures.json',JSON.stringify({org,owner,admin,staff,other,foreign,lead,ig,password},null,2))
 console.log('TOTAL',report.checks.length)
} finally { for(const c of contexts)await c.dispose();await db.$disconnect() }
