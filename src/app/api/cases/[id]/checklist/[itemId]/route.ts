import { NextRequest } from 'next/server'
import { withCaseChecklist, expectedChecklistVersion } from '@/lib/checklistApi'
import { updateChecklistReadiness, checklistPayload } from '@/lib/documentChecklist'
import { CHECKLIST_STATUSES, ChecklistError, checklistDate } from '@/lib/documentChecklistPolicy'

export async function PATCH(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await request.json().catch(() => ({}))
  return withCaseChecklist(params.id, true, async (db, record) => {
    const item = await db.caseChecklistItem.findFirst({ where: { id: params.itemId, caseId: record.id, active: true } })
    if (!item) throw new ChecklistError('Not found', 404)
    expectedChecklistVersion(body.expectedVersion, item.version)
    const allowed = new Set(['expectedVersion', 'status', 'note', 'submittedAt'])
    if (Object.keys(body).some(key => !allowed.has(key))) throw new ChecklistError('Invalid field')
    const data: any = { version: { increment: 1 } }
    if ('note' in body) {
      if (body.note !== null && (typeof body.note !== 'string' || body.note.length > 2000)) throw new ChecklistError('Invalid note')
      data.note = body.note || null
    }
    if ('submittedAt' in body) {
      if ((body.status || item.status) === 'SUBMITTED_TO_MOS') data.mosSubmittedAt = checklistDate(body.submittedAt)
      else if (body.submittedAt === '' || body.submittedAt === null) data.mosSubmittedAt = null
      else throw new ChecklistError('Submission date needs MOS status')
    }
    if ('status' in body) {
      if (!CHECKLIST_STATUSES.includes(body.status) || body.status === 'SUBMITTED_TO_MOS' && !item.forMos) throw new ChecklistError('Invalid status')
      data.status = body.status
      data.receivedAt = body.status === 'NEEDED' ? null : item.receivedAt || new Date()
      data.mosSubmittedAt = body.status === 'SUBMITTED_TO_MOS' ? ('submittedAt' in body ? checklistDate(body.submittedAt) : item.mosSubmittedAt || new Date()) : null
    }
    await db.caseChecklistItem.update({ where: { id: item.id }, data })
    await updateChecklistReadiness(db, record.id)
    const result = await checklistPayload(db, record.id)
    return { ...result, item: result.items.find(row => row.id === item.id) }
  })
}
// Archive is an explicit action; uploaded files and historical timestamps remain intact.
export async function DELETE(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await request.json().catch(() => ({}))
  return withCaseChecklist(params.id, true, async (db, record) => {
    const item = await db.caseChecklistItem.findFirst({ where: { id: params.itemId, caseId: record.id } })
    if (!item) throw new ChecklistError('Not found', 404)
    expectedChecklistVersion(body.expectedVersion, item.version)
    await db.caseChecklistItem.update({ where: { id: item.id }, data: { active: false, version: { increment: 1 } } })
    await updateChecklistReadiness(db, record.id)
    return checklistPayload(db, record.id)
  })
}
