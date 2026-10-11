import { NextRequest } from 'next/server'
import { withCaseChecklist, expectedChecklistVersion } from '@/lib/checklistApi'
import { checklistPayload, initializeOrMergeChecklist, updateChecklistReadiness } from '@/lib/documentChecklist'
import { ChecklistError, checklistName, documentNameKey } from '@/lib/documentChecklistPolicy'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  return withCaseChecklist(params.id, false, db => checklistPayload(db, params.id))
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))
  return withCaseChecklist(params.id, true, async (db, record) => {
    expectedChecklistVersion(body.expectedVersion, record.checklistVersion)
    if (body.action === 'initialize' || body.action === 'merge') {
      if (body.serviceId !== record.serviceId) throw new ChecklistError('Service changed; reload', 409)
      await initializeOrMergeChecklist(db, record, body.action === 'merge')
    } else if (body.action === 'keep') {
      if (!record.checklistInitializedAt) throw new ChecklistError('Checklist not initialized')
      if (body.serviceId !== record.serviceId) throw new ChecklistError('Service changed; reload', 409)
      await db.$executeRaw`UPDATE "Case" SET "checklistServiceId" = ${record.serviceId}, "checklistVersion" = "checklistVersion" + 1 WHERE id = ${record.id}`
    } else if (body.action === 'add') {
      if (!record.checklistInitializedAt) throw new ChecklistError('Checklist not initialized')
      const name = checklistName(body.name)
      if (typeof body.required !== 'boolean' || typeof body.forMos !== 'boolean') throw new ChecklistError('Invalid document flags')
      const count = await db.caseChecklistItem.count({ where: { caseId: record.id } })
      if (count >= 200) throw new ChecklistError('Checklist limit reached')
      await db.caseChecklistItem.create({ data: { caseId: record.id, name, nameKey: documentNameKey(name), required: body.required, forMos: body.forMos, sortOrder: count } })
      await updateChecklistReadiness(db, record.id)
    } else throw new ChecklistError('Invalid action')
    return checklistPayload(db, record.id)
  })
}
