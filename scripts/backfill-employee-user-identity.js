const { PrismaClient } = require('@prisma/client')
const { planEmployeeUserIdentityBackfill } = require('../src/lib/employeeUserResolver')

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const columnRows = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Employee' AND column_name = 'userId'
    LIMIT 1
  `)
  const hasUserIdColumn = Array.isArray(columnRows) && columnRows.length > 0
  const [employees, users] = await Promise.all([
    hasUserIdColumn
      ? prisma.employee.findMany({ select: { id: true, organizationId: true, name: true, userId: true } })
      : prisma.employee.findMany({ select: { id: true, organizationId: true, name: true } })
          .then(rows => rows.map(row => ({ ...row, userId: null }))),
    prisma.user.findMany({ select: { id: true, organizationId: true, name: true, email: true } }),
  ])
  const plan = planEmployeeUserIdentityBackfill({ employees, users })
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...plan.counts }, null, 2))
  if (!apply) return
  if (!hasUserIdColumn) throw new Error('Apply requires the staff identity migration to be applied first')

  let applied = 0
  for (const update of plan.updates) {
    const result = await prisma.employee.updateMany({
      where: { id: update.employeeId, organizationId: update.organizationId, userId: null },
      data: { userId: update.userId },
    })
    applied += result.count
  }
  console.log(JSON.stringify({ applied }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
