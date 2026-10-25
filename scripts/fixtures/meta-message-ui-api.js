// UI-only in-memory fixtures. Does not model authorization, SQL or cryptography.
import { NextResponse } from 'next/server'
import { notificationPreferences } from '@/lib/notificationPolicy'
export const dynamic='force-dynamic'
function initial(){return {receipt:3,reads:{},preferences:notificationPreferences({},true),leads:Array.from({length:35},(_,i)=>({id:`synthetic-${i}`,organizationId:'synthetic-ui',fullName:`Synthetic Lead ${i}`,source:i%2?'instagram':'facebook',status:'Новый',phone:'+48000000000',assignedToId:1,employeeId:1,employee:{id:1,name:'Synthetic Reviewer'},assignedTo:{id:1,name:'Synthetic Reviewer'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),phones:[],leadReminders:[],messages:i<3?[{id:i+1,liveReceipt:i+1,channel:i%2?'instagram':'facebook',direction:'incoming',senderType:'lead',text:'Synthetic incoming',sentAt:new Date().toISOString()}]:[]}))}}
const state=()=>globalThis.__syntheticMetaUI??=initial()
export async function GET(request,{params}){
 const m=state(),p=params.path.join('/'),data=()=>m.leads.map(l=>({...l,metaUnreadCount:l.messages.filter(x=>x.liveReceipt>(m.reads[l.id]||0)).length}))
 if(p==='notifications/meta-messages'){const unread=data().filter(x=>x.metaUnreadCount).sort((a,b)=>Math.max(...b.messages.map(x=>x.liveReceipt||0))-Math.max(...a.messages.map(x=>x.liveReceipt||0)));const total=unread.reduce((n,l)=>n+l.metaUnreadCount,0);return NextResponse.json({enabled:true,userKey:'synthetic-ui:1',latest:m.receipt?{id:m.receipt,leadId:'synthetic-0'}:null,sound:m.preferences.metaMessageSound,visualRevision:JSON.stringify(data().map(l=>[l.id,l.metaUnreadCount])),unread:unread.slice(0,5).map(l=>({leadId:l.id,leadName:l.fullName,count:l.metaUnreadCount,total}))})}
 if(p==='notifications/preferences')return NextResponse.json({preferences:m.preferences,canReceiveTeam:true,pushAvailable:false,devices:0})
 if(p==='notifications/organization')return NextResponse.json({automation:{enabled:false},canManage:false})
 if(p==='notifications')return NextResponse.json({items:[],unread:0,nextCursor:null})
 if(p==='notifications/status')return NextResponse.json({unread:0})
 if(p==='leads')return NextResponse.json(data())
 if(p==='staff-scope')return NextResponse.json({userId:1,organizationId:'synthetic-ui',restricted:false,defaultScope:'all',filterEnabled:true,controlVisible:true,mineAvailable:true,hasEmployeeLink:true,employees:[{id:1,name:'Synthetic Reviewer'}]})
 if(p==='employees')return NextResponse.json([{id:1,userId:1,name:'Synthetic Reviewer',active:true}])
 if(p==='lead-statuses')return NextResponse.json([{id:1,name:'Новый',color:'#3b82f6',order:0}])
 if(p==='lead-sources')return NextResponse.json([{value:'facebook',label:'Facebook',order:0},{value:'instagram',label:'Instagram',order:1}])
 if(p==='auth/me')return NextResponse.json({id:1,name:'Synthetic Reviewer',role:'owner',organizationId:'synthetic-ui'})
 const match=p.match(/^leads\/([^/]+)(?:\/(.+))?$/)
 if(match){const l=data().find(l=>l.id===match[1]);if(!l)return NextResponse.json({error:'Not found'},{status:404});if(match[2]==='messages')return NextResponse.json(l.messages,{headers:{'X-Meta-Message-Snapshot':`${l.id}:${Math.max(0,...l.messages.map(x=>x.liveReceipt||0))}`}});if(match[2])return NextResponse.json([]);return NextResponse.json(l)}
 if(p==='settings')return NextResponse.json({})
 return NextResponse.json([])
}
export async function POST(request,{params}){
 const m=state(),p=params.path.join('/'),b=await request.json().catch(()=>({}))
 if(p==='qa'){if(b.action==='reset')globalThis.__syntheticMetaUI=initial();if(['on','off'].includes(b.action))m.preferences.metaMessageSound=b.action==='on';if(b.action==='read')for(const l of m.leads)m.reads[l.id]=m.receipt;if(['incoming','burst'].includes(b.action))for(let i=0;i<(b.action==='burst'?6:1);i++)m.leads[i].messages.push({id:++m.receipt,liveReceipt:m.receipt,channel:'facebook',direction:'incoming',text:'Synthetic event '+m.receipt,sentAt:new Date().toISOString()});return NextResponse.json({ok:true})}
 const match=p.match(/^leads\/([^/]+)\/messages\/read$/)
 if(match){m.reads[match[1]]=Math.max(m.reads[match[1]]||0,Number(String(b.snapshot).split(':').pop())||0);return NextResponse.json({ok:true})}
 return NextResponse.json({ok:true})
}
export async function PUT(request,{params}){const b=await request.json();if(params.path.join('/')==='notifications/preferences'){state().preferences=notificationPreferences(b,true);return NextResponse.json({preferences:state().preferences})}return NextResponse.json(b)}
export async function PATCH(request,{params}){const b=await request.json();const l=state().leads.find(x=>x.id===params.path[1]);if(l)Object.assign(l,b,{updatedAt:new Date().toISOString()});return NextResponse.json(l||{ok:true})}
