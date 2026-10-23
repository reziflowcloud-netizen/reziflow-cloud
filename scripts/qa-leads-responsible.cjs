// Run only against an empty disposable localhost PostgreSQL database and local Next server.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { chromium } = require('playwright')
const target = new URL(process.env.DATABASE_URL || '')
assert.equal(target.hostname, '127.0.0.1')
assert.equal(target.port, '55432')
assert.equal(target.pathname, '/reziflow_leads_responsible_qa')
assert.ok(!process.env.DIRECT_URL)
const origin = 'http://127.0.0.1:3107'
const out = path.resolve(process.env.LEADS_QA_OUTPUT || 'work/leads-responsible/browser')
const db = new PrismaClient()
const ownedOrgs = []
const report = { checks: [], matrix: [], errors: [], isolation: 'empty localhost-only dedicated QA DB; synthetic fixtures only' }
let browser
async function main() {
  assert.equal(await db.organization.count(), 0, 'QA database must be empty')
  await fs.mkdir(out, { recursive: true })
  const suffix = randomBytes(6).toString('hex'), password = randomBytes(24).toString('base64url')
  const hash = await bcrypt.hash(password, 10)
  const org = await db.organization.create({data:{name:'Synthetic Scope A',slug:`scope-a-${suffix}`,settings:{staffScopeFilterEnabled:true}}})
  ownedOrgs.push(org.id)
  const orgB = await db.organization.create({data:{name:'Synthetic Scope B',slug:`scope-b-${suffix}`,settings:{staffScopeFilterEnabled:true}}})
  ownedOrgs.push(orgB.id)
  const user = async (name, organizationId, restrictedAccess=false) => db.user.create({data:{name,organizationId,restrictedAccess,role:restrictedAccess?'employee':'owner',email:`${name}-${suffix}@example.invalid`,password:hash}})
  const a = await user('owner-a',org.id), b = await user('owner-b',org.id), c = await user('owner-c',orgB.id), restricted = await user('restricted',org.id,true), unlinked = await user('unlinked',org.id)
  const employee = async (name, organizationId, userId, active=true) => db.employee.create({data:{name,organizationId,userId,active}})
  const own = await employee('Synthetic Own',org.id,a.id), other = await employee('Synthetic Other',org.id,b.id), inactive=await employee('Synthetic Inactive',org.id,null,false), foreign=await employee('Synthetic Foreign',orgB.id,c.id)
  await employee('Synthetic Restricted',org.id,restricted.id)
  await db.leadStatus.create({data:{name:'Новый',organizationId:org.id,requireReason:true,reasons:['QA Reason']}})
  for (const [name, assignedToId, employeeId] of [['Synthetic Mine',a.id,own.id],['Synthetic Team',b.id,other.id],['Synthetic Restricted',restricted.id,own.id]]) {
    await db.lead.create({data:{organizationId:org.id,fullName:name,firstName:name,assignedToId,employeeId,status:'Новый',source:'manual',serviceInterest:'QA Interest',urgency:'warm',statusReason:'QA Reason'}})
  }
  browser=await chromium.launch({headless:process.env.LEADS_QA_INTERACTIVE!=='1',executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
  page.on('pageerror',e=>report.errors.push(e.message))
  const login=async who=>{const response=await context.request.post(origin+'/api/auth/login',{data:{email:who.email,password},headers:{Origin:origin}});assert.equal(response.status(),200)}
  const owner=who=>JSON.stringify([who.id,who.organizationId]),key=who=>`legalhub:leads:responsible:v1:${owner(who)}`
  const scope=()=>page.locator('select[aria-label="Ответственный"]:visible,select[aria-label="Відповідальний"]:visible,select[aria-label="Odpowiedzialny"]:visible')
  const expectScope=async value=>{await scope().waitFor();await page.waitForFunction(value=>Array.from(document.querySelectorAll('select')).some(s=>s.getAttribute('aria-label')&&['Ответственный','Відповідальний','Odpowiedzialny'].includes(s.getAttribute('aria-label'))&&s.value===value),value);assert.equal(await scope().inputValue(),value)}
  const goto=async (query='')=>{await page.goto(origin+'/leads'+query);await scope().waitFor()}
  const filters='&status='+encodeURIComponent('Новый')+'&source=manual&interest=QA+Interest&q=Synthetic&temperature=warm&period=custom&from=2026-01-01&to=2027-12-31&quick=no_next_contact&reason=QA+Reason&sort=lead&dir=desc'
  const urlFor=(value,who=a)=>'?'+new URLSearchParams({staffScope:value,staffScopeOwner:owner(who)})+filters
  const checkFilters=()=>{const p=new URL(page.url()).searchParams;assert.equal(p.get('status'),'Новый');assert.equal(p.get('source'),'manual');assert.equal(p.get('interest'),'QA Interest');assert.equal(p.get('q'),'Synthetic');assert.equal(p.get('sort'),'lead');assert.equal(p.get('dir'),'desc');assert.equal(p.get('temperature'),'warm');assert.equal(p.get('period'),'custom');assert.equal(p.get('from'),'2026-01-01');assert.equal(p.get('to'),'2027-12-31');assert.equal(p.get('quick'),'no_next_contact');assert.equal(p.get('reason'),'QA Reason')}
  await login(a)
  if(process.env.LEADS_QA_INTERACTIVE==='1') { await goto(urlFor('mine'));await page.pause() }
  for (const value of ['all','mine',`employee:${other.id}`]) {
    await goto(urlFor(value));await expectScope(value);await page.reload();await expectScope(value);checkFilters()
    const name=value===`employee:${other.id}`?'Synthetic Team':'Synthetic Mine'
    await page.getByText(name,{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/leads/*');
    await page.locator('button:visible').filter({hasText:'←'}).first().click();await expectScope(value);checkFilters()
    await page.getByText(name,{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/leads/*');await page.goBack();await expectScope(value);checkFilters()
    report.checks.push(`desktop ${value}: reload, in-app Back, browser Back, other filters`)
  }
  for(const value of ['mine',`employee:${other.id}`,'all']){await scope().selectOption(value);await expectScope(value);await page.waitForFunction(value=>new URL(location.href).searchParams.get('staffScope')===value,value)}
  report.checks.push('switching all/mine/employee updates current URL and storage')
  await page.evaluate(({key})=>localStorage.setItem(key,'mine'),{key:key(a)})
  let releaseMetadata
  const delayed=new Promise(resolve=>releaseMetadata=resolve)
  await page.route('**/api/staff-scope',async route=>{await delayed;await route.continue()})
  const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/leads')requests.push(r.url())})
  await page.goto(origin+'/leads');await page.waitForTimeout(600)
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key(a)),'mine');assert.equal(requests.length,0)
  releaseMetadata();await expectScope('mine');await page.unroute('**/api/staff-scope');assert.ok(requests.every(u=>new URL(u).searchParams.get('staffScope')==='mine'))
  report.checks.push('delayed metadata preserves Mine and blocks premature lead requests/storage overwrites')
  await goto(urlFor('mine'));await expectScope('mine')
  let releaseOld, startedOld
  const oldHeld=new Promise(resolve=>releaseOld=resolve), oldStarted=new Promise(resolve=>startedOld=resolve)
  await page.route('**/api/leads?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('staffScope')==='all') {
      const response=await route.fetch();startedOld();await oldHeld;await route.fulfill({response})
    } else await route.continue()
  })
  await scope().selectOption('all');await oldStarted;await scope().selectOption('mine');await expectScope('mine')
  await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().waitFor()
  releaseOld();await page.waitForTimeout(400)
  assert.equal(await page.getByText('Synthetic Team',{exact:true}).filter({visible:true}).count(),0)
  await page.unroute('**/api/leads?**')
  report.checks.push('late previous All request cannot replace current Mine results')
  await page.route('**/api/staff-scope',route=>route.fulfill({status:503,json:{error:'Synthetic metadata failure'}}))
  await page.goto(origin+'/leads'+urlFor('mine'));await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().waitFor()
  await page.locator('input[placeholder]:visible').first().fill('Synthetic Mine')
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='Synthetic Mine')
  assert.equal(new URL(page.url()).searchParams.get('staffScope'),'mine')
  assert.equal(new URL(page.url()).searchParams.get('staffScopeOwner'),owner(a))
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key(a)),'mine')
  await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/leads/*')
  assert.equal(new URL(origin+new URL(page.url()).searchParams.get('backTo')).searchParams.get('staffScope'),'mine')
  await page.locator('button:visible').filter({hasText:'←'}).first().click()
  await page.waitForURL('**/leads?**');await page.unroute('**/api/staff-scope');await page.reload();await expectScope('mine')
  assert.equal(new URL(page.url()).searchParams.get('q'),'Synthetic Mine')
  report.checks.push('metadata failure: filter changes persist, scope URL/storage/backTo untouched, Mine returns after recovery')
  const savedA=page.url()
  await login(b);await goto(new URL(savedA).search);await expectScope('all')
  await scope().selectOption(`employee:${own.id}`);await expectScope(`employee:${own.id}`)
  await login(a);await goto();await expectScope('mine')
  await login(c);await goto(new URL(savedA).search);await expectScope('all')
  await login(a);await goto();await expectScope('mine')
  report.checks.push('account/org switches and old URLs isolate selections; original namespace restores')
  for(const value of [`employee:${inactive.id}`,`employee:${foreign.id}`,'employee:999999','bad','employee:01']){await goto(urlFor(value));await expectScope('all')}
  await scope().selectOption(`employee:${other.id}`);await expectScope(`employee:${other.id}`)
  await db.employee.update({where:{id:other.id},data:{active:false}});await page.reload();await expectScope('all');await db.employee.update({where:{id:other.id},data:{active:true}})
  await login(unlinked);await goto(urlFor('mine',unlinked));await expectScope('all')
  await login(restricted);await goto(urlFor(`employee:${own.id}`,restricted));await expectScope('mine');assert.equal(await scope().isDisabled(),true)
  const denied=await context.request.get(origin+'/api/leads?staffScope=all');assert.equal(denied.status(),403)
  const restrictedLeads=await (await context.request.get(origin+'/api/leads?staffScope=mine')).json();assert.ok(restrictedLeads.every(l=>l.assignedToId===restricted.id))
  report.checks.push('inactive/deleted/foreign employee, revoked employee, unavailable Mine and restricted server access')
  await login(a)
  await page.evaluate(key=>localStorage.setItem(key,'{malformed'),key(a));await goto();await expectScope('all')
  await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k.startsWith('legalhub:leads:responsible:'))throw new DOMException('QA unavailable','SecurityError');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k.startsWith('legalhub:leads:responsible:'))throw new DOMException('QA quota','QuotaExceededError');return set.call(this,k,v)}})
  await goto(urlFor('mine'));await expectScope('mine');await page.reload();await expectScope('mine')
  report.checks.push('malformed/unavailable storage: validated URL still survives reload')
  // A separate context avoids carrying storage failure injection into the rendered matrix.
  await context.close()
  for(const [width,lang,theme] of [[1024,'ru','light'],[1440,'uk','dark'],[1440,'pl','slate'],[390,'ru','dark'],[414,'uk','slate'],[430,'pl','light']]){
    const ctx=await browser.newContext({viewport:{width,height:950}}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message))
    await ctx.addInitScript(({lang,theme})=>{localStorage.setItem('rezi_lang',lang);localStorage.setItem('rezi_theme',theme)},{lang,theme})
    assert.equal((await ctx.request.post(origin+'/api/auth/login',{data:{email:a.email,password},headers:{Origin:origin}})).status(),200)
    await p.goto(origin+'/leads'+urlFor('mine'))
    if(width<769) await p.getByRole('button',{name:/Фильтры|Фільтри|Filtry/,exact:true}).click()
    const select=p.locator('select[aria-label="Ответственный"]:visible,select[aria-label="Відповідальний"]:visible,select[aria-label="Odpowiedzialny"]:visible');await select.waitFor();assert.equal(await select.inputValue(),'mine')
    await select.selectOption(`employee:${other.id}`);await p.reload()
    if(width<769) await p.getByRole('button',{name:/Фильтры|Фільтри|Filtry/,exact:true}).click()
    await select.waitFor();assert.equal(await select.inputValue(),`employee:${other.id}`)
    const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false)
    const file=`${width}-${lang}-${theme}.png`;await p.screenshot({path:path.join(out,file),fullPage:true})
    if(width===390) {
      await p.getByRole('dialog').getByRole('button',{name:/Показать/}).click()
      for(const mode of ['app','browser']) {
        await p.getByText('Synthetic Team',{exact:true}).filter({visible:true}).first().click();await p.waitForURL('**/leads/*')
        if(mode==='app') await p.getByRole('button',{name:'Назад',exact:true}).click();else await p.goBack()
        await p.getByRole('button',{name:'Фильтры',exact:true}).click();await select.waitFor();assert.equal(await select.inputValue(),`employee:${other.id}`)
        await p.getByRole('dialog').getByRole('button',{name:/Показать/}).click()
      }
      report.checks.push('mobile 390: actual detail in-app Back and browser Back preserve employee')
    }
    report.matrix.push({width,lang,theme,selection:'employee',reload:'PASS',overflow:false,screenshot:file});await ctx.close()
  }
  assert.deepEqual(report.errors,[])
}
main().then(()=>{report.result='PASS'}).catch(e=>{report.result='FAIL';report.failure=e.stack;process.exitCode=1;console.error(e.message)}).finally(async()=>{
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser?.close()
  // This script owns the entire initially empty dedicated QA database.
  if(ownedOrgs.length) {
    const where={organizationId:{in:ownedOrgs}}
    await db.lead.deleteMany({where});await db.employee.deleteMany({where});await db.user.deleteMany({where});await db.leadStatus.deleteMany({where});await db.organization.deleteMany({where:{id:{in:ownedOrgs}}})
  }
  await db.$disconnect()
})
