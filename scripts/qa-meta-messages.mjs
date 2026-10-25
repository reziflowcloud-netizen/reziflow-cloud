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
const digest=(await import('./actualization-source-evidence.cjs')).default.digest
const report={source:{srcDigest:digest('src'),copiedSrcDigest:digest('work/meta-app/src'),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},checks:[]}
const run=async(name,fn)=>{await fn(); report.checks.push(name); console.log('PASS',name)}
const password='Synthetic-only-meta-qa-2026', hash=await bcrypt.hash(password,10)
const org=await db.organization.create({data:{name:'Synthetic Meta QA',slug:'meta-qa-'+suffix,metaMessageActivatedAt:new Date(Date.now()-120000),settings:{facebookMessagesEnabled:true,facebookLeadPageAccessToken:'synthetic-token',instagramMessagesPageAccessToken:'synthetic-token'}}})
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
async function waitLock(fragment,minimum=1){const until=Date.now()+15000;while(Date.now()<until){const r=await db.$queryRawUnsafe(`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1`,'%'+fragment+'%');if(r.length>=minimum)return;await new Promise(resolve=>setTimeout(resolve,20))}throw Error('DB barrier did not observe '+fragment)}
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
  assert.equal(await db.leadMessage.count({where:{organizationId:org.id,liveReceipt:{not:null},leadId:lead.id}}),3);assert.equal(await counts(s,lead.id),3)
 })
 await run('IG bursts, provider timestamps out of order, fallback for both admins',async()=>{
  await webhook('instagram',[event('ig-user','ig-first',{timestamp:Date.now()-1000}),event('ig-user','ig-later',{timestamp:Date.now()-2000})]);assert.equal(await counts(a,ig.id),2);assert.equal((await poll(a)).unread[0].leadId,ig.id);assert.equal((await poll(b)).unread[0].leadId,ig.id)
 })
 await run('empty snapshot never acknowledges first future event',async()=>{assert.equal((await ack(a,ig.id,empty.token)).status(),200);assert.equal(await counts(a,ig.id),2)})
 await run('authorized list badges independent from recipient-only global alerts',async()=>{assert.equal(await counts(a,lead.id),3);assert.equal((await poll(a)).unread.some(x=>x.leadId===lead.id),false);assert.equal((await poll(s)).unread.some(x=>x.leadId===lead.id),true);assert.equal(await counts(s,ig.id),undefined)})
 await run('outgoing echo and manual incoming are ineligible',async()=>{
  await webhook('facebook',[event('qa-page','fb-echo',{recipient:{id:'fb-user'},message:{mid:'fb-echo',text:'Synthetic echo',is_echo:true}})])
  assert.equal((await a.post(`/api/leads/${lead.id}/messages`,{data:{text:'Synthetic manual',direction:'incoming',channel:'facebook'}})).status(),200)
  assert.equal(await counts(a,lead.id),3)
 })
 await run('postback-only events persist without unread receipt',async()=>{const before=await counts(a,ig.id);await webhook('instagram',[{sender:{id:'ig-user'},recipient:{id:'qa-page'},timestamp:Date.now(),postback:{title:'Synthetic menu',payload:'synthetic-postback'}}]);const row=await db.leadMessage.findFirst({where:{organizationId:org.id,externalMessageId:'synthetic-postback'}});assert.ok(row);assert.equal(row.liveReceipt,null);assert.equal(await counts(a,ig.id),before)})
 await run('IG attachment and real send entry point use mocked provider; outgoing remains ineligible',async()=>{
  const target=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic attachment send',source:'instagram',messengerId:'instagram:attachment-send'}})
  await webhook('instagram',[event('attachment-send','ig-attachment',{message:{mid:'ig-attachment',attachments:[{type:'image',payload:{url:'https://example.invalid/synthetic.jpg'}}]}})])
  assert.equal(await counts(a,target.id),1)
  const sent=await a.post(`/api/leads/${target.id}/messages`,{data:{direction:'outgoing',senderType:'employee',channel:'instagram',text:'Synthetic mocked send only'}});assert.equal(sent.status(),200,await sent.text());const outgoing=await sent.json();assert.equal(outgoing.liveReceipt,null);assert.equal(await counts(a,target.id),1)
  await db.lead.delete({where:{id:target.id}})
 })
 await run('historical sync and replay of synced message stay ineligible',async()=>{
  await webhook('instagram',[{sender:{id:'ig-user'},recipient:{id:'qa-page'},read:{watermark:Date.now()}}]);const history=await db.leadMessage.findFirst({where:{organizationId:org.id,externalMessageId:'synced-ig-user'}});assert.ok(history);assert.equal(history.liveReceipt,null)
  await webhook('instagram',[event('ig-user','synced-ig-user',{timestamp:Date.UTC(2020,0,1)})]);assert.equal(await counts(a,ig.id),2)
 })
 await run('fresh sync-first promotion once after earlier read; outgoing higher ID cannot swallow unseen receipt',async()=>{
  const synced=await db.leadMessage.create({data:{organizationId:org.id,leadId:ig.id,externalMessageId:'fresh-synced',channel:'instagram',text:'Synthetic fresh sync first',payload:{conversationSync:true},sentAt:new Date()}})
  const higher=await db.leadMessage.create({data:{organizationId:org.id,leadId:ig.id,channel:'instagram',direction:'outgoing',text:'Synthetic higher outgoing'}})
  assert.ok(higher.id>synced.id)
  const earlier=await snapshot(a,ig.id)
  const baseline=await counts(a,ig.id)
  const seqBefore=(await db.$queryRaw`SELECT last_value FROM "MetaLiveReceiptSequence"`)[0].last_value
  await Promise.all([webhook('instagram',[event('ig-user','fresh-synced')]),webhook('instagram',[event('ig-user','fresh-synced')])])
  const promoted=await db.leadMessage.findUnique({where:{id:synced.id}});assert.ok(promoted.liveReceipt);assert.equal(Number((await db.$queryRaw`SELECT last_value FROM "MetaLiveReceiptSequence"`)[0].last_value)-Number(seqBefore),1)
  await ack(a,ig.id,earlier.token);assert.equal(await counts(a,ig.id),1)
  await ack(a,ig.id,(await snapshot(a,ig.id)).token);assert.equal(await counts(a,ig.id),0)
  // Restore one direct-first unread for subsequent per-user independence group.
  await webhook('instagram',[event('ig-user','after-promotion-a'),event('ig-user','after-promotion-b')])
 })
 const snap=await snapshot(a,ig.id)
 await run('per-user read persistence across sessions and devices; stale ACK monotonic',async()=>{
  assert.equal((await ack(a,ig.id,snap.token)).status(),200);assert.equal(await counts(a,ig.id),0);assert.equal(await counts(b,ig.id),5);const second=await context(owner);assert.equal(await counts(second,ig.id),0)
  await webhook('instagram',[event('ig-user','ig-new')]);assert.equal((await ack(a,ig.id,empty.token)).status(),200);assert.equal(await counts(a,ig.id),1)
 })
 await run('tampered, foreign user/tenant/lead snapshot and auth-cookie substitution rejected',async()=>{
  for(const [c,id,t] of [[a,ig.id,snap.token.slice(0,-6)+'badbad'],[b,ig.id,snap.token],[a,lead.id,snap.token]]) assert.equal((await ack(c,id,t)).status(),400)
  assert.equal((await ack(f,ig.id,snap.token)).status(),404);assert.equal((await ack(s,ig.id,snap.token)).status(),404)
  const forged=await request.newContext({baseURL:origin,extraHTTPHeaders:{Cookie:'auth-token='+snap.token}});assert.equal((await forged.get('/api/notifications/meta-messages')).status(),401);await forged.dispose()
 })
 await run('latest read retains actionable older fallback unread without cursor regression',async()=>{
  const older=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic older fallback',source:'instagram',messengerId:'instagram:older-fallback'}})
  await webhook('instagram',[event('older-fallback','older-fallback-event')])
  await webhook('instagram',[event('ig-user','newest-after-older')])
  const latest=await poll(b);assert.equal(latest.latest.leadId,ig.id);assert.ok(latest.unread.some(x=>x.leadId===older.id))
  assert.equal((await ack(b,ig.id,(await snapshot(b,ig.id)).token)).status(),200)
  const remaining=await poll(b);assert.equal(remaining.latest.id,latest.latest.id);assert.ok(remaining.unread.some(x=>x.leadId===older.id&&x.count===1));assert.equal(remaining.unread.some(x=>x.leadId===ig.id),false)
  for(const c of [a,b])await ack(c,older.id,(await snapshot(c,older.id)).token)
  await db.lead.delete({where:{id:older.id}})
 })
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
  const one=db.$transaction(async tx=>{await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',org.id);const row=await tx.leadMessage.create({data:{organizationId:org.id,leadId:ig.id,channel:'instagram',text:'Synthetic held',liveReceipt:(await tx.$queryRaw`SELECT nextval('"MetaLiveReceiptSequence"')::int AS value`)[0].value,externalMessageId:'ig-held'}});firstId=row.id;inserted();await gate},{timeout:20000});await ready
  const two=webhook('instagram',[event('ig-user','ig-ordered')]);await waitLock('Organization');const middle=await snapshot(a,ig.id);assert.equal(middle.messages.some(x=>x.id===firstId),false);unblock();await one;await two
  const second=await db.leadMessage.findFirst({where:{organizationId:org.id,externalMessageId:'ig-ordered'}});assert.ok(second.id>firstId);await ack(a,ig.id,middle.token);assert.equal(await counts(a,ig.id),2)
 })
 await run('visual revision covers accessible nonrecipient arrivals and reads outside preview',async()=>{
  const before=await poll(a);await webhook('facebook',[event('fb-user','nonrecipient-visual')]);const after=await poll(a);assert.equal(after.latest.id,before.latest.id);assert.notEqual(after.visualRevision,before.visualRevision)
  const tab=await context(owner);await ack(tab,lead.id,(await snapshot(tab,lead.id)).token);const read=await poll(a);assert.equal(read.latest.id,after.latest.id);assert.notEqual(read.visualRevision,after.visualRevision)
 })
 await run('unread count SQL rechecks assignment changed after earlier Lead-list query',async()=>{
  await held('LOCK TABLE "LeadMessage" IN ACCESS EXCLUSIVE MODE',[],async release=>{
   const pending=list(s);await waitLock('SELECT l.id AS "leadId"');await db.lead.update({where:{id:lead.id},data:{assignedToId:other.id,employeeId:null}});release();const rows=await pending;assert.equal(rows.find(x=>x.id===lead.id)?.metaUnreadCount,0)
  });await db.lead.update({where:{id:lead.id},data:{assignedToId:staff.id,employeeId:employee.id}})
 })
 await run('ACK queued behind actual role/restriction API change rejects stale snapshot',async()=>{
  const token=(await snapshot(a,ig.id)).token
  await held('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',[org.id],async release=>{
   const change=b.patch('/api/users/'+owner.id,{data:{role:'employee',restrictedAccess:true}});await waitLock('Organization');const pending=ack(a,ig.id,token);release();assert.equal((await change).status(),200);assert.equal((await pending).status(),404)
  });assert.equal((await b.patch('/api/users/'+owner.id,{data:{role:'owner',restrictedAccess:false}})).status(),200)
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
 await run('actual Lead reassignment, ACK and identity three-way barrier completes without inversion',async()=>{
  await db.lead.update({where:{id:lead.id},data:{assignedToId:staff.id,employeeId:employee.id}})
  const token=(await snapshot(s,lead.id)).token;await get(a,'/api/leads/'+lead.id)
  await held('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',[org.id],async release=>{
   const change=b.patch('/api/leads/'+lead.id,{data:{assignedToId:other.id}});await waitLock('Organization')
   const pending=ack(s,lead.id,token);await waitLock('Organization',2)
   const identity=b.patch('/api/users/'+staff.id,{data:{role:'employee',restrictedAccess:false}});await waitLock('Organization',3)
   release();assert.deepEqual([(await change).status(),(await pending).status(),(await identity).status()],[200,404,200])
  });assert.equal((await b.patch('/api/users/'+staff.id,{data:{restrictedAccess:true}})).status(),200)
 })
 await run('actual Lead DELETE queued before ACK returns safe not-found after cascade',async()=>{
  const doomed=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic API delete race'}}),token=(await snapshot(a,doomed.id)).token;await get(a,'/api/leads/'+doomed.id)
  await held('SELECT id FROM "Lead" WHERE id=$1 FOR UPDATE',[doomed.id],async release=>{
   const deleting=a.delete('/api/leads/'+doomed.id);await waitLock('DELETE FROM');const pending=ack(a,doomed.id,token);release();assert.equal((await deleting).status(),200);assert.equal((await pending).status(),404)
  })
 })
 await run('unread list includes every match beyond five-item alert preview',async()=>{
  for(let i=0;i<31;i++){const l=await db.lead.create({data:{organizationId:org.id,fullName:'Synthetic page '+i}});await db.leadMessage.create({data:{organizationId:org.id,leadId:l.id,channel:'facebook',text:'Synthetic bounded preview fixture',liveReceipt:(await db.$queryRaw`SELECT nextval('"MetaLiveReceiptSequence"')::int AS value`)[0].value}})}
  const p=await poll(a);assert.equal(p.unread.length,5);assert.equal((await list(a)).filter(x=>x.metaUnreadCount>0).length,31)
 })
 const deadlocks=(await db.$queryRaw`SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()`)[0].deadlocks;report.deadlocks=Number(deadlocks);assert.equal(Number(deadlocks),0)
 assert.equal(digest('src'),report.source.srcDigest);assert.equal(digest('work/meta-app/src'),report.source.srcDigest)
 await fs.mkdir('docs/qa/meta-messages',{recursive:true});await fs.writeFile('docs/qa/meta-messages/integration.json',JSON.stringify(report,null,2)+'\n')
 await fs.writeFile('work/meta-fixtures.json',JSON.stringify({org,owner,admin,staff,other,foreign,lead,ig,password},null,2))
 console.log('TOTAL',report.checks.length)
} finally { for(const c of contexts)await c.dispose();await db.$disconnect() }
