// Real app + synthetic fixtures only. Refuses any database outside the dedicated loopback target.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {PrismaClient}=require('@prisma/client'),{PrismaClient:OldClient}=require('../node_modules/.cache/decision-old-client');
const {chromium}=require('playwright'),bcrypt=require('bcryptjs');
const target=new URL(process.env.DATABASE_URL||'');assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55434');assert.equal(target.pathname,'/decision_qa');
const db=new PrismaClient(),old=new OldClient(),origin='http://127.0.0.1:3107',out=path.resolve('work/decision-evidence');
const report={checks:[],matrix:[],errors:[]};
async function main(){
 await fs.mkdir(out,{recursive:true});const suffix=Date.now(),password=require('crypto').randomBytes(24).toString('hex');
 const org=await db.organization.create({data:{name:'Synthetic Decision QA',slug:'decision-'+suffix}}),foreign=await db.organization.create({data:{name:'Synthetic Other Tenant',slug:'decision-other-'+suffix}});
 const hash=await bcrypt.hash(password,10);const makeUser=(name,organizationId,restrictedAccess=false)=>db.user.create({data:{name,email:`${name.toLowerCase()}-${suffix}@example.invalid`,password:hash,role:restrictedAccess?'employee':'owner',organizationId,restrictedAccess}});
 const owner=await makeUser('Owner',org.id),second=await makeUser('Colleague',org.id),restricted=await makeUser('Restricted',org.id,true),outsider=await makeUser('Other',foreign.id);
 const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'Decision'}});
 const record=await old.case.create({data:{organizationId:org.id,clientId:client.id,assignedToId:owner.id,caseNumber:'SYNTHETIC-QA',mosNumber:'LEGACY-MOS',mosSentByPost:true,predictedDecisionDate:new Date('2027-02-03'),notes:'Legacy retained'}});
 assert.equal((await db.case.findUniqueOrThrow({where:{id:record.id}})).decisionReceived,false);
 await old.case.update({where:{id:record.id},data:{notes:'Old Prisma writes on expanded DB'}});report.checks.push('old Prisma create/read/write on expanded DB; default false');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=500)report.errors.push('Unexpected HTTP '+r.status()+' '+new URL(r.url()).pathname)});
 const login=async(context,user)=>assert.equal((await context.request.post(origin+'/api/auth/login',{data:{email:user.email,password}})).status(),200);
 await login(ctx,owner);const endpoint=origin+'/api/cases/'+record.id,get=async()=>{const r=await ctx.request.get(endpoint);assert.equal(r.status(),200);return r.json()},patch=async(data,context=ctx)=>context.request.patch(endpoint,{headers:{'X-LegalHub-Case-Write':'versioned'},data});
 const snapshot=async()=>({tasks:await db.task.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}}),notifications:await db.notification.findMany({where:{organizationId:org.id},orderBy:{id:'asc'}})});
 await db.task.create({data:{organizationId:org.id,title:'Synthetic existing decision reminder',description:JSON.stringify({predictedDecision:{caseId:record.id}}),dueDate:new Date('2027-02-03')}});
 await db.notification.create({data:{organizationId:org.id,userId:owner.id,type:'case_due',title:'Synthetic existing notification',body:'Synthetic only',entityType:'case',entityId:record.id,deepLink:'/cases/'+record.id,dedupeKey:'synthetic-existing'}});
 const initial=await get(),before=await snapshot();
 assert.equal((await patch({decisionReceived:true,expectedUpdatedAt:initial.updatedAt})).status(),200);
 const checked=await get();assert.equal(checked.decisionReceived,true);assert.equal(checked.predictedDecisionDate,initial.predictedDecisionDate);assert.equal(checked.mosNumber,initial.mosNumber);assert.equal(checked.mosSentByPost,true);assert.equal(checked.status,initial.status);assert.deepEqual(await snapshot(),before);
 assert.equal((await patch({decisionReceived:false,expectedUpdatedAt:initial.updatedAt})).status(),409);assert.equal((await get()).decisionReceived,true);
 assert.equal((await patch({notes:'Unrelated patch',expectedUpdatedAt:checked.updatedAt})).status(),200);assert.equal((await get()).decisionReceived,true);
 for(const invalid of ['true','false',1,0,null,{},[]]){const baseline=await get();assert.equal((await patch({decisionReceived:invalid,expectedUpdatedAt:baseline.updatedAt})).status(),400);assert.equal((await get()).updatedAt,baseline.updatedAt)}
 report.checks.push('true persisted; omitted field preserves true; 7 invalid booleans rejected atomically; stale CAS 409; MOS/date/status unchanged; zero Task/notification changes');
 const colleague=await browser.newContext();await login(colleague,second);assert.equal((await (await colleague.request.get(endpoint)).json()).decisionReceived,true);await colleague.close();
 for(const user of [restricted,outsider]){const c=await browser.newContext();await login(c,user);assert.equal((await c.request.get(endpoint)).status(),404);assert.equal((await patch({decisionReceived:false,expectedUpdatedAt:(await get()).updatedAt},c)).status(),404);await c.close()}
 const anon=await browser.newContext();assert.ok([307,401].includes((await anon.request.patch(endpoint,{data:{decisionReceived:false},maxRedirects:0})).status()));await anon.close();report.checks.push('second authorized user visibility; restricted non-owner/foreign tenant GET+PATCH 404; anonymous PATCH rejected/redirected before handler');
 const labels={ru:'Решение получено',uk:'Децизія отримана',pl:'Decyzja otrzymana'};
 const open=async()=>{await page.goto(origin+'/cases/'+record.id);await page.locator('.case-detail-desktop-presentation:visible, [data-mobile-case-detail]:visible').first().waitFor();if(await page.locator('[data-mobile-case-detail]').isVisible()){const mos=page.locator('[data-section-key="case-mos"]');await mos.locator('button').first().click()}};
 let currentLang='ru';
 // Use :visible to distinguish the responsive presentations.
 const box=()=>page.locator('label:visible').filter({hasText:labels[currentLang]}).locator('input[type=checkbox]');
 const settle=async(expected)=>{await page.waitForFunction(async({id,expected})=>{const r=await fetch('/api/cases/'+id);return r.ok&&(await r.json()).decisionReceived===expected},{id:record.id,expected});await page.waitForTimeout(150)};
 for(const [width,lang,theme] of [[1440,'ru','light'],[1440,'uk','dark'],[1024,'pl','slate'],[390,'ru','dark'],[414,'uk','slate'],[430,'pl','light']]){
 currentLang=lang;await page.setViewportSize({width,height:1000});await page.addInitScript(({lang,theme})=>{localStorage.setItem('rezi_lang',lang);localStorage.setItem('rezi_theme',theme)},{lang,theme});await open();await box().waitFor();await page.waitForTimeout(600);
 const requests=[];const listener=req=>{if(req.method()==='PATCH'&&req.url()===endpoint)requests.push(req.postDataJSON())};page.on('request',listener);
 for(const value of [false,true]){
 await page.waitForFunction(({label,checked})=>Array.from(document.querySelectorAll('label')).some(e=>e.textContent.trim()===label&&e.getBoundingClientRect().width>0&&e.querySelector('input')?.checked===checked),{label:labels[currentLang],checked:!value});
 const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/api/cases/'));
 await box().setChecked(value);const saved=await response;assert.equal(saved.status(),200);assert.equal((await saved.json()).decisionReceived,value);assert.equal((await get()).decisionReceived,value);
 await page.reload();if(width<=768)await page.locator('[data-section-key="case-mos"] button').first().click();await box().waitFor();await page.waitForTimeout(600);assert.equal(await box().isChecked(),value)
 }
 await page.goto(origin+'/cases');await open();assert.equal(await box().isChecked(),true);
 for(const body of requests)assert.deepEqual(Object.keys(body).sort(),['decisionReceived','expectedUpdatedAt','reminderLanguage']);page.off('request',listener);
 assert.equal((await get()).predictedDecisionDate,initial.predictedDecisionDate);assert.deepEqual(await snapshot(),before);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);const size=await box().boundingBox();assert.equal(size.width,16);assert.equal(size.height,16);const dateBox=await box().evaluate(e=>{const r=e.parentElement.parentElement.querySelector('input[type=date]').getBoundingClientRect();return {y:r.y,height:r.height}});assert.ok(size.y>=dateBox.y+dateBox.height,'receipt checkbox must be below predicted date');
 const screenshot=`${width}-${lang}-${theme}.png`;await box().evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,screenshot),fullPage:false});report.matrix.push({width,lang,theme,autosaveTrueFalse:true,reloadReopen:true,minimalPatch:true,overflow,screenshot});console.log('PASS matrix',width,lang,theme)
 }
 currentLang='pl';await page.route('**/api/cases/'+record.id,r=>r.request().method()==='PATCH'?r.abort('failed'):r.continue());await box().uncheck();await page.waitForTimeout(1600);assert.equal(await box().isChecked(),false);assert.equal((await get()).decisionReceived,true);await page.unroute('**/api/cases/'+record.id);await page.locator('[data-mobile-case-detail] button').filter({hasText:/Ponów/}).click();await settle(false);report.checks.push('failed autosave retains unchecked draft, DB checked; explicit retry persists false');
 assert.deepEqual(await snapshot(),before);
 const colleagueFinal=await browser.newContext();await login(colleagueFinal,second);assert.equal((await (await colleagueFinal.request.get(endpoint)).json()).decisionReceived,false);await colleagueFinal.close();
 // The relocated mobile date keeps its original autosave/reminder and summary semantics.
 const dateInput=box().locator('xpath=../..').locator('input[type=date]');
 for(const date of ['2027-03-04','2027-02-03']){const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url()===endpoint);await dateInput.fill(date);const saved=await response;assert.equal(saved.status(),200);assert.equal((await get()).predictedDecisionDate.slice(0,10),date);assert.ok((await page.locator('[data-section-key="case-important-dates"]:visible').textContent()).includes(await page.evaluate(date=>new Date(date+'T00:00:00').toLocaleDateString('pl-PL'),date)))}
 const dateTasks=await db.task.findMany({where:{organizationId:org.id}});assert.ok(dateTasks.some(t=>JSON.parse(t.description||'{}').predictedDecision?.caseId===record.id));assert.ok(dateTasks.some(t=>JSON.parse(t.description||'{}').predictedDecisionDocuments?.caseId===record.id));
 const withReminders=await snapshot();for(const value of [true,false]){const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url()===endpoint);await box().setChecked(value);assert.equal((await response).status(),200);assert.deepEqual(await snapshot(),withReminders)}
 report.checks.push('mobile predicted date autosave, important-date summary and both existing reminder kinds preserved; receipt-only patches change zero populated reminder/notification rows; colleague sees false');
 assert.equal(report.errors.length,0);report.result='PASS';await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log('PASS decision integration',report.checks.length,report.matrix.length)
}
main().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),500)}).finally(async()=>{await db.$disconnect();await old.$disconnect()});
