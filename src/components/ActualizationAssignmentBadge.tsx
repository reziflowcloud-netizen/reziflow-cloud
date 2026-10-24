'use client'
import { actualizationAssignmentLabels, actualizationNeedsAssignment } from '@/lib/documentActualizationPolicy'

export default function ActualizationAssignmentBadge({task,lang,required}:{task?:any;lang:string;required?:boolean}) {
  if (!required && !actualizationNeedsAssignment(task)) return null
  return <span data-actualization-requires-assignment style={{display:'inline-block',fontSize:11,fontWeight:500,lineHeight:1.4,maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere',padding:'2px 6px',margin:'2px 4px',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',background:'var(--bg-secondary)'}}>{actualizationAssignmentLabels[lang==='ru'||lang==='pl'?lang:'uk']}</span>
}
