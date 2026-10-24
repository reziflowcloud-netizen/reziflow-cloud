// Stable synthetic login for independent loopback UI review; never accepts a shared DB.
const assert=require('assert/strict'),{PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs');
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55434');assert.equal(url.pathname,'/decision_qa');
const db=new PrismaClient();
(async()=>{const org=await db.organization.upsert({where:{slug:'synthetic-decision-review'},update:{},create:{slug:'synthetic-decision-review',name:'Synthetic Decision Review'}});
const email='decision-review@example.invalid',password='Synthetic-review-only!';
const user=await db.user.upsert({where:{email},update:{},create:{email,password:await bcrypt.hash(password,10),name:'Synthetic Reviewer',role:'owner',organizationId:org.id}});assert.equal(user.organizationId,org.id);
let record=await db.case.findFirst({where:{organizationId:org.id}});if(!record){const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'Review'}});record=await db.case.create({data:{organizationId:org.id,clientId:client.id,assignedToId:user.id,caseNumber:'SYNTHETIC-REVIEW',mosNumber:'SYNTHETIC-MOS',predictedDecisionDate:new Date('2027-02-03')}})}
console.log('Synthetic review only: http://127.0.0.1:3107/login');console.log('Login: '+email+' / '+password);console.log('Case: http://127.0.0.1:3107/cases/'+record.id);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
