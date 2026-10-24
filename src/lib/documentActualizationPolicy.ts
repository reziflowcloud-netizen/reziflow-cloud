// Date-only CRM values retain their literal date; timestamp values use Warsaw's day.
export function actualizationDay(value: unknown): string | null {
  if (!(typeof value === 'string' || value instanceof Date)) return null
  if(value instanceof Date && !Number.isFinite(value.getTime()))return null
  const raw = value instanceof Date ? value.toISOString() : value
  if (typeof raw !== 'string') return null
  if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}.*)?$/.test(raw))return null
  const prefix=raw.slice(0,10);const valid=new Date(prefix+'T00:00:00Z');if(!Number.isFinite(valid.getTime())||valid.toISOString().slice(0,10)!==prefix)return null
  const literal = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/)
  if (literal) {
    const d = new Date(literal[1] + 'T00:00:00Z')
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === literal[1] ? literal[1] : null
  }
  const d = new Date(raw)
  if (!Number.isFinite(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-')
}
export function serviceDocUpdate(description: unknown) { return /^__[A-Z0-9_]+__:/i.test(String(description || '').trimStart()) }
export function actualizationDate(record: any, updates: any[] = record.docUpdates || []) {
  const dates = updates.filter(d=>!serviceDocUpdate(d.description)).map(d=>actualizationDay(d.date)).filter(Boolean).sort() as string[]
  const base = dates.at(-1) || actualizationDay(record.predictedDecisionDate)
  if (!base) return null
  const d = new Date(base+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+90)
  return d.toISOString().slice(0,10)
}
export const actualizationTitles = {uk:'Актуалізувати документи',ru:'Актуализировать документы',pl:'Zaktualizować dokumenty'}
export function actualizationRef(task: any): any | null {
  if (!String(task?.id || '').startsWith('case-actualization-')) return null
  try { const ref = JSON.parse(task.description || '{}').documentActualization; return ref?.version === 1 && typeof ref.caseId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ref.cycle) ? ref : null } catch { return null }
}
export function actualizationFinished(task: any) { return ['done','completed'].includes(String(task.status).toLowerCase()) }
export function actualizationSummary(record: any, tasks: any[], now = new Date()) {
  const date = actualizationDate(record)
  const cycle = tasks.find(t=>actualizationRef(t)?.cycle===date)
  return { date, state: record.decisionReceived ? 'stopped' : !date ? 'noDate' : !tasks.length ? 'inactive' : cycle && actualizationFinished(cycle) ? 'completed' : date < actualizationDay(now)! ? 'overdue' : 'next' }
}
