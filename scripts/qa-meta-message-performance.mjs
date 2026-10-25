// Exact captured production-source SELECTs, synthetic loopback data only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { request } from 'playwright'
import bcrypt from 'bcryptjs'
import evidence from './actualization-source-evidence.cjs'
const u=new URL(process.env.DATABASE_URL||'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55435');assert.equal(u.pathname,'/actualization_qa')
const db=new PrismaClient(),origin='http://127.0.0.1:3127',slug='meta-performance-'+Date.now(),password='Synthetic-performance-only'
const org=await db.organization.create({data:{name:'Synthetic Meta Performance',slug,settings:{facebookMessagesEnabled:true}}}),user=await db.user.create({data:{organizationId:org.id,email:slug+'@example.invalid',name:'Synthetic performance owner',role:'owner',password:await bcrypt.hash(password,10)}})
const ctx=await request.newContext({baseURL:origin}),report={sourceDigest:evidence.digest('src'),fixture:{leads:100,historical:100000,readLive:10000,unreadLive:10},queries:[]}
const log='work/meta-query-log.jsonl',readlog=async()=>{try{return (await fs.readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x))}catch{return []}}
try{
 await db.$executeRaw`INSERT INTO "Lead" (id,"organizationId","fullName","updatedAt") SELECT ${slug}||'-'||i, ${org.id}, 'Synthetic history Lead '||i, now() FROM generate_series(1,100) i`
 await db.$executeRaw`INSERT INTO "LeadMessage" ("organizationId","leadId",text,channel,"sentAt") SELECT ${org.id}, ${slug}||'-'||l, 'Synthetic old history', 'facebook', now()-interval '1 year' FROM generate_series(1,100) l CROSS JOIN generate_series(1,1000) n`
 await db.$executeRaw`INSERT INTO "LeadMessage" ("organizationId","leadId",text,channel,"liveReceipt") SELECT ${org.id}, ${slug}||'-'||l, 'Synthetic read live history', 'facebook', nextval('"MetaLiveReceiptSequence"') FROM generate_series(1,100) l CROSS JOIN generate_series(1,100) n`
 await db.$executeRaw`INSERT INTO "MetaMessageRead" ("organizationId","userId","leadId","throughReceipt") SELECT ${org.id},${user.id},"leadId",max("liveReceipt") FROM "LeadMessage" WHERE "organizationId"=${org.id} AND "liveReceipt" IS NOT NULL GROUP BY "leadId"`
 await db.$executeRaw`INSERT INTO "LeadMessage" ("organizationId","leadId",text,channel,"liveReceipt") SELECT ${org.id},${slug}||'-'||l,'Synthetic unread tail','facebook',nextval('"MetaLiveReceiptSequence"') FROM generate_series(1,10) l`
 await db.$executeRawUnsafe('ANALYZE "LeadMessage"');await db.$executeRawUnsafe('ANALYZE "Lead"');await db.$executeRawUnsafe('ANALYZE "MetaMessageRead"')
 assert.equal((await ctx.post('/api/auth/login',{data:{email:user.email,password}})).status(),200)
 for(const path of ['/api/notifications/meta-messages','/api/leads?view=list']){
  const before=(await readlog()).length,r=await ctx.get(path);assert.equal(r.status(),200);const data=await r.json(),captured=(await readlog()).slice(before);assert.ok(captured.length>0,'QA SELECT logging required')
  if(path.includes('meta-messages')){assert.equal(data.unread[0].total,10);assert.equal(data.unread.length,5)}else assert.equal(data.filter(x=>x.metaUnreadCount).length,10)
  const item={path,selectCount:captured.length,plans:[]}
  for(const q of captured.filter(x=>x.query.includes('CROSS JOIN LATERAL')||x.query.includes('AS revision')||x.query.includes('ORDER BY m."liveReceipt" DESC LIMIT 1'))){
   const result=await db.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+q.query,...JSON.parse(q.params));const plan=result[0]['QUERY PLAN'][0];item.plans.push({query:q.query,parameters:JSON.parse(q.params),plan});
  }
  report.queries.push(item)
 }
 assert.equal(evidence.digest('src'),report.sourceDigest);await fs.mkdir('docs/qa/meta-messages',{recursive:true});await fs.writeFile('docs/qa/meta-messages/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.queries.map(q=>({path:q.path,selects:q.selectCount,plans:q.plans.map(p=>({ms:p.plan['Execution Time'],rows:p.plan.Plan['Actual Rows']}))}))))
}finally{await ctx.dispose();await db.$disconnect()}
