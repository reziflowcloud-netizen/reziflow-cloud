const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises')
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const scope=()=>page.locator('select[aria-label="Ответственный"]:visible'),origin='http://127.0.0.1:3117',key='legalhub:leads:responsible:v1:[1,"qa-a"]'
 await page.goto(origin+'/leads');await scope().waitFor();await scope().selectOption('mine')
 await page.waitForFunction(()=>new URL(location.href).searchParams.get('staffScope')==='mine');await page.reload();await scope().waitFor();assert.equal(await scope().inputValue(),'mine')
 await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/leads/synthetic-0**')
 await page.locator('button:visible').filter({hasText:'←'}).first().click();await scope().waitFor();assert.equal(await scope().inputValue(),'mine')
 // Real client hook/layout identity change in the same tab, using only mock identity cookies.
 await ctx.addCookies([{name:'qa-user',value:'2',url:origin}]);await page.reload();await scope().waitFor();assert.equal(await scope().inputValue(),'all')
 await ctx.addCookies([{name:'qa-user',value:'1',url:origin}]);await page.reload();await scope().waitFor();assert.equal(await scope().inputValue(),'mine')
 await page.route('**/api/staff-scope',r=>r.fulfill({status:503,json:{error:'synthetic'}}));await page.reload()
 await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().waitFor()
 await page.locator('input[placeholder]:visible').first().fill('Synthetic Mine');await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='Synthetic Mine')
 assert.equal(new URL(page.url()).searchParams.get('staffScope'),'mine');assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'mine')
 await page.getByText('Synthetic Mine',{exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/leads/synthetic-0**')
 assert.equal(new URL(origin+new URL(page.url()).searchParams.get('backTo')).searchParams.get('staffScope'),'mine')
 assert.deepEqual(errors,[]);await fs.mkdir('work/leads-responsible',{recursive:true});await fs.writeFile('work/leads-responsible/mock-result.json',JSON.stringify({result:'PASS',mode:'frontend-only actual components / synthetic API, no DB/server auth',checks:['Mine reload','in-app Back','same-tab identity switch','metadata failure preserves filters/scope/storage/backTo'],errors},null,2)+'\n');console.log('PASS mock frontend harness: reload, detail Back, identity switch, metadata failure; zero page errors')
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
