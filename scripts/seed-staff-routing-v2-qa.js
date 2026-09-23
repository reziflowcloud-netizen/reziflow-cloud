const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const databaseUrl = new URL(String(process.env.DATABASE_URL || ''))
  const databaseName = databaseUrl.pathname.replace(/^\//, '')
  if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname) || databaseName !== 'legalhub_staff_scope_qa') {
    throw new Error('Refusing to seed anything except the isolated localhost QA database')
  }
  const password = String(process.env.QA_ADMIN_PASSWORD || '')
  if (password.length < 12) throw new Error('QA_ADMIN_PASSWORD must contain at least 12 characters')

  const organizationId = 'org_qa_staff_routing_v2'
  const organization = await prisma.organization.upsert({
    where: { slug: 'qa-staff-routing-v2' },
    update: {
      settings: {
        staffScopeFilterEnabled: true,
        leadSources: [
          { value: 'instagram', label: 'Instagram', order: 0 },
          { value: 'facebook', label: 'Facebook', order: 1 },
          { value: 'target', label: 'Meta Ads', order: 2 },
          { value: 'website', label: 'Website', order: 3 },
        ],
      },
    },
    create: {
      id: organizationId,
      name: 'Staff Routing V2 QA',
      slug: 'qa-staff-routing-v2',
      settings: {
        staffScopeFilterEnabled: true,
        leadSources: [
          { value: 'instagram', label: 'Instagram', order: 0 },
          { value: 'facebook', label: 'Facebook', order: 1 },
          { value: 'target', label: 'Meta Ads', order: 2 },
          { value: 'website', label: 'Website', order: 3 },
        ],
      },
    },
  })
  const passwordHash = await bcrypt.hash(password, 10)
  const userSpecs = [
    { email: 'qa.owner.v2@example.invalid', name: 'Owner · Employee A', role: 'owner', restrictedAccess: false },
    { email: 'qa.employee-b.v2@example.invalid', name: 'Employee B', role: 'employee', restrictedAccess: false },
    { email: 'qa.restricted-c.v2@example.invalid', name: 'Restricted Employee C', role: 'employee', restrictedAccess: true },
  ]
  const users = []
  for (const spec of userSpecs) {
    users.push(await prisma.user.upsert({
      where: { email: spec.email },
      update: { ...spec, password: passwordHash, organizationId: organization.id },
      create: { ...spec, password: passwordHash, organizationId: organization.id },
    }))
  }
  const employeeNames = ['Employee A', 'Employee B', 'Restricted Employee C']
  const employees = []
  for (let index = 0; index < employeeNames.length; index += 1) {
    const existing = await prisma.employee.findFirst({ where: { organizationId: organization.id, userId: users[index].id } })
    employees.push(existing || await prisma.employee.create({
      data: { organizationId: organization.id, userId: users[index].id, name: employeeNames[index], active: true },
    }))
  }

  for (const [order, status] of ['Новый', 'В работе', 'Завершен'].entries()) {
    await prisma.caseStatus.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: status } },
      update: { order },
      create: { organizationId: organization.id, name: status, order },
    })
    await prisma.leadStatus.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: status } },
      update: { order },
      create: { organizationId: organization.id, name: status, order },
    })
  }
  for (const [order, priority] of ['Низкий', 'Нормально', 'Высокий'].entries()) {
    await prisma.taskPriority.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: priority } },
      update: { order },
      create: { organizationId: organization.id, name: priority, order },
    })
  }
  const service = await prisma.service.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: 'QA Legalization' } },
    update: { active: true },
    create: { organizationId: organization.id, name: 'QA Legalization', active: true, price: 1000 },
  })

  const now = Date.now()
  for (let index = 0; index < employees.length; index += 1) {
    const client = await prisma.client.create({
      data: {
        organizationId: organization.id,
        assignedToId: users[index].id,
        firstName: `Synthetic ${String.fromCharCode(65 + index)}`,
        lastName: 'QA Client',
      },
    })
    await prisma.case.create({
      data: {
        organizationId: organization.id,
        caseNumber: `QA-V2-${index + 1}`,
        clientId: client.id,
        assignedToId: users[index].id,
        employeeId: employees[index].id,
        serviceId: service.id,
        status: index === 2 ? 'В работе' : 'Новый',
        legalStayDeadline: new Date(now + (index + 5) * 86400000),
      },
    })
    await prisma.task.create({
      data: {
        organizationId: organization.id,
        title: `QA V2 task · ${employeeNames[index]}`,
        assignedToId: users[index].id,
        clientName: `Synthetic ${String.fromCharCode(65 + index)} QA Client`,
        dueDate: new Date(now + (index + 1) * 86400000),
        priority: index === 2 ? 'Высокий' : 'Нормально',
      },
    })
  }

  const sources = ['instagram', 'instagram', 'facebook', 'target', 'website', 'manual']
  for (let index = 0; index < sources.length; index += 1) {
    const ownerIndex = index % employees.length
    await prisma.lead.create({
      data: {
        organizationId: organization.id,
        fullName: `Synthetic Lead ${index + 1}`,
        status: index < 4 ? 'Новый' : 'В работе',
        source: sources[index],
        employeeId: employees[ownerIndex].id,
        assignedToId: users[ownerIndex].id,
        serviceInterest: 'QA Legalization',
        nextContactAt: new Date(now + (index + 1) * 3600000),
        deadlineAt: new Date(now + (index + 2) * 86400000),
      },
    })
  }

  await prisma.leadChannelRoute.deleteMany({ where: { organizationId: organization.id } })
  await prisma.leadChannelRoute.create({
    data: {
      organizationId: organization.id,
      sourceKey: 'instagram',
      employeeId: employees[0].id,
      members: { create: [{ employeeId: employees[1].id, position: 1 }] },
    },
  })
  await prisma.leadChannelRoute.create({
    data: {
      organizationId: organization.id,
      sourceKey: 'facebook',
      employeeId: employees[1].id,
    },
  })

  console.log(JSON.stringify({ organization: organization.slug, users: users.length, employees: employees.length, routes: 2 }))
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Unknown QA seed error')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
