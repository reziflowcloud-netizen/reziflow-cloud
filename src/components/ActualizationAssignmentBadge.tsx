'use client'
import { actualizationAssignmentLabels, actualizationNeedsAssignment } from '@/lib/documentActualizationPolicy'

export default function ActualizationAssignmentBadge({task,lang,required,compact=false}:{task?:any;lang:string;required?:boolean;compact?:boolean}) {
  if (!required && !actualizationNeedsAssignment(task)) return null
  const label=actualizationAssignmentLabels[lang==='ru'||lang==='pl'?lang:'uk']
  if (compact) return <span data-actualization-requires-assignment data-actualization-compact role="note" aria-label={label} title={label} style={{display:'block',minWidth:0,maxWidth:'45%',flex:'0 1 45%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:9,fontWeight:500,lineHeight:'12px',height:14,boxSizing:'border-box',padding:'0 2px',border:'1px solid var(--border)',borderRadius:3,color:'var(--text)',background:'var(--bg-secondary)'}}>{label}</span>
  return <span data-actualization-requires-assignment style={{display:'inline-block',fontSize:11,fontWeight:500,lineHeight:1.4,maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere',padding:'2px 6px',margin:'2px 4px',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',background:'var(--bg-secondary)'}}>{label}</span>
}
