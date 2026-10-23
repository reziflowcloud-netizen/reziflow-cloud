// Local frontend-only QA: actual repository components, synthetic HTTP responses, no DB/auth server.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'work','leads-responsible-harness')
const write=(file,text)=>{const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text)}
write('package.json',JSON.stringify({private:true,scripts:{dev:'next dev'}}))
write('tsconfig.json',JSON.stringify({compilerOptions:{allowJs:true,jsx:'preserve',moduleResolution:'bundler',esModuleInterop:true,paths:{'@/*':[root+'/src/*']}},exclude:['node_modules']}))
write('next.config.js',`module.exports={experimental:{externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(root+'/src')};return config}}`)
if(!fs.existsSync(path.join(dir,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir')
const source=file=>JSON.stringify(root+'/src/'+file)
write('app/layout.js',`import ${source('app/globals.css')};export default function Layout({children}){return <html><body>{children}</body></html>}`)
write('app/leads/layout.js',`import {cookies} from 'next/headers';import {LeadMobileAccessProvider} from ${source('app/leads/LeadMobileAccessContext')};import UI from ${source('components/AuthenticatedUIProvider')};import Sidebar from ${source('components/layout/Sidebar')};import MobileNav from ${source('components/layout/MobileNav')};export default function Layout({children}){const identity=Number(cookies().get('qa-user')?.value||1);const org=cookies().get('qa-org')?.value||'qa-a';return <UI><div style={{display:'flex'}}><Sidebar userName="Synthetic QA" userRole="owner" organizationName="MOCK QA"/><div className="main-content" style={{flex:1}}><LeadMobileAccessProvider key={identity+org} userId={identity} organizationId={org} restrictedAccess={identity===3}>{children}</LeadMobileAccessProvider></div></div><MobileNav/></UI>}`)
write('app/leads/page.js',`export {default} from ${source('app/leads/page')}`)
write('app/leads/[id]/page.js',`export {default} from ${source('app/leads/[id]/page')}`)
write('app/api/[...path]/route.js',`import {NextResponse} from 'next/server';import {cookies} from 'next/headers';export const dynamic='force-dynamic';export async function GET(request,{params}) {
 const url=new URL(request.url),p=params.path.join('/'),userId=Number(cookies().get('qa-user')?.value||1),organizationId=cookies().get('qa-org')?.value||'qa-a';
 const employees=[{id:11,name:'Synthetic Own',active:true,userId:1},{id:12,name:'Synthetic Other',active:true,userId:2}];
 const leads=employees.map((e,i)=>({id:'synthetic-'+i,firstName:i?'Synthetic Team':'Synthetic Mine',fullName:i?'Synthetic Team':'Synthetic Mine',organizationId,assignedToId:e.userId,employeeId:e.id,employee:e,responsibleName:e.name,status:'Новый',source:'manual',serviceInterest:'QA Interest',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),phones:[],contactHistory:[],messages:[],customFieldValues:[]}));
 let data=[];
 if(p==='staff-scope')data={userId,organizationId,restricted:userId===3,controlVisible:true,mineAvailable:true,employees};
 else if(p==='leads')data=leads.filter(l=>url.searchParams.get('staffScope')==='mine'?l.assignedToId===userId:url.searchParams.get('staffScope')?.startsWith('employee:')?l.employeeId===Number(url.searchParams.get('staffScope').slice(9)):true);
 else if(/^leads\\/synthetic-[01]$/.test(p))data=leads.find(l=>l.id===params.path[1]);
 else if(p==='employees')data=employees;
 else if(p==='lead-statuses')data=[{id:1,name:'Новый',color:'#2563eb'}];
 else if(p==='lead-sources')data={sources:[{value:'manual',label:'Manual',active:true,system:true,order:0}]};
 else if(p==='auth/me')data={id:userId,organizationId,name:'Synthetic QA',role:userId===3?'employee':'owner'};
 else if(p==='organization-settings'||p==='user-preferences'||p==='custom-fields'||p==='notifications/preferences')data={};
 return NextResponse.json(data)
};export async function POST(){return NextResponse.json({error:'Read-only synthetic harness'}, {status:405})};export const PUT=POST;export const PATCH=POST;export const DELETE=POST;`)
console.log('Frontend-only synthetic harness: http://127.0.0.1:3117/leads (no database, no authentication backend)')
const serverEnv={...process.env,NEXT_TELEMETRY_DISABLED:'1'}
// Do not pass database/auth secrets to this frontend-only child process.
for(const key of ['DATABASE_URL','DIRECT_URL','JWT_SECRET']) delete serverEnv[key]
const result=cp.spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--hostname','127.0.0.1','--port','3117'],{cwd:root,env:serverEnv,stdio:'inherit'});process.exit(result.status??1)
