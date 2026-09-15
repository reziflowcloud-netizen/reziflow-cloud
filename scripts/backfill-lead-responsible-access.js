const { PrismaClient } = require('@prisma/client')
const { planLeadResponsibleBackfill } = require('../src/lib/employeeUserResolver')

const prisma = new PrismaClient()
const args = new Map(process.argv.slice(2).map(argument => {
  const [key, ...value] = argument.split('=')
  return [key, value.join('=')]
}))
const organizationId = String(args.get('--organization-id') || '').trim()
const apply = args.has('--apply')
const confirmed = args.get('--confirm') === 'APPLY_LEAD_RESPONSIBLE_BACKFILL'

function printCounts(mode, counts, applied = 0) {
  console.log(JSON.stringify({ mode, ...counts, applied }, null, 2))
}

async function main() {
  if (!organizationId) throw new Error('--organization-id is required')
  if (apply && !confirmed) {
    throw new Error('--apply requires --confirm=APPLY_LEAD_RESPONSIBLE_BACKFILL')
  }

  const [leads, employees, users] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId, employeeId: { not: null } },
      select: { id: true, employeeId: true, assignedToId: true },
    }),
    prisma.employee.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true },
    }),
  ])

  const plan = planLeadResponsibleBackfill({ leads, employees, users })
  if (!apply) {
    printCounts('DRY_RUN', plan.counts)
    return
  }

  let applied = 0
  for (let index = 0; index < plan.updates.length; index += 100) {
    const chunk = plan.updates.slice(index, index + 100)
    const results = await prisma.$transaction(chunk.map(update => prisma.lead.updateMany({
      where: {
        id: update.leadId,
        organizationId,
        employeeId: update.employeeId,
        assignedToId: update.previousAssignedToId,
      },
      data: { assignedToId: update.assignedToId },
    })))
    applied += results.reduce((total, result) => total + result.count, 0)
  }

  printCounts('APPLY', plan.counts, applied)
}

main()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
