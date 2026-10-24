// Real app, synthetic local database, unlinked Owner using the real default scope.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcryptjs'
import {chromium} from 'playwright'
import evidence from './actualization-source-evidence.cjs'
import {actualizationDay,actualizationAssignmentLabels} from '../src/lib/documentActualizationPolicy.ts'
import {syncDocumentActualization,lockActualizationCase} from '../src/lib/documentActualization.ts'
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55435');assert.equal(url.pathname,'/actualization_qa')
const db=new PrismaClient(),origin='http://127.0.0.1:3127',out='work/admin-fallback-evidence',report={source:evidence.sourceEvidence(),matrix:[],errors:[]}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
try{
 await fs.mkdir(out,{recursive:true});const stamp=Date.now(),password=randomBytes(24).toString('hex')
 const org=await db.organization.create({data:{name:'Synthetic Fallback Browser',slug:'fallback-browser-'+stamp,settings:{staffScopeFilterEnabled:true}}})
 const user=await db.user.create({data:{name:'Synthetic unlinked Owner',email:`fallback-browser-${stamp}@example.invalid`,password:await bcrypt.hash(password,10),organizationId:org.id,role:'owner'}})
 const client=await db.client.create({data:{organizationId:org.id,firstName:'Synthetic',lastName:'Unassigned'}})
 await db.taskPriority.create({data:{organizationId:org.id,name:'Нормально',color:'#06b6d4'}})
 const today=actualizationDay(new Date()),base=new Date(today+'T00:00:00Z');base.setUTCDate(base.getUTCDate()-90)
 const r=await db.case.create({data:{organizationId:org.id,clientId:client.id,caseNumber:'SYNTHETIC-ADMIN-FALLBACK',predictedDecisionDate:base}})
 await db.$transaction(async tx=>{await lockActualizationCase(tx,org.id,r.id);await syncDocumentActualization(tx,r,true)})
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=500)report.errors.push('HTTP '+r.status()+' '+new URL(r.url()).pathname)})
 assert.equal((await context.request.post(origin+'/api/auth/login',{data:{email:user.email,password}})).status(),200)
 for(const [width,lang,theme] of [1024,390].flatMap(width=>['ru','uk','pl'].flatMap(lang=>['light','dark','slate'].map(theme=>[width,lang,theme])))){
   await page.setViewportSize({width,height:1000});await page.addInitScript(({lang,theme})=>{localStorage.setItem('rezi_lang',lang);localStorage.setItem('rezi_theme',theme)},{lang,theme})
   const shots=[]
   for(const screen of ['tasks','calendar','cases/'+r.id,'dashboard']){
     await page.goto(origin+'/'+screen)
     const badge=page.locator('[data-actualization-requires-assignment]:visible').filter({hasText:actualizationAssignmentLabels[lang]}).first()
     if(screen.startsWith('cases/')&&width<=768){await page.locator('[data-mobile-case-detail]').waitFor();const section=page.locator('[data-section-key="case-doc-updates"]');await section.locator('button').first().click()}
     await badge.waitFor();assert.equal(await badge.innerText(),actualizationAssignmentLabels[lang]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
     if(screen==='tasks'&&width<=768){await page.locator(`a[href="/cases/${r.id}"]:visible`).first().waitFor()}
     if(screen==='calendar'&&width>768){
       const chip=page.locator('.cal-chip--actualization-fallback:visible').first();await chip.waitFor()
       const metrics=await chip.evaluate(e=>{const title=e.querySelector('.cal-chip-title'),badge=e.querySelector('[data-actualization-compact]'),box=e.getBoundingClientRect(),t=title.getBoundingClientRect(),b=badge.getBoundingClientRect();return {height:box.height,titleTop:t.top-box.top,badgeTop:b.top-box.top,badgeBottom:b.bottom-box.top,nowrap:getComputedStyle(badge).whiteSpace,fullLabel:badge.getAttribute('aria-label'),title:badge.title}})
       assert.ok(metrics.height<=18,JSON.stringify(metrics));assert.ok(metrics.badgeBottom<=metrics.height,JSON.stringify(metrics));assert.ok(Math.abs(metrics.titleTop-metrics.badgeTop)<=1);assert.equal(metrics.nowrap,'nowrap');assert.equal(metrics.fullLabel,actualizationAssignmentLabels[lang]);assert.equal(metrics.title,actualizationAssignmentLabels[lang])
       const monthFile=`month-chip-${width}-${lang}-${theme}.png`;await chip.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+monthFile});shots.push(monthFile)
     }
     const file=`${screen.split('/')[0]}-${width}-${lang}-${theme}.png`;await badge.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+file});shots.push(file)
   }
   report.matrix.push({width,lang,theme,screens:['Tasks','Calendar','Case','Upcoming Events'],badge:true,overflow:false,screenshots:shots});console.log('PASS fallback browser',width,lang,theme)
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(evidence.sourceEvidence(),report.source);report.runnerSha256=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');report.result='PASS';await fs.writeFile(out+'/browser.json',JSON.stringify(report,null,2))
}finally{await browser.close();await db.$disconnect()}
