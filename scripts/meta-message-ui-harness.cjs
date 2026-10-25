// Frontend-only actual-component review. No database/auth/provider or repository env.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'work/meta-ui-harness')
const write=(file,text)=>{const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text)}
const source=file=>JSON.stringify(path.join(root,'src',file))
write('package.json',JSON.stringify({private:true}))
write('tsconfig.json',JSON.stringify({compilerOptions:{allowJs:true,jsx:'preserve',moduleResolution:'bundler',esModuleInterop:true,paths:{'@/*':[root+'/src/*']}},exclude:['node_modules']}))
write('next.config.js',`module.exports={experimental:{externalDir:true},webpack(c){c.resolve.alias['@']=${JSON.stringify(root+'/src')};return c}}`)
if(!fs.existsSync(path.join(dir,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir')
write('app/layout.js',`import Link from 'next/link';import ${source('app/globals.css')};import UI from ${source('components/AuthenticatedUIProvider')};import Sidebar from ${source('components/layout/Sidebar')};import MobileNav from ${source('components/layout/MobileNav')};export default function Layout({children}){return <html><body><UI><div style={{display:'flex'}}><Sidebar userName="Synthetic Reviewer" userRole="owner" organizationName="UI ONLY"/><main className="main-content" style={{flex:1}}><aside style={{padding:8,fontSize:12}}>UI ONLY · in-memory fixtures · no security/DB evidence · <a href="/review">Synthetic controls</a> · <Link data-review-next href="/leads/synthetic-0">Lead A</Link> · <Link data-review-next href="/leads/synthetic-0?conversation=1">Dialog A</Link> · <Link data-review-next href="/leads/synthetic-1?conversation=1">Dialog B</Link></aside>{children}</main></div><MobileNav/></UI></body></html>}`)
write('app/leads/layout.js',`import {LeadMobileAccessProvider} from ${source('app/leads/LeadMobileAccessContext')};export default function Layout({children}){return <LeadMobileAccessProvider userId={1} organizationId="synthetic-ui" restrictedAccess={false}>{children}</LeadMobileAccessProvider>}`)
for(const route of ['leads','leads/[id]','settings/notifications'])write(`app/${route}/page.js`,`export {default} from ${source('app/'+route+'/page')}`)
write('app/page.js',`import {redirect} from 'next/navigation';export default function Page(){redirect('/leads')}`)
write('app/api/[...path]/route.js',fs.readFileSync(path.join(root,'scripts/fixtures/meta-message-ui-api.js'),'utf8'))
write('app/review/page.js',`'use client';import Link from 'next/link';export default function Review(){async function action(action){await fetch('/api/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});window.dispatchEvent(new Event(action==='off'||action==='on'?'meta-preferences-changed':'meta-messages-read'))}return <div style={{padding:24}}><h1>Synthetic Meta controls · UI only</h1>{['incoming','burst','read','on','off','reset'].map(x=><button className="btn btn-secondary" key={x} onClick={()=>action(x)}>{x}</button>)}<p><Link href="/leads">Lead list</Link> · <Link href="/leads/synthetic-0?conversation=1">Conversation</Link> · <Link href="/settings/notifications">Actual settings</Link></p></div>}`)
const env={NEXT_TELEMETRY_DISABLED:'1',NOTIFICATIONS_ENABLED:'true'}
for(const key of ['PATH','HOME','TMPDIR','TEMP','TMP','SystemRoot','NODE_EXTRA_CA_CERTS'])if(process.env[key])env[key]=process.env[key]
console.log('UI ONLY: http://127.0.0.1:3129/leads · /review controls · server memory only; restart resets. Never publish/tunnel.')
if(process.argv.includes('--prepare-only'))process.exit(0)
const r=cp.spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--hostname','127.0.0.1','--port','3129'],{cwd:dir,env,stdio:'inherit'});process.exit(r.status??1)
