import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const { takeNextChannelAssignment } = require('../src/lib/channelRoundRobin.js')

const runDatabaseTests = process.env.RUN_DB_TESTS === '1'

function splitMigration(sql) {
  const statements = []
  let start = 0
  let inDollarQuote = false
  for (let index = 0; index < sql.length; index += 1) {
    if (sql.slice(index, index + 2) === '$$') {
      inDollarQuote = !inDollarQuote
      index += 1
    } else if (sql[index] === ';' && !inDollarQuote) {
      const statement = sql.slice(start, index + 1).trim()
      if (statement) statements.push(statement)
      start = index + 1
    }
  }
  assert.equal(inDollarQuote, false)
  assert.equal(sql.slice(start).trim(), '')
  return statements
}

for (const routeCount of [0, 1, 3]) test(`expand-only migration preserves ${routeCount} V1 routes`, { skip: !runDatabaseTests }, async () => {
  const prisma = new PrismaClient()
  const schema = `qa_v1_${routeCount}_${Date.now()}`
  const migration = await readFile(resolve(import.meta.dirname, '../prisma/migrations/20260922140000_staff_routing_v2/migration.sql'), 'utf8')
  try {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
      await tx.$executeRawUnsafe('CREATE TABLE "Organization" ("id" TEXT PRIMARY KEY)')
      await tx.$executeRawUnsafe('CREATE TABLE "Employee" ("id" INTEGER NOT NULL, "organizationId" TEXT NOT NULL, CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"), CONSTRAINT "Employee_id_organizationId_key" UNIQUE ("id", "organizationId"))')
      await tx.$executeRawUnsafe('CREATE TABLE "LeadChannelRoute" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "sourceKey" TEXT NOT NULL, "employeeId" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LeadChannelRoute_pkey" PRIMARY KEY ("id"), CONSTRAINT "LeadChannelRoute_employeeId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE)')
      await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "LeadChannelRoute_organizationId_sourceKey_key" ON "LeadChannelRoute"("organizationId", "sourceKey")')
      await tx.$executeRawUnsafe('CREATE INDEX "LeadChannelRoute_organizationId_employeeId_idx" ON "LeadChannelRoute"("organizationId", "employeeId")')
      await tx.$executeRawUnsafe('INSERT INTO "Organization" ("id") VALUES (\'org-v1\')')
      await tx.$executeRawUnsafe('INSERT INTO "Employee" ("id", "organizationId") VALUES (7, \'org-v1\')')
      for (let index = 0; index < routeCount; index += 1) {
        await tx.$executeRawUnsafe(`INSERT INTO "LeadChannelRoute" ("id", "organizationId", "sourceKey", "employeeId") VALUES ('route-${index}', 'org-v1', 'source-${index}', 7)`)
      }
      for (const statement of splitMigration(migration)) {
        await tx.$executeRawUnsafe(statement)
      }
      const routes = await tx.$queryRawUnsafe('SELECT "id", "employeeId", "nextPosition" FROM "LeadChannelRoute" ORDER BY "id"')
      const rows = await tx.$queryRawUnsafe('SELECT "organizationId", "routeId", "employeeId", "position" FROM "LeadChannelRouteMember" ORDER BY "routeId"')
      assert.deepEqual(routes, Array.from({ length: routeCount }, (_, index) => ({ id: `route-${index}`, employeeId: 7, nextPosition: 0 })))
      assert.deepEqual(rows, Array.from({ length: routeCount }, (_, index) => ({ organizationId: 'org-v1', routeId: `route-${index}`, employeeId: 7, position: 0 })))
      // The still-running V1 application can write after expand and V2 can read it.
      await tx.$executeRawUnsafe('INSERT INTO "LeadChannelRoute" ("id", "organizationId", "sourceKey", "employeeId") VALUES (\'route-new\', \'org-v1\', \'new-source\', 7)')
      const newMember = await tx.$queryRawUnsafe('SELECT "employeeId", "position" FROM "LeadChannelRouteMember" WHERE "routeId" = \'route-new\'')
      assert.deepEqual(newMember, [{ employeeId: 7, position: 0 }])
    })
  } finally {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await prisma.$disconnect()
  }
})

test('persistent channel round robin is isolated and concurrency-safe', { skip: !runDatabaseTests }, async () => {
  const prisma = new PrismaClient()
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const created = { organizationIds: [], userIds: [], employeeIds: [] }

  async function createTeam(label, size = 3) {
    const organization = await prisma.organization.create({
      data: { name: `QA ${label}`, slug: `qa-routing-v2-${label}-${suffix}` },
    })
    created.organizationIds.push(organization.id)
    const employees = []
    for (let index = 0; index < size; index += 1) {
      const user = await prisma.user.create({
        data: {
          organizationId: organization.id,
          email: `qa-${label}-${index}-${suffix}@example.invalid`,
          password: 'synthetic-not-a-login',
          name: `QA ${label} ${index + 1}`,
        },
      })
      created.userIds.push(user.id)
      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          name: user.name,
        },
      })
      created.employeeIds.push(employee.id)
      employees.push({ employee, user })
    }
    return { organization, employees }
  }

  async function createRoute(organizationId, sourceKey, employeeIds) {
    return prisma.leadChannelRoute.create({
      data: {
        organizationId,
        sourceKey,
        employeeId: employeeIds[0],
        members: {
          create: employeeIds.slice(1).map((employeeId, index) => ({ employeeId, position: index + 1 })),
        },
      },
    })
  }

  try {
    const teamA = await createTeam('a')
    const teamB = await createTeam('b', 1)
    const idsA = teamA.employees.map(item => item.employee.id)
    const usersA = teamA.employees.map(item => item.user.id)
    const routeA = await createRoute(teamA.organization.id, 'instagram', idsA)

    const threeMemberSequence = []
    for (let index = 0; index < 7; index += 1) {
      threeMemberSequence.push((await takeNextChannelAssignment(prisma, teamA.organization.id, 'instagram')).employeeId)
    }
    assert.deepEqual(threeMemberSequence, [idsA[0], idsA[1], idsA[2], idsA[0], idsA[1], idsA[2], idsA[0]])

    await prisma.leadChannelRoute.update({ where: { id: routeA.id }, data: { nextPosition: 0 } })
    const concurrent = await Promise.all(Array.from({ length: 3 }, () => takeNextChannelAssignment(prisma, teamA.organization.id, 'instagram')))
    assert.deepEqual(concurrent.map(item => item.employeeId).sort((a, b) => a - b), [...idsA].sort((a, b) => a - b))

    const routeB = await createRoute(teamA.organization.id, 'facebook', idsA.slice(0, 2))
    await prisma.leadChannelRoute.update({ where: { id: routeA.id }, data: { nextPosition: 0 } })
    assert.equal((await takeNextChannelAssignment(prisma, teamA.organization.id, 'facebook')).employeeId, idsA[0])
    assert.equal((await takeNextChannelAssignment(prisma, teamA.organization.id, 'instagram')).employeeId, idsA[0])
    assert.equal((await prisma.leadChannelRoute.findUnique({ where: { id: routeB.id } })).nextPosition, 1)

    await createRoute(teamB.organization.id, 'instagram', [teamB.employees[0].employee.id])
    assert.equal((await takeNextChannelAssignment(prisma, teamB.organization.id, 'instagram')).employeeId, teamB.employees[0].employee.id)

    await prisma.employee.update({ where: { id: idsA[1] }, data: { userId: null } })
    await prisma.leadChannelRoute.update({ where: { id: routeA.id }, data: { nextPosition: 1 } })
    const skipped = await takeNextChannelAssignment(prisma, teamA.organization.id, 'instagram')
    assert.deepEqual(skipped, { employeeId: idsA[2], assignedToId: usersA[2] })

    await createRoute(teamA.organization.id, 'website', [idsA[1]])
    assert.equal(await takeNextChannelAssignment(prisma, teamA.organization.id, 'website'), null)

    await createRoute(teamA.organization.id, 'telegram', [idsA[0]])
    const single = await Promise.all(Array.from({ length: 3 }, () => takeNextChannelAssignment(prisma, teamA.organization.id, 'telegram')))
    assert.deepEqual(single.map(item => item.employeeId), [idsA[0], idsA[0], idsA[0]])
  } finally {
    if (created.organizationIds.length) await prisma.leadChannelRoute.deleteMany({ where: { organizationId: { in: created.organizationIds } } })
    if (created.employeeIds.length) await prisma.employee.deleteMany({ where: { id: { in: created.employeeIds } } })
    if (created.userIds.length) await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })
    if (created.organizationIds.length) await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } })
    await prisma.$disconnect()
  }
})
