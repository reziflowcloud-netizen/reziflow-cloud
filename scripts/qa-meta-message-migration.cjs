// Populated exact pre-feature schema -> final additive migration. Isolated schema
// in the disposable loopback database; never accepts a URL/credentials from env.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict')
const {PrismaClient}=require('@prisma/client'),root=path.resolve(__dirname,'..'),dir=path.join(root,'work/meta-migration'),prisma=path.join(root,'node_modules/prisma/build/index.js')
const url='postgresql://actualization_qa:disposable_only@127.0.0.1:55435/actualization_qa?schema=meta_expand'
const db=new PrismaClient({datasources:{db:{url}}}),env={DATABASE_URL:url,NEXT_TELEMETRY_DISABLED:'1'}
for(const key of ['PATH','HOME','TMPDIR','NODE_EXTRA_CA_CERTS'])if(process.env[key])env[key]=process.env[key]
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),'{}')
function copy(schema){fs.rmSync(path.join(dir,'prisma'),{recursive:true,force:true});fs.cpSync(schema,path.join(dir,'prisma'),{recursive:true})}
function migrate(){const r=cp.spawnSync(process.execPath,[prisma,'migrate','deploy','--schema',path.join(dir,'prisma/schema.prisma')],{cwd:dir,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);return r.stdout}
;(async()=>{try{
 await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS meta_expand CASCADE');await db.$executeRawUnsafe('CREATE SCHEMA meta_expand')
 // Exact old main was previously extracted with git archive, no env files.
 copy(path.join(root,'work/meta-old/prisma'));migrate()
 const before=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');assert.equal(before[0].count,52)
 await db.$executeRawUnsafe(`INSERT INTO "Organization" (id,name,slug,"updatedAt") VALUES ('expand-org','Synthetic legacy expand','synthetic-legacy-expand',now())`)
 await db.$executeRawUnsafe(`INSERT INTO "User" (id,email,password,name,"organizationId") VALUES (900001,'expand@example.invalid','synthetic-not-a-login-hash','Synthetic legacy user','expand-org')`)
 await db.$executeRawUnsafe(`INSERT INTO "Lead" (id,"organizationId","fullName","updatedAt") VALUES ('expand-lead','expand-org','Synthetic historical Lead',now())`)
 await db.$executeRawUnsafe(`INSERT INTO "LeadMessage" ("organizationId","leadId",text,channel,"sentAt") SELECT 'expand-org','expand-lead','Synthetic historical message','facebook',now()-interval '1 year' FROM generate_series(1,1000)`)
 await db.$executeRawUnsafe(`INSERT INTO "NotificationPreference" (id,"organizationId","userId",events,"updatedAt") VALUES ('expand-pref','expand-org',900001,'{}',now())`)
 const start=Date.now();copy(path.join(root,'prisma'));migrate();const finish=Date.now()
 const org=await db.organization.findUniqueOrThrow({where:{id:'expand-org'}});assert.ok(org.metaMessageActivatedAt.getTime()>=start-1000&&org.metaMessageActivatedAt.getTime()<=finish+1000)
 assert.equal(await db.leadMessage.count({where:{liveReceipt:{not:null}}}),0);assert.equal(await db.leadMessage.count(),1000)
 const pref=await db.notificationPreference.findUniqueOrThrow({where:{id:'expand-pref'}});assert.equal(pref.metaMessageSound,false);assert.equal(await db.metaMessageRead.count(),0)
 // Old-app column projection INSERT continues working and gets safe defaults.
 await db.$executeRawUnsafe(`INSERT INTO "LeadMessage" ("organizationId","leadId",text) VALUES ('expand-org','expand-lead','Synthetic old app insert')`)
 assert.equal((await db.leadMessage.findFirstOrThrow({where:{text:'Synthetic old app insert'}})).liveReceipt,null)
 const applied=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');assert.equal(applied[0].count,53)
 const report={base:'07d765e5ad16386c3fed2de806b0e25069dbe44b',oldMigrations:52,newMigrations:53,legacyMessages:1000,activatedMessages:0,soundDefaultOff:true,readRows:0,oldInsertNullReceipt:true,migrationFileSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'prisma/migrations/20261024160000_meta_message_reads/migration.sql'))).digest('hex')}
 fs.writeFileSync(path.join(root,'docs/qa/meta-messages/migration.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS populated pre-feature expand migration, no historical activation')
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
