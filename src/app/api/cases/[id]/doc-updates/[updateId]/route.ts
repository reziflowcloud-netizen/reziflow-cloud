import {NextRequest,NextResponse} from 'next/server'
import {getUser} from '@/lib/auth'
import {writeDocUpdate,DocUpdateError} from '@/lib/docUpdateWrite'
async function write(req:NextRequest,params:{id:string;updateId:string},kind:'edit'|'delete'){
 const user=await getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 try{const body=kind==='edit'?await req.json():{reminderLanguage:req.headers.get('X-LegalHub-Reminder-Language'),expectedUpdatedAt:req.headers.get('X-LegalHub-Case-Version')||undefined};return NextResponse.json(await writeDocUpdate(user,params.id,kind,body,Number(params.updateId)))}
 catch(e){return NextResponse.json({error:e instanceof DocUpdateError?e.message:'Unable to save document update'},{status:e instanceof DocUpdateError?e.status:e instanceof SyntaxError?400:500})}
}
export async function DELETE(req:NextRequest,{params}:{params:{id:string;updateId:string}}){return write(req,params,'delete')}
export async function PATCH(req:NextRequest,{params}:{params:{id:string;updateId:string}}){return write(req,params,'edit')}
