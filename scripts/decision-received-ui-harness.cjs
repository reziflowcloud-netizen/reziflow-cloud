// Frontend-only actual-component review. No Prisma, database, authentication backend or repository env reads.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'work','decision-ui-harness');
const write=(file,text)=>{const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text)};
const source=file=>JSON.stringify(path.join(root,'src',file).replaceAll('\\','/'));
write('package.json',JSON.stringify({private:true,scripts:{dev:'next dev'}}));
write('tsconfig.json',JSON.stringify({compilerOptions:{allowJs:true,jsx:'preserve',moduleResolution:'bundler',esModuleInterop:true,paths:{'@/*':[root.replaceAll('\\','/')+'/src/*']}},exclude:['node_modules']}));
write('next.config.js',`module.exports={experimental:{externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(root.replaceAll('\\','/')+'/src')};return config}}`);
if(!fs.existsSync(path.join(dir,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
write('app/layout.js',`import ${source('app/globals.css')};export default function Layout({children}){return <html><body>{children}</body></html>}`);
write('app/cases/layout.js',`import UI from ${source('components/AuthenticatedUIProvider')};import Sidebar from ${source('components/layout/Sidebar')};import MobileNav from ${source('components/layout/MobileNav')};import {CaseMobileAccessProvider} from ${source('app/cases/CaseMobileAccessContext')};export default function Layout({children}){return <UI><div style={{display:'flex'}}><Sidebar userName="Synthetic Reviewer" userRole="owner" organizationName="UI ONLY · SYNTHETIC"/><div className="main-content" style={{flex:1}}><aside style={{padding:8,color:'var(--text)',background:'var(--surface)',fontSize:12}}>UI-only synthetic review · server-memory data · no database/security evidence</aside><CaseMobileAccessProvider restrictedAccess={false}>{children}</CaseMobileAccessProvider></div></div><MobileNav/></UI>}`);
write('app/cases/[id]/page.js',`export {default} from ${source('app/cases/[id]/page')}`);
write('app/cases/page.js',`import Link from 'next/link';export default function Cases(){return <div style={{padding:24}}><h1>Synthetic cases · UI only</h1><Link href="/cases/synthetic-decision">Open synthetic decision Case</Link></div>}`);
write('app/page.js',`import {redirect} from 'next/navigation';export default function Page(){redirect('/cases/synthetic-decision')}`);
write('app/api/[...path]/route.js',`import {NextResponse} from 'next/server';import {cookies} from 'next/headers';
export const dynamic='force-dynamic';
const initial=()=>({id:'synthetic-decision',organizationId:'synthetic-ui',caseNumber:'SYNTHETIC-UI',clientId:'synthetic-client',assignedToId:1,status:'Новый',totalValue:0,contractValue:0,mosNumber:'SYNTHETIC-MOS',mosSentByPost:true,mosSentAt:null,predictedDecisionDate:'2027-02-03T00:00:00.000Z',decisionReceived:false,notes:'Synthetic legacy MOS values',createdAt:'2026-10-23T00:00:00.000Z',updatedAt:'2026-10-23T00:00:00.000Z',client:{id:'synthetic-client',firstName:'Synthetic',lastName:'Review',phones:[],customFieldValues:[]},payments:[],comments:[],statusHistory:[],customDates:[],docUpdates:[],caseDocuments:[],customFieldValues:{}});
const memory=()=>globalThis.__decisionReceiptUiQa||(globalThis.__decisionReceiptUiQa={record:initial(),fail:false});
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const local=request=>['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname);
export async function GET(request,{params}){if(!local(request))return json({error:'Loopback only'},403);const p=params.path.join('/'),m=memory();let data=[];
if(p==='cases/synthetic-decision')data=m.record;
else if(p==='cases')data=[m.record];
else if(p==='cases/synthetic-decision/checklist')data={initialized:false,version:0,items:[],archivedItems:[],progress:{required:0,received:0,missing:0},legacyPreview:[]};
else if(p==='auth/me')data={id:Number(cookies().get('qa-user')?.value||1),organizationId:'synthetic-ui',name:'Synthetic Reviewer',role:'owner'};
else if(p==='statuses')data=[{id:1,name:'Новый',color:'#06b6d4'}];
else if(p==='organization-settings')data={settings:{mosAutoRemindersEnabled:false}};
else if(p==='ui-section-settings')data={settings:[],canManage:false};
else if(p==='custom-field-values')data={sections:[],values:{}};
else if(p==='document-templates')data={templates:[]};
else if(p==='notifications/preferences')data={preferences:{},canReceiveTeam:false,pushAvailable:false,devices:0};
else if(p==='notifications/meta-messages')data={count:0,items:[]};
return json(data)}
export async function PATCH(request,{params}){if(!local(request))return json({error:'Loopback only'},403);const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==request.headers.get('host'))return json({error:'Origin mismatch'},403);if(params.path.join('/')!=='cases/synthetic-decision')return json({error:'Unsupported synthetic action'},405);const body=await request.json(),m=memory();if(m.fail)return json({error:'Intentional mock failure'},503);if('decisionReceived' in body&&typeof body.decisionReceived!=='boolean')return json({error:'Invalid boolean'},400);if(body.expectedUpdatedAt!==m.record.updatedAt)return json({error:'CASE_CONFLICT'},409);const allowed=['decisionReceived','predictedDecisionDate','mosNumber','notes','caseNumber'];const patch=Object.fromEntries(Object.entries(body).filter(([key])=>allowed.includes(key)));m.record={...m.record,...patch,updatedAt:new Date(Math.max(Date.now(),Date.parse(m.record.updatedAt)+1)).toISOString()};return json(m.record)}
export async function POST(request,{params}){if(!local(request))return json({error:'Loopback only'},403);if(params.path.join('/')!=='mock/control')return json({error:'Unsupported synthetic action'},405);const body=await request.json(),m=memory();if(body.action==='reset'){m.record=initial();m.fail=false}if(body.action==='fail')m.fail=true;if(body.action==='recover')m.fail=false;if(body.action==='external'){m.record={...m.record,notes:'Synthetic external edit',updatedAt:new Date(Math.max(Date.now(),Date.parse(m.record.updatedAt)+1)).toISOString()}}return json({mock:true,fail:m.fail})}
export async function PUT(){return json({error:'Unsupported synthetic action'},405)};export const DELETE=PUT;
`);
const env={NEXT_TELEMETRY_DISABLED:'1'};for(const key of ['PATH','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','SystemRoot','COMSPEC','TEMP','TMP','TMPDIR','NODE_EXTRA_CA_CERTS'])if(process.env[key])env[key]=process.env[key];
console.log('UI ONLY · synthetic server-memory fixtures · http://127.0.0.1:3118/cases/synthetic-decision');
console.log('No Prisma/database/authentication server; restart resets fixtures. Do not publish or tunnel.');
if(process.argv.includes('--prepare-only'))process.exit(0);
const result=cp.spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--hostname','127.0.0.1','--port','3118'],{cwd:dir,env,stdio:'inherit'});process.exit(result.status??1);
