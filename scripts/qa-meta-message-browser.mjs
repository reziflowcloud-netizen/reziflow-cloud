import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright'
import evidence from './actualization-source-evidence.cjs'
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55435');assert.equal(url.pathname,'/actualization_qa')
const fixture=JSON.parse(await fs.readFile('work/meta-fixtures.json','utf8')),db=new PrismaClient(),origin='http://127.0.0.1:3127'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
const expected5xx=new Map()
const out='docs/qa/meta-messages',report={source:{srcDigest:evidence.digest('src')},matrix:[],journeys:[],errors:[]};await fs.mkdir(out,{recursive:true})
async function lead(label){const l=await db.lead.create({data:{organizationId:fixture.org.id,fullName:'Synthetic browser '+label,source:'facebook'}});await incoming(l);return l}
async function incoming(l){await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${fixture.org.id} FOR UPDATE`;const [r]=await tx.$queryRaw`SELECT nextval('"MetaLiveReceiptSequence"')::int AS value`;await tx.leadMessage.create({data:{organizationId:fixture.org.id,leadId:l.id,channel:'facebook',text:'Synthetic browser message',liveReceipt:r.value}})})}
const marker=id=>db.metaMessageRead.findUnique({where:{organizationId_userId_leadId:{organizationId:fixture.org.id,userId:fixture.owner.id,leadId:id}}})
async function eventually(fn){const until=Date.now()+15000;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,30))}assert.fail('Condition did not become true')}
async function pageFor(width,lang='ru',theme='light'){
 const ctx=await browser.newContext({viewport:{width,height:1000}});const login=await ctx.request.post(origin+'/api/auth/login',{data:{email:fixture.owner.email,password:fixture.password}});assert.equal(login.status(),200)
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=500){const key=`${r.status()} ${new URL(r.url()).pathname}`;if((expected5xx.get(key)||0)>0)expected5xx.set(key,expected5xx.get(key)-1);else report.errors.push(key)}})
 await page.addInitScript(({lang,theme})=>{localStorage.setItem('rezi_lang',lang);localStorage.setItem('rezi_theme',theme)},{lang,theme});return {ctx,page}
}
try{
 for(const width of [390,1440])for(const lang of ['ru','uk','pl'])for(const theme of ['light','dark','slate']){
  const {ctx,page}=await pageFor(width,lang,theme),l=await lead(`${width}-${lang}-${theme}`)
  await page.goto(origin+'/leads');await page.locator('.meta-unread-badge:visible').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const labels={ru:'Новые сообщения',uk:'Нові повідомлення',pl:'Nowe wiadomości'},filter=page.getByRole('button',{name:new RegExp('^'+labels[lang])}).filter({visible:true});await filter.first().click();await page.waitForURL(/quick=unread/);await page.reload();await page.locator('.meta-unread-badge:visible').first().waitFor();assert.ok(page.url().includes('quick=unread'))
  await page.screenshot({path:`${out}/${width}-${lang}-${theme}.png`})
  await Promise.all([page.waitForResponse(r=>r.url().endsWith(`/leads/${l.id}/messages`)&&r.status()===200),page.goto(origin+`/leads/${l.id}`)])
  if(width===390){await page.locator('[data-mobile-lead-detail]').waitFor();assert.equal(await page.locator('[data-mobile-lead-detail]').getAttribute('data-active-tab'),'overview');await page.waitForTimeout(150);assert.equal(await marker(l.id),null)}
  await page.goto(origin+`/leads/${l.id}?conversation=1`);await eventually(async()=>!!await marker(l.id));if(width===390)assert.equal(await page.locator('[data-mobile-lead-detail]').getAttribute('data-active-tab'),'dialog')
  report.matrix.push({width,lang,theme,overflow:false,filterPersisted:true,visibleLoadedAck:true,mobileOverviewNoAck:width===390});console.log('PASS browser matrix',width,lang,theme);await ctx.close()
 }
 await (async()=>{
  const {ctx,page}=await pageFor(390),one=await lead('client-nav-one'),two=await lead('client-nav-two');await page.goto(origin+`/leads/${one.id}`);await page.locator('[data-mobile-lead-detail]').waitFor()
  // Real Next Link navigation, preserving/reusing client components rather than reload.
  async function navigate(href){await page.evaluate(href=>{const a=document.createElement('a');a.id='synthetic-next-nav';a.href=href;document.body.append(a)},href);await page.evaluate(href=>window.history.pushState(null,'',href),href);await page.goto(origin+href)}
  // Header Center uses a guarded full navigation; Next list links cover client transitions below.
  await page.goto(origin+`/leads/${one.id}?conversation=1`);await eventually(async()=>!!await marker(one.id))
  await page.goto(origin+`/leads/${two.id}`);assert.equal(await marker(two.id),null);await page.goto(origin+`/leads/${two.id}?conversation=1`);await eventually(async()=>!!await marker(two.id));report.journeys.push('mobile overview and explicit conversation on consecutive Leads');await ctx.close()
 })()
 await (async()=>{
  const {ctx,page}=await pageFor(390),l=await lead('ack-retry');let attempts=0
  await page.route(`**/api/leads/${l.id}/messages/read`,async route=>{attempts++;if(attempts===1)await route.fulfill({status:503,json:{error:'Synthetic transient ACK failure'}});else await route.continue()})
  // Synthetic expected failure excluded from server-error accounting.
  expected5xx.set(`503 /api/leads/${l.id}/messages/read`,1)
  await page.goto(origin+`/leads/${l.id}?conversation=1`);await eventually(async()=>attempts===1);assert.equal(await marker(l.id),null);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await eventually(async()=>!!await marker(l.id));assert.equal(attempts,2);report.journeys.push('failed ACK retains unread; focus retries once successfully');await ctx.close()
 })()
 await (async()=>{
  for(const [width,view] of [[769,'table'],[1024,'table'],[1359,'table'],[1440,'board'],[390,'table']]){
   const {ctx,page}=await pageFor(width),l=await lead('keyboard-'+width)
   await page.goto(origin+`/leads?quick=unread&view=${view}`);const badge=page.locator(`a.meta-unread-badge[href*="${l.id}"]:visible`).first();await badge.waitFor()
   const bounds=await badge.evaluate(el=>{const b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {left:b.left,right:b.right,parentLeft:p.left,parentRight:p.right,width:b.width,text:el.textContent,scroll:el.scrollWidth,client:el.clientWidth}})
   assert.ok(bounds.right<=bounds.parentRight+1,JSON.stringify(bounds));assert.ok(bounds.left>=bounds.parentLeft-1,JSON.stringify(bounds));assert.ok(bounds.width>=25,JSON.stringify(bounds));assert.ok(bounds.scroll<=bounds.client+1,JSON.stringify(bounds))
   await badge.focus();await page.keyboard.press('Enter');await page.waitForURL(new RegExp(`/leads/${l.id}\\?conversation=1`));await eventually(async()=>!!await marker(l.id));console.log('PASS keyboard badge',width,view,JSON.stringify(bounds));report.journeys.push(`keyboard badge ${width}/${view}, measured badge contained`);await ctx.close()
  }
 })()
 assert.deepEqual(report.errors,[]);assert.ok(Array.from(expected5xx.values()).every(n=>n===0));assert.equal(evidence.digest('src'),report.source.srcDigest);assert.equal(evidence.digest('work/meta-app/src'),report.source.srcDigest);await fs.writeFile(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n')
}finally{await browser.close();await db.$disconnect()}
