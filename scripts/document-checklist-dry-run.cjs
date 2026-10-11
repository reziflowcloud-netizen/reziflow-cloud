// Read-only aggregate audit. Requires an explicit local QA connection; prints no client/file details.
const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
const url = new URL(process.env.DATABASE_URL || '')
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.includes('_qa'), 'Only a local QA database is accepted')
const db = new PrismaClient()
async function main() {
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    const options = await tx.caseOption.findMany({ where: { type: { startsWith: 'mosDocument' } }, select: { organizationId: true, type: true, value: true } })
    const tasks = await tx.task.findMany({ where: { description: { contains: 'mosDocument' } }, select: { organizationId: true, status: true, description: true } })
    const cases = await tx.case.findMany({ select: { id: true, organizationId: true, checklistInitializedAt: true } })
    const stats = { source: 'isolated-local-qa', mode: 'READ ONLY', templateRecords: options.length, generalTemplateRecords: options.filter(item => item.type === 'mosDocument').length, serviceTemplateRecords: options.filter(item => item.type !== 'mosDocument').length, mosTaskRecords: tasks.length, submittedRecords: 0, validCaseReferences: 0, invalidOrCrossTenantReferences: 0, missingSubmittedDate: 0, uninitializedCases: cases.filter(item => !item.checklistInitializedAt).length }
    for (const task of tasks) {
      let meta; try { meta = JSON.parse(task.description || '{}').mosDocument } catch { stats.invalidOrCrossTenantReferences++; continue }
      if (!meta || !cases.some(item => item.id === meta.caseId && item.organizationId === task.organizationId)) { stats.invalidOrCrossTenantReferences++; continue }
      stats.validCaseReferences++
      if (meta.sentAt || task.status === 'done') { stats.submittedRecords++; if (!meta.sentAt) stats.missingSubmittedDate++ }
    }
    return stats
  }, { isolationLevel: 'RepeatableRead' })
  console.log(JSON.stringify(result, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
