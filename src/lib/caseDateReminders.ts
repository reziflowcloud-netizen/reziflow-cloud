import type { Prisma } from '@prisma/client'
import { normalizeLang, T } from '@/lib/translations'

// Called only after claiming the Case version, within that same transaction.
export async function syncCaseDateReminders(db: Prisma.TransactionClient, organizationId: string, record: any, body: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)
  if (!['filingDate', 'mosSentAt', 'fingerprintsDate', 'predictedDecisionDate'].some(has)) return
  const copy = T[normalizeLang(body.reminderLanguage)]
  const label = record.caseNumber || copy.no_number
  const tasks = await db.task.findMany({ where: { organizationId, description: { contains: `"caseId":"${record.id}"` } } })
  const meta = (task: any) => { try { return JSON.parse(task.description || '{}') } catch { return {} } }
  const day = (value: Date | string) => new Date(value).toISOString().slice(0, 10)
  const offset = (value: Date | string, days: number) => { const date = new Date(`${day(value)}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return day(date) }
  async function sync(key: string, date: string | null, title: string, note: string, extra = {}, kind?: string, createOnly = false) {
    const existing = tasks.filter(task => meta(task)[key]?.caseId === record.id && (!kind || meta(task)[key]?.kind === kind))
    if (createOnly && existing.length) return
    if (!date) {
      if (existing.length) await db.task.deleteMany({ where: { organizationId, id: { in: existing.map(task => task.id) } } })
      return
    }
    const data = {
      organizationId, title, dueDate: new Date(`${date}T00:00:00Z`),
      priority: existing[0]?.priority || 'Нормально', status: existing[0]?.status || 'todo',
      clientName: `${record.client?.firstName || ''} ${record.client?.lastName || ''}`.trim() || null,
      assignedToId: record.assignedToId || null,
      description: JSON.stringify({ reminderAt: `${date}T09:00`, reminderNote: `${note} ${label}`, [key]: { caseId: record.id, caseNumber: record.caseNumber || null, ...extra, ...(kind ? { kind } : {}) } }),
    }
    if (existing[0]) await db.task.update({ where: { id: existing[0].id }, data })
    else await db.task.create({ data })
  }
  if (has('filingDate') || has('mosSentAt')) {
    const organization = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } })
    const base = record.filingDate || record.mosSentAt
    if (base && (organization?.settings as any)?.mosAutoRemindersEnabled !== false) {
      for (const [kind, days, title, note] of [
        ['documents_2w', 14, 'deliver_documents', 'after_filing_2w'],
        ['id_1m', 30, 'get_id_to_mos', 'after_filing_1m'],
        ['cabinet_login_2m', 60, 'ask_cabinet_credentials', 'after_filing_2m'],
        ['check_status_4m', 120, 'check_cabinet_status', 'after_filing_4m'],
      ] as const) await sync('autoReminder', offset(base, days), copy[title], copy[note], {}, kind, true)
    }
  }
  if (has('fingerprintsDate')) await sync('fingerprintsAppointment', record.fingerprintsDate ? day(record.fingerprintsDate) : null, copy.fingerprints_task_title, copy.fingerprints_task_note)
  if (has('predictedDecisionDate')) {
    const date = record.predictedDecisionDate ? day(record.predictedDecisionDate) : null
    await sync('predictedDecision', date, 'Przewidywana data wydania decyzji', copy.expected_decision_note)
    await sync('predictedDecisionDocuments', date ? offset(date, -45) : null, copy.deliver_extra_documents_office, copy.deliver_extra_documents_note, { predictedDecisionDate: date, daysBefore: 45 })
  }
}
