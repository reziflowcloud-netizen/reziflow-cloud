const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs'),{chromium}=require('playwright')
const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/legalhub_case_qa')
const origin='http://localhost:3107',db=new PrismaClient()
async function main(){
 const suffix=Date.now(),password='Local-Followup-QA-only!',report={mode:process.argv[2]||'audit',checks:{},errors:[]}
 const org=await db.organization.create({data:{name:'Follow-up isolated QA',slug:'followup-'+suffix,notificationAutomationEnabled:true,notificationAutomationActivatedAt:new Date(0)}})
 const user=await db.user.create({data:{organizationId:org.id,name:'QA Owner',role:'owner',email:`followup-${suffix}@example.invalid`,password:await bcrypt.hash(password,10)}})
 const client=await db.client.create({data:{organizationId:org.id,firstName:'Follow-up',lastName:'QA',assignedToId:user.id}})
 await db.caseStatus.create({data:{organizationId:org.id,name:'Новый'}})
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),api=context.request
 page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.accept())
 const req=async(method,route,body,status=200)=>{const response=await api[method](origin+route,{...(body===undefined?{}:{data:body}),maxRedirects:0});assert.equal(response.status(),status,await response.text());return response.json()}
 try{
  await req('post','/api/auth/login',{email:user.email,password})
  const service=await req('post','/api/services',{name:'Follow-up QA service'})
  await req('put',`/api/services/${service.id}/document-template`,{expectedVersion:0,items:[{name:'QA Passport',required:true,forMos:true,active:true},{name:'QA Photo',required:true,forMos:true,active:true},{name:'QA Insurance',required:false,forMos:true,active:true},{name:'QA Other',required:false,forMos:false,active:true}]})
  const c=await req('post','/api/cases',{clientId:client.id,serviceId:service.id,assignedToId:user.id,caseNumber:'FOLLOWUP-'+suffix,mosSentAt:'2026-10-09'})
  await req('patch',`/api/cases/${c.id}`,{expectedUpdatedAt:c.updatedAt,mosSentAt:'2026-10-09'})
  const listUrl=`/api/cases/${c.id}/checklist`,get=()=>req('get',listUrl)
  const filePath=path.join(process.cwd(),'public','uploads',`followup-${suffix}.pdf`),bytes=Buffer.from('%PDF-1.4\n% Harmless isolated QA fixture\n%%EOF\n')
  await fs.mkdir(path.dirname(filePath),{recursive:true});await fs.writeFile(filePath,bytes)
  const file=await db.caseDocument.create({data:{caseId:c.id,name:'QA Existing upload.pdf',fileType:'pdf',mimeType:'application/pdf',publicId:`local:uploads/followup-${suffix}.pdf`,size:bytes.length}})
  await page.goto(origin+`/cases/${c.id}?tab=docs`)
  await page.evaluate(()=>{localStorage.setItem('rezi_lang','uk');window.dispatchEvent(new CustomEvent('langchange',{detail:'uk'}))})
  const root=page.locator('[data-document-checklist=documents]:visible'),row=()=>root.locator('[data-checklist-item="QA Passport"]'),dialog=()=>page.getByRole('dialog')
  await row().waitFor();assert.ok((await row().textContent()).includes('Файл не пов’язаний'))
  await row().click();await dialog().locator('select').last().selectOption(String(file.id))
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/files')&&r.request().method()==='POST')
  await dialog().getByRole('button',{name:'Пов’язати файл',exact:true}).click()
  const response=await responsePromise,payload=await response.json(),item=payload.items.find(i=>i.name==='QA Passport')
  report.fileAudit={httpStatus:response.status(),request:response.request().postDataJSON(),responseFiles:item.files.length,dbLinkedToItem:(await db.caseDocument.findUniqueOrThrow({where:{id:file.id}})).checklistItemId===item.id}
  await page.waitForFunction(()=>!document.querySelector('[data-checklist-save]:disabled'))
  report.fileAudit.beforeSaveRow=await row().textContent();report.fileAudit.modalFileVisible=await dialog().getByRole('link',{name:file.name}).count()
  await dialog().locator('[data-checklist-save]').click();await dialog().waitFor({state:'hidden'})
  report.fileAudit.afterSaveRow=await row().textContent()
  await page.reload();await row().waitFor();report.fileAudit.afterReloadRow=await row().textContent()
  const served=await api.get(origin+`/api/documents/${file.id}/file`);assert.equal(served.status(),200);assert.deepEqual(await served.body(),bytes)
  report.fileAudit.physicalFileAccessible=true
  const current=(await get()).items.find(i=>i.name==='QA Passport')
  await req('post',`${listUrl}/${current.id}/files`,{documentId:file.id,unlink:true,expectedVersion:current.version})
  await page.reload();await row().click();await dialog().locator('select').last().selectOption(String(file.id))
  const photo=(await get()).items.find(i=>i.name==='QA Photo')
  await req('post',`${listUrl}/${photo.id}/files`,{documentId:file.id,expectedVersion:photo.version})
  const conflictPromise=page.waitForResponse(r=>r.url().endsWith('/files')&&r.request().method()==='POST')
  await dialog().getByRole('button',{name:'Пов’язати файл',exact:true}).click();const conflict=await conflictPromise
  await dialog().locator('[role=alert]').waitFor();await page.waitForFunction(()=>!document.querySelector('[role=dialog] textarea:disabled'))
  report.fileAudit.concurrentLinkStatus=conflict.status()
  report.fileAudit.saveDisabledAfterFailedLink=await dialog().locator('[data-checklist-save]').isDisabled()
  if(report.mode==='audit'){
   await dialog().locator('[data-checklist-save]').click();await dialog().waitFor({state:'hidden'})
   report.fileAudit.saveClosesAndMasksFailedLink=true
   report.fileAudit.afterFailedLinkAndSave=await row().textContent()
  }else{
   const shots=path.join(process.cwd(),'docs','qa','document-checklist-v2-followup');await fs.mkdir(shots,{recursive:true})
   assert.equal(report.fileAudit.concurrentLinkStatus,409);assert.equal(report.fileAudit.saveDisabledAfterFailedLink,true)
   assert.equal(await dialog().locator('select').last().inputValue(),String(file.id));assert.equal(await dialog().isVisible(),true)
   const linkedPhoto=(await get()).items.find(i=>i.name==='QA Photo')
   await req('post',`${listUrl}/${linkedPhoto.id}/files`,{documentId:file.id,unlink:true,expectedVersion:linkedPhoto.version})
   await dialog().locator('[data-checklist-operation-retry]').click();await dialog().getByRole('link',{name:file.name}).waitFor()
   await dialog().locator('[data-checklist-save]').click();await dialog().waitFor({state:'hidden'})
   assert.equal(await row().locator('[data-checklist-file-state=linked]').count(),1);assert.ok((await row().textContent()).includes('Файлів: 1'))
   await page.reload();await row().waitFor();assert.equal(await row().locator('[data-checklist-file-state=linked]').count(),1)
   await row().click();await dialog().getByRole('link',{name:file.name}).waitFor()
   await dialog().getByRole('button',{name:'Від’єднати',exact:true}).click();await dialog().getByRole('link',{name:file.name}).waitFor({state:'hidden'})
   await dialog().locator('[data-checklist-save]').click();await dialog().waitFor({state:'hidden'})
   assert.equal(await row().locator('[data-checklist-file-state=unlinked]').count(),1);assert.equal(await db.caseDocument.count({where:{id:file.id}}),1);assert.deepEqual(await fs.readFile(filePath),bytes)
   await page.reload();await row().waitFor();await row().screenshot({path:path.join(shots,'03-unlinked-file.png')})
   report.checks.fileFailureCannotBeMaskedBySave='PASS';report.checks.fileRetryLinkReloadUnlinkPhysicalFilePreserved='PASS'
   await row().click();await dialog().locator('textarea').fill('QA preserved file note');await dialog().locator('select').first().selectOption('RECEIVED');await dialog().locator('select').last().selectOption(String(file.id))
   await dialog().getByRole('button',{name:'Пов’язати файл',exact:true}).click();await dialog().getByRole('link',{name:file.name}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-checklist-save]:disabled'));await dialog().locator('[data-checklist-save]').click();await dialog().waitFor({state:'hidden'})
   await row().screenshot({path:path.join(shots,'02-linked-file.png')})
   const beforeBulk=(await get()).items.find(i=>i.name==='QA Passport'),caseUpdatedAt=(await req('get',`/api/cases/${c.id}`)).updatedAt,tasksBeforeBulk=await db.task.count({where:{organizationId:org.id,description:{contains:c.id}}})
   await page.screenshot({path:path.join(shots,'01-desktop-documents-headings.png'),fullPage:true,animations:'disabled'})
   let data=await get();data=await req('post',listUrl,{action:'add',expectedVersion:data.version,name:'QA Archived MOS',required:false,forMos:true});const archived=data.items.find(i=>i.name==='QA Archived MOS');await req('delete',`${listUrl}/${archived.id}`,{expectedVersion:archived.version})
   await page.goto(origin+`/cases/${c.id}`)
   const openMos=async()=>{await page.locator('[data-section-key=case-basic]:visible').waitFor();const mos=page.locator('[data-document-checklist=mos]:visible');if(!await mos.count()){if(page.viewportSize().width>768)await page.locator('[data-collapse-key=case-mos] .section-title button').click();else await page.locator('[data-mobile-case-detail] [data-section-key=case-mos] button[aria-expanded]').click()}await mos.waitFor();return mos}
   let mos=await openMos(),select=name=>mos.locator(`[data-mos-select="${name}"]`),submit=()=>mos.locator('[data-mos-bulk-submit]')
   await select('QA Passport').focus();await page.keyboard.press('Space');assert.equal(await select('QA Passport').isChecked(),true);assert.equal(await mos.locator('[data-mos-bulk-date]').inputValue(),'2026-10-09');assert.ok((await submit().textContent()).includes('(1)'))
   await select('QA Photo').check();assert.ok((await submit().textContent()).includes('(2)'));assert.equal(await mos.locator('[data-mos-select-all]').evaluate(el=>el.indeterminate),true)
   await mos.locator('[data-mos-select-all]').check();assert.equal(await mos.locator('[data-mos-select]:checked').count(),3);assert.equal(await mos.locator('[data-mos-select="QA Other"],[data-mos-select="QA Archived MOS"]').count(),0)
   await mos.locator('[data-mos-select-all]').uncheck();assert.equal(await mos.locator('[data-mos-select]:checked').count(),0);assert.equal(await submit().count(),0)
   await select('QA Passport').check();await select('QA Insurance').click({modifiers:['Shift']});assert.equal(await mos.locator('[data-mos-select]:checked').count(),3);assert.equal(await dialog().count(),0);await mos.locator('[data-mos-select-all]').uncheck()
   await select('QA Passport').check();await select('QA Photo').check();await mos.locator('[data-mos-bulk-date]').fill('2026-10-08')
   await mos.screenshot({path:path.join(shots,'04-mos-multi-selection.png')})
   report.checks.separateKeyboardSelectionSelectOneSeveralAllEligibleOnly='PASS';report.checks.historicalMosDateDefaultAndExplicitPicker='PASS'
   await page.route('**'+listUrl,async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='submitMos')await route.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic failure"}'});else await route.continue()})
   await submit().click();await mos.locator('[role=alert]').waitFor();assert.equal(await mos.locator('[data-mos-select]:checked').count(),2);assert.equal(await mos.locator('[data-checklist-mos-group=needed] [data-checklist-item]').count(),3);assert.equal(await mos.locator('[data-checklist-mos-group=submitted] [data-checklist-item]').count(),0)
   await page.unroute('**'+listUrl)
   let release,started,requests=0,navigations=0;const gate=new Promise(r=>release=r),requestStarted=new Promise(r=>started=r);page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())navigations++})
   await page.route('**'+listUrl,async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='submitMos'){requests++;started();await gate}await route.continue()})
   await submit().evaluate(button=>{button.click();button.click()});await requestStarted;assert.equal(await submit().isDisabled(),true);assert.equal(await select('QA Passport').isDisabled(),true);release()
   await mos.locator('[data-checklist-mos-group=submitted] [data-checklist-item="QA Passport"]').waitFor();await page.unroute('**'+listUrl)
   assert.equal(requests,1);assert.equal(navigations,0);assert.equal(await mos.locator('[data-checklist-mos-group=submitted] [data-checklist-item]').count(),2);assert.equal(await mos.locator('[data-checklist-mos-group=needed] [data-checklist-item]').count(),1)
   const afterBulk=(await get()).items.find(i=>i.name==='QA Passport');assert.equal(afterBulk.id,beforeBulk.id);assert.equal(afterBulk.note,beforeBulk.note);assert.equal(afterBulk.files[0].id,file.id);assert.equal(afterBulk.receivedAt,beforeBulk.receivedAt);assert.equal(afterBulk.mosSubmittedAt.slice(0,10),'2026-10-08');assert.equal((await req('get',`/api/cases/${c.id}`)).updatedAt,caseUpdatedAt)
   assert.equal(await db.notification.count({where:{entityId:c.id,type:'documents_ready'}}),1);assert.equal(await db.task.count({where:{organizationId:org.id,description:{contains:c.id}}}),tasksBeforeBulk)
   await mos.screenshot({path:path.join(shots,'05-mos-after-bulk.png')})
   await select('QA Insurance').check();assert.equal(await mos.locator('[data-mos-bulk-date]').inputValue(),'2026-10-09');await submit().click();await mos.locator('[data-mos-select-all]').waitFor({state:'hidden'});assert.equal(await db.notification.count({where:{entityId:c.id,type:'documents_ready'}}),1)
   report.checks.bulkFailureKeepsSelectionAndGroupsRetryNoDoubleSubmit='PASS';report.checks.atomicUiGroupMovementDateNotesFilesReadinessDedupe='PASS'
   const second=await req('post','/api/cases',{clientId:client.id,serviceId:service.id,assignedToId:user.id,caseNumber:'SECOND-'+suffix}),secondUrl=`/api/cases/${second.id}/checklist`
   let secondData=await req('get',secondUrl),ids=secondData.items.filter(i=>i.forMos).map(i=>i.id),other=secondData.items.find(i=>!i.forMos),beforeStatuses=secondData.items.map(i=>[i.id,i.status])
   for(const body of [{action:'submitMos',itemIds:[ids[0],other.id],submittedAt:'2026-10-09',expectedVersion:secondData.version},{action:'submitMos',itemIds:[ids[0],afterBulk.id],submittedAt:'2026-10-09',expectedVersion:secondData.version}])await req('post',secondUrl,body,409)
   for(const body of [{action:'submitMos',itemIds:ids,submittedAt:'2026-02-30',expectedVersion:secondData.version},{action:'submitMos',itemIds:ids,submittedAt:'2099-01-01',expectedVersion:secondData.version},{action:'submitMos',itemIds:[ids[0],ids[0]],submittedAt:'2026-10-09',expectedVersion:secondData.version}])await req('post',secondUrl,body,400)
   await req('post',secondUrl,{action:'submitMos',itemIds:ids,submittedAt:'2026-10-09'},428)
   assert.deepEqual((await req('get',secondUrl)).items.map(i=>[i.id,i.status]),beforeStatuses)
   const races=await Promise.all([api.post(origin+secondUrl,{data:{action:'submitMos',itemIds:ids.slice(0,2),submittedAt:'2026-10-09',expectedVersion:secondData.version}}),api.post(origin+secondUrl,{data:{action:'submitMos',itemIds:ids.slice(0,2),submittedAt:'2026-10-09',expectedVersion:secondData.version}})])
   assert.deepEqual(races.map(r=>r.status()).sort(),[200,409]);assert.equal((await req('get',secondUrl)).items.filter(i=>i.status==='SUBMITTED_TO_MOS').length,2)
   const foreign=await db.organization.create({data:{name:'Foreign isolated QA',slug:'foreign-followup-'+suffix}}),outsider=await db.user.create({data:{organizationId:foreign.id,name:'Other QA',role:'owner',email:`other-followup-${suffix}@example.invalid`,password:user.password}}),otherContext=await browser.newContext()
   const foreignLogin=await otherContext.request.post(origin+'/api/auth/login',{data:{email:outsider.email,password}});assert.equal(foreignLogin.status(),200)
   assert.equal((await otherContext.request.post(origin+secondUrl,{data:{action:'submitMos',itemIds:ids,submittedAt:'2026-10-09',expectedVersion:0}})).status(),404);await otherContext.close()
   report.checks.bulkInvalidSelectionDatesCASRollbackAndCrossTenantDenied='PASS'
   const matrixCase=await req('post','/api/cases',{clientId:client.id,serviceId:service.id,caseNumber:'MATRIX-'+suffix}),matrixUrl=`/api/cases/${matrixCase.id}/checklist`
   report.viewports=[]
   for(const width of [390,414,430,1024,1280,1440,1920])for(const lang of ['ru','uk','pl'])for(const theme of ['light','dark','slate']){
    await page.setViewportSize({width,height:1000});await page.goto(origin+`/cases/${matrixCase.id}?tab=docs`);await page.evaluate(({lang,theme})=>{localStorage.setItem('rezi_lang',lang);localStorage.setItem('rezi_theme',theme);document.documentElement.dataset.theme=theme;window.dispatchEvent(new CustomEvent('langchange',{detail:lang}))},{lang,theme})
    const docs=page.locator('[data-document-checklist=documents]:visible');await docs.locator('[data-checklist-item]').first().waitFor()
    if(width<769){const title=docs.locator('[class*=mobileHeading]');assert.equal(await title.isVisible(),true);assert.equal(await title.evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.equal(await title.evaluate(el=>getComputedStyle(el).textTransform),'none');assert.equal(await docs.locator('[class*=desktopHeading]').isVisible(),false)}
    else {const heading=docs.locator('.section-title'),clientHeading=page.locator('[data-client-documents]:visible .section-title').first();for(const property of ['fontSize','fontWeight','letterSpacing','textTransform','color'])assert.equal(await heading.evaluate((el,p)=>getComputedStyle(el)[p],property),await clientHeading.evaluate((el,p)=>getComputedStyle(el)[p],property));assert.ok((await heading.textContent()).includes('📁'))}
    const badge=docs.locator('[data-checklist-file-state]').first();assert.equal(await badge.evaluate(el=>getComputedStyle(el).cursor),'default');assert.equal(await badge.getAttribute('role'),null)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    await page.goto(origin+`/cases/${matrixCase.id}`);mos=await openMos();await mos.locator('[data-mos-select="QA Passport"]').check();await mos.locator('[data-mos-select="QA Photo"]').check();assert.equal(await mos.locator('[data-mos-bulk-date]').inputValue(),new Date().toISOString().slice(0,10));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
    assert.equal(await mos.locator('[data-mos-select]:checked').count(),2);assert.ok((await mos.locator('[data-mos-select]').first().getAttribute('aria-label')).length>10)
    if(width===390&&lang==='uk'&&theme==='slate'){await mos.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'06-mobile-smoke.png')})}
    report.viewports.push({width,lang,theme,heading:'PASS',informationalBadges:'PASS',bulkToolbar:'PASS',overflow:false})
   }
   report.checks.headingDesktopCRMMatchMobileUnchangedAndBadgesInformational='PASS';report.checks.responsiveLanguagesThemesBulkToolbar='PASS'
   report.screenshots=(await fs.readdir(shots)).filter(f=>f.endsWith('.png')).sort();assert.equal(report.screenshots.length,6);assert.deepEqual(report.errors,[])
  }
  console.log(JSON.stringify(report.fileAudit))
 }finally{await fs.mkdir('.qa/followup-ux',{recursive:true});await fs.writeFile('.qa/followup-ux/'+report.mode+'.json',JSON.stringify(report,null,2));if(report.mode!=='audit')await fs.writeFile('docs/document-checklist-v2-followup-qa.json',JSON.stringify(report,null,2)+'\n');await browser.close();await db.$disconnect()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
