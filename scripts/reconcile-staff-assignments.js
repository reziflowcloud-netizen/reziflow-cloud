// DRY RUN by default. Production APPLY requires an independently reviewed
// dry-run fingerprint plus an explicit local acknowledgment. No name matching.
const crypto = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { planStaffAssignmentReconciliation } = require('../src/lib/staffAssignmentReconciliation')

const apply = process.argv.includes('--apply')
const expectedSummary = process.argv.find(arg => arg.startsWith('--expected-summary='))?.split('=')[1]
if (apply && (process.env.ALLOW_STAFF_RECONCILIATION_APPLY !== 'YES' || !/^[a-f0-9]{64}$/.test(expectedSummary || ''))) {
  throw new Error('APPLY requires ALLOW_STAFF_RECONCILIATION_APPLY=YES and --expected-summary=<dry-run SHA256>')
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be supplied explicitly')

const prisma = new PrismaClient()

async function records(client, table) {
  // Table is a fixed internal constant, never user input.
  return client.$queryRawUnsafe(`
    SELECT r."id", r."organizationId", r."employeeId", r."assignedToId",
      e."id" AS "resolvedEmployeeId", e."organizationId" AS "employeeOrganizationId",
      e."userId" AS "linkedUserId", u."id" AS "resolvedUserId",
      u."organizationId" AS "linkedUserOrganizationId"
    FROM "${table}" r
    LEFT JOIN "Employee" e ON e."id" = r."employeeId"
    LEFT JOIN "User" u ON u."id" = e."userId"
    WHERE r."employeeId" IS NOT NULL
    ORDER BY r."id"
  `)
}

function fingerprint(plans) {
  const planned = ['Lead', 'Case'].flatMap(table => plans[table].updates
    .map(item => [table, item.id, item.organizationId, item.employeeId, item.previousAssignedToId, item.targetUserId]))
  return crypto.createHash('sha256').update(JSON.stringify(planned)).digest('hex')
}

async function loadPlans(client) {
  const [leads, cases] = await Promise.all([records(client, 'Lead'), records(client, 'Case')])
  return {
    Lead: planStaffAssignmentReconciliation(leads),
    Case: planStaffAssignmentReconciliation(cases),
  }
}

async function applyPlan(client, table, updates) {
  let changed = 0
  let concurrentSkip = 0
  for (const item of updates) {
    const employee = await client.employee.findFirst({
      where: { id: item.employeeId, organizationId: item.organizationId, userId: item.targetUserId },
      select: { id: true },
    })
    if (!employee) { concurrentSkip += 1; continue }
    const result = await client[table === 'Lead' ? 'lead' : 'case'].updateMany({
      where: {
        id: item.id,
        organizationId: item.organizationId,
        employeeId: item.employeeId,
        assignedToId: item.previousAssignedToId,
      },
      data: { assignedToId: item.targetUserId },
    })
    if (result.count === 1) changed += 1
    else concurrentSkip += 1
  }
  return { changed, concurrentSkip }
}

async function main() {
  if (!apply) {
    const plans = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      return loadPlans(tx)
    }, { timeout: 90000 })
    console.log(JSON.stringify({
      mode: 'dry-run',
      Lead: plans.Lead.counts,
      Case: plans.Case.counts,
      expectedSummaryForReviewedApply: fingerprint(plans),
    }, null, 2))
    return
  }

  const result = await prisma.$transaction(async tx => {
    const plans = await loadPlans(tx)
    if (fingerprint(plans) !== expectedSummary) throw new Error('Dry-run plan changed; rerun review')
    return {
      Lead: await applyPlan(tx, 'Lead', plans.Lead.updates),
      Case: await applyPlan(tx, 'Case', plans.Case.updates),
    }
  }, { isolationLevel: 'Serializable', timeout: 120000 })
  console.log(JSON.stringify({ mode: 'apply', ...result }, null, 2))
}

main().catch(error => {
  console.error(JSON.stringify({ error: error?.message === 'Dry-run plan changed; rerun review' ? error.message : 'Reconciliation failed', code: error?.code || 'UNKNOWN' }))
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
