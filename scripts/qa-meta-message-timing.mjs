// Database-free actual-component timing and Next navigation tests against UI harness.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import evidence from './actualization-source-evidence.cjs'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
const origin='http://127.0.0.1:3129',report={sourceDigest:evidence.digest('src'),checks:[],errors:[]}
const run=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS',name)}
async function eventually(fn){const until=Date.now()+15000;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,20))}throw Error('Condition timeout')}
async function scenario(mode='running',initialLatest=1){
 const ctx=await browser.newContext({viewport:{width:390,height:1000}}),page=await ctx.newPage()
 let latest=initialLatest,revision=1,sound=false,polls=0,hold=null,listLoads=0
 await page.addInitScript(mode=>{
  window.__sounds=0;window.__closed=0;window.__visuals=0;window.__sentinel='same-document';window.__audioMode=mode
  window.addEventListener('meta-messages-changed',()=>window.__visuals++)
  class Audio {state='running';currentTime=0;destination={};resume(){return window.__audioMode==='never'?new Promise(()=>{}):window.__audioMode==='reject'?Promise.reject(Error('Synthetic autoplay denied')):Promise.resolve()};close(){window.__closed++;return Promise.resolve()};createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){},start(){window.__sounds++},stop(){setTimeout(()=>this.onended?.(),10)}}};createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}
  window.AudioContext=Audio
 },mode)
 await page.route('**/api/notifications/meta-messages',async route=>{polls++;const body={enabled:true,userKey:'synthetic-ui:1',latest:latest?{id:latest,leadId:'synthetic-0'}:null,sound,visualRevision:String(revision),unread:[{leadId:'synthetic-0',leadName:'Synthetic Lead 0',count:1,total:1}]};if(hold){const gate=hold;hold=null;gate.started(body);await gate.wait}await route.fulfill({json:body})})
 page.on('request',r=>{if(r.url().includes('/api/leads?'))listLoads++});page.on('pageerror',e=>report.errors.push(e.message))
 await page.clock.install();await page.goto(origin+'/leads');await eventually(()=>polls>=1);await eventually(async()=>await page.evaluate(()=>window.__visuals)>=1);await page.locator('.meta-unread-badge:visible').first().waitFor()
 const pulse=async()=>{await page.clock.runFor(30010);await page.waitForTimeout(20)}
 const refresh=async(type='meta-preferences-changed')=>{const before=polls;await page.evaluate(type=>window.dispatchEvent(new Event(type)),type);await eventually(()=>polls>before)}
 return {ctx,page,pulse,refresh,get polls(){return polls},get listLoads(){return listLoads},event(){latest++;revision++},visual(){revision++},set sound(v){sound=v},hold(){let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);hold={wait,started};return {release,ready}}}
}
try{
 await run('initial poll reconciles visual state without initial sound; accessible nonrecipient cursor refreshes list',async()=>{
  const x=await scenario();assert.equal(await x.page.evaluate(()=>window.__sounds),0);const before=x.listLoads;x.visual();await x.pulse();await eventually(()=>x.listLoads>before);assert.equal(await x.page.evaluate(()=>window.__sounds),0);await x.ctx.close()
 })
 await run('empty baseline then first future event sounds once; repeated poll and read never replay audio',async()=>{
  const x=await scenario('running',0);await x.page.mouse.click(10,10);x.sound=true;await x.refresh();await x.page.waitForTimeout(30);x.event();await x.pulse();await eventually(async()=>await x.page.evaluate(()=>window.__sounds)===1);await x.pulse();await x.refresh('meta-messages-read');assert.equal(await x.page.evaluate(()=>window.__sounds),1);await x.ctx.close()
 })
 await run('never-resolving AudioContext.resume cannot block visual polling',async()=>{
  const x=await scenario('never');await x.page.mouse.click(10,10);x.sound=true;await x.refresh();x.event();await x.pulse();const before=x.polls;x.visual();await x.pulse();await eventually(()=>x.polls>before);assert.equal(await x.page.evaluate(()=>window.__sounds),0);assert.ok(await x.page.evaluate(()=>window.__closed)>=1);await x.ctx.close()
 })
 await run('autoplay rejection preserves visual polling and no sound',async()=>{
  const x=await scenario('reject');await x.page.mouse.click(10,10);x.sound=true;await x.refresh();x.event();await x.pulse();const before=x.polls;await x.pulse();assert.ok(x.polls>before);assert.equal(await x.page.evaluate(()=>window.__sounds),0);await x.ctx.close()
 })
 await run('OFF invalidates stale in-flight sound; ON advances baseline without replay; queued refresh is immediate',async()=>{
  const x=await scenario();await x.page.mouse.click(10,10);x.sound=true;await x.refresh();x.event();const gate=x.hold();const pulse=x.pulse();await gate.ready;x.sound=false;await x.page.evaluate(()=>window.dispatchEvent(new Event('meta-preferences-changed')));const before=x.polls;gate.release();await pulse;await eventually(()=>x.polls>before);assert.equal(await x.page.evaluate(()=>window.__sounds),0)
  x.event();x.sound=true;await x.refresh();assert.equal(await x.page.evaluate(()=>window.__sounds),0);x.event();await x.pulse();await eventually(async()=>await x.page.evaluate(()=>window.__sounds)===1);await x.ctx.close()
 })
 await run('session change discards stale in-flight response and clears published user data',async()=>{
  const x=await scenario();x.event();const gate=x.hold(),pulse=x.pulse();await gate.ready;await x.page.evaluate(()=>window.dispatchEvent(new Event('meta-session-changed')));gate.release();await pulse;assert.equal(await x.page.locator('[data-notification-bell] [class*=badge]').count(),0);assert.equal(await x.page.evaluate(()=>window.__sounds),0);await x.ctx.close()
 })
 await run('cross-tab read event outside preview refreshes list even unchanged poll preview',async()=>{
  const x=await scenario();const other=await x.ctx.newPage();await other.goto(origin+'/review');const before=x.listLoads;await other.evaluate(()=>{const c=new BroadcastChannel('legalhub-meta-read');c.postMessage('read');c.close()});await eventually(()=>x.listLoads>before);await x.ctx.close()
 })
 await run('Next client navigation consumes same-Lead query and new-Lead dialogue once; polling does not steal scroll/tab',async()=>{
  const x=await scenario();await x.page.getByRole('link',{name:'Lead A',exact:true}).click();await x.page.waitForURL('**/leads/synthetic-0');await x.page.locator('[data-mobile-lead-detail][data-active-tab="overview"]').waitFor()
  await x.page.getByRole('link',{name:'Dialog A',exact:true}).click();await x.page.waitForURL('**/leads/synthetic-0?conversation=1');await x.page.locator('[data-mobile-lead-detail][data-active-tab="dialog"]').waitFor();assert.equal(await x.page.evaluate(()=>window.__sentinel),'same-document')
  await x.page.getByRole('link',{name:'Dialog B',exact:true}).click();await x.page.waitForURL('**/leads/synthetic-1?conversation=1');await x.page.locator('[data-mobile-lead-detail][data-active-tab="dialog"]').waitFor();assert.equal(await x.page.evaluate(()=>window.__sentinel),'same-document')
  const tabs=x.page.locator('[data-mobile-lead-detail] button[aria-current="page"]');const label=await tabs.first().textContent();x.visual();await x.pulse();assert.equal(await tabs.first().textContent(),label);await x.ctx.close()
 })
 assert.deepEqual(report.errors,[]);assert.equal(evidence.digest('src'),report.sourceDigest);await fs.mkdir('docs/qa/meta-messages',{recursive:true});await fs.writeFile('docs/qa/meta-messages/timing.json',JSON.stringify(report,null,2)+'\n')
}finally{await browser.close()}
