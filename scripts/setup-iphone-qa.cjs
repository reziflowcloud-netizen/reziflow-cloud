// Seeds only the explicitly named disposable loopback database. Secrets stay outside Git.
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const connection = new URL(process.env.DATABASE_URL || '')
assert.equal(connection.hostname, '127.0.0.1'); assert.equal(connection.port, '55432'); assert.equal(connection.pathname, '/legalhub_case_qa')
const db = new PrismaClient()
async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'legalhub-iphone-qa-'))
  const password = crypto.randomBytes(18).toString('base64url')
  const email = 'iphone-qa@example.invalid'
  const organization = await db.organization.create({ data: { name: 'ISOLATED iPhone QA — synthetic data', slug: `iphone-qa-${Date.now()}`, settings: { mosEmailFieldEnabled: true } } })
  const user = await db.user.create({ data: { organizationId: organization.id, email, password: await bcrypt.hash(password, 12), name: 'iPhone QA', role: 'owner' } })
  await db.employee.create({ data: { organizationId: organization.id, userId: user.id, name: user.name } })
  const client = await db.client.create({ data: { organizationId: organization.id, firstName: 'Synthetic', lastName: 'iPhone QA', assignedToId: user.id } })
  const service = await db.service.create({ data: { organizationId: organization.id, name: 'QA service', price: 100 } })
  const record = await db.case.create({ data: { organizationId: organization.id, clientId: client.id, assignedToId: user.id, serviceId: service.id, caseNumber: 'IPHONE-QA-001', notes: 'Synthetic QA notes — edit this on iPhone.', personalAppearanceNote: 'Synthetic QA appearance note.' } })
  await db.caseStatus.createMany({ data: ['Новый', 'В работе', 'Ожидание документов', 'Решение получено', 'Архив'].map((name, order) => ({ organizationId: organization.id, name, order })) })
  const section = await db.customSection.create({ data: { organizationId: organization.id, scope: 'case', title: 'Synthetic QA custom fields', fields: { create: [{ label: 'QA text', type: 'text' }, { label: 'QA checkbox', type: 'checkbox' }] } } })
  const state = { workspace: process.cwd(), directory, databaseUrl: connection.toString(), jwtSecret: crypto.randomBytes(48).toString('base64url'), email, password, organizationId: organization.id, caseId: record.id, customSectionId: section.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
  const file = path.join(directory, 'session.json')
  await fs.writeFile(file, JSON.stringify(state, null, 2))
  console.log(JSON.stringify({ stateFile: file, caseId: record.id, expiresAt: state.expiresAt }))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
