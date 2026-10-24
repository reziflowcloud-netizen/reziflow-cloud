import {prisma} from './prisma'
import {caseWhereForScope, getDataAccessScope} from './apiScope'
import {actualizationDay, serviceDocUpdate} from './documentActualizationPolicy'
import {lockActualizationCase, syncDocumentActualization} from './documentActualization'
export class DocUpdateError extends Error {constructor(public status:number,message:string){super(message)}}
// All writers use Case -> Task ordering; no service records participate in activation.
export async function writeDocUpdate(user:any,caseId:string,kind:'create'|'edit'|'delete',body:any,updateId?:number){
 const organizationId=String(user.organizationId),scope=await getDataAccessScope(user,organizationId)
 if(kind!=='create'&&(!Number.isSafeInteger(updateId)||updateId!<=0))throw new DocUpdateError(400,'Invalid update')
 let date:Date|undefined
 if(kind!=='delete'){
  if(typeof body.description!=='string'||body.description.length>10000||!actualizationDay(body.date))throw new DocUpdateError(400,'Invalid document update')
  date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(body.date)?body.date+'T00:00:00Z':body.date)
  if(!Number.isFinite(date.getTime()))throw new DocUpdateError(400,'Invalid date')
 }
 return prisma.$transaction(async tx=>{
  await lockActualizationCase(tx,organizationId,caseId)
  const record=await tx.case.findFirst({where:caseWhereForScope(scope,organizationId,{id:caseId})})
  if(!record)throw new DocUpdateError(404,'Not found')
  const existing=kind==='create'?await tx.docUpdate.findFirst({where:{caseId,date,description:body.description},orderBy:{id:'asc'}}):await tx.docUpdate.findFirst({where:{id:updateId,caseId}})
  if(kind!=='create'&&!existing)throw new DocUpdateError(404,'Not found')
  // Exact-date/description create replay and no-op edits do not bump CAS or activate.
  if(existing&&(kind==='create'||kind==='edit'&&existing.date.getTime()===date!.getTime()&&existing.description===body.description))return existing
  if(body.expectedUpdatedAt!==undefined&&(typeof body.expectedUpdatedAt!=='string'||record.updatedAt.toISOString()!==body.expectedUpdatedAt))throw new DocUpdateError(409,'CASE_CONFLICT')
  const result=kind==='delete'?await tx.docUpdate.delete({where:{id:existing!.id}}):kind==='edit'?await tx.docUpdate.update({where:{id:existing!.id},data:{date,description:body.description}}):await tx.docUpdate.create({data:{caseId,date:date!,description:body.description}})
  const relevant=(existing&&!serviceDocUpdate(existing.description))||(kind!=='delete'&&!serviceDocUpdate(body.description))
  if(relevant){
   const updated=await tx.case.update({where:{id:caseId},data:{updatedAt:new Date(Math.max(Date.now(),record.updatedAt.getTime()+1))}})
   await syncDocumentActualization(tx,updated,true,body.reminderLanguage)
  }
  return kind==='delete'?{ok:true}:result
 },{timeout:15000})
}
