import { NextRequest } from 'next/server'
import { withCaseChecklist, expectedChecklistVersion } from '@/lib/checklistApi'
import { checklistPayload } from '@/lib/documentChecklist'
import { ChecklistError } from '@/lib/documentChecklistPolicy'
export async function POST(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const body = await request.json().catch(() => ({}))
  return withCaseChecklist(params.id, true, async (db, record) => {
    const item = await db.caseChecklistItem.findFirst({ where: { id: params.itemId, caseId: record.id, active: true } })
    if (!item) throw new ChecklistError('Not found', 404)
    expectedChecklistVersion(body.expectedVersion, item.version)
    if (!Number.isInteger(body.documentId)) throw new ChecklistError('Invalid document')
    const file = await db.caseDocument.findFirst({ where: { id: body.documentId, caseId: record.id } })
    if (!file) throw new ChecklistError('Not found', 404)
    if (file.checklistItemId && file.checklistItemId !== item.id) throw new ChecklistError('File already linked to another document', 409)
    await db.caseDocument.update({ where: { id: file.id }, data: { checklistItemId: body.unlink ? null : item.id } })
    await db.caseChecklistItem.update({ where: { id: item.id }, data: { version: { increment: 1 } } })
    await db.$executeRaw`UPDATE "Case" SET "checklistVersion" = "checklistVersion" + 1 WHERE id = ${record.id}`
    return checklistPayload(db, record.id)
  })
}
