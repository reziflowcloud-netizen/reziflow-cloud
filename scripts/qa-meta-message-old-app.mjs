import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { request } from 'playwright'
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55435');assert.equal(url.pathname,'/actualization_qa')
const db=new PrismaClient(),ctx=await request.newContext({baseURL:'http://127.0.0.1:3130'}),f=JSON.parse(await fs.readFile('work/meta-fixtures.json','utf8')),checks=[]
try{
 assert.equal((await ctx.post('/api/auth/login',{data:{email:f.owner.email,password:f.password}})).status(),200);checks.push('old-main authenticated login')
 for(const path of ['/api/leads?view=list','/api/leads/'+f.ig.id+'/messages','/api/notifications/preferences','/api/notifications/meta-messages']){const r=await ctx.get(path);assert.equal(r.status(),200,await r.text());checks.push('old-main '+path)}
 const r=await ctx.post('/api/leads/'+f.ig.id+'/messages',{data:{text:'Synthetic OLD APP + NEW DB',direction:'incoming',channel:'manual'}});assert.equal(r.status(),200,await r.text());const row=await db.leadMessage.findFirst({where:{organizationId:f.org.id,text:'Synthetic OLD APP + NEW DB'}});assert.ok(row);assert.equal(row.liveReceipt,null);checks.push('old-main write defaults to null receipt')
 const preference=await ctx.get('/api/notifications/preferences').then(r=>r.json());assert.equal((await ctx.put('/api/notifications/preferences',{data:preference.preferences})).status(),200);checks.push('old-main preferences read/write additive compatibility')
 const migrations=await db.$queryRaw`SELECT count(*)::int AS applied FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;assert.equal(migrations[0].applied,53)
 await fs.writeFile('docs/qa/meta-messages/old-app-new-db.json',JSON.stringify({oldSource:'07d765e5ad16386c3fed2de806b0e25069dbe44b',migrations:53,checks},null,2)+'\n');console.log('PASS OLD APP + NEW DB',checks.length)
}finally{await ctx.dispose();await db.$disconnect()}
