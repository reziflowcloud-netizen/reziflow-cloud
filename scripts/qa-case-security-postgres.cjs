const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const connection = new URL(process.env.DATABASE_URL || '')
assert.equal(connection.hostname, '127.0.0.1'); assert.equal(connection.port, '55432'); assert.equal(connection.pathname, '/legalhub_case_qa')
const db = new PrismaClient()
const origin = process.env.LEGALHUB_QA_ORIGIN || 'http://127.0.0.1:3107'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname)); assert.equal(new URL(origin).port, '3107')
async function main() {
  const { request } = require(path.join(process.env.LEGALHUB_QA_NODE_MODULES, 'playwright'))
  const suffix = Date.now(), password = 'Disposable-QA-only-2026!'
  const org = await db.organization.create({ data: { name: 'Security QA', slug: `security-${suffix}` } })
  const foreign = await db.organization.create({ data: { name: 'Foreign security QA', slug: `security-foreign-${suffix}` } })
  const user = await db.user.create({ data: { organizationId: org.id, email: `security-${suffix}@example.invalid`, password: await bcrypt.hash(password, 10), name: 'Restricted QA', restrictedAccess: true } })
  const colleague = await db.user.create({ data: { organizationId: org.id, email: `colleague-${suffix}@example.invalid`, password: user.password, name: 'Colleague QA' } })
  const client = await db.client.create({ data: { organizationId: org.id, firstName: 'Security', lastName: 'QA', assignedToId: user.id } })
  const own = await db.case.create({ data: { organizationId: org.id, clientId: client.id, assignedToId: user.id } })
  const hidden = await db.case.create({ data: { organizationId: org.id, clientId: client.id, assignedToId: colleague.id } })
  const foreignService = await db.service.create({ data: { organizationId: foreign.id, name: 'Foreign QA service' } })
  const ownedLead = await db.lead.create({ data: { organizationId: org.id, assignedToId: user.id, fullName: 'Owned QA lead' } })
  for (const data of [{ organizationId: org.id, assignedToId: colleague.id }, { organizationId: org.id }, { organizationId: foreign.id }]) await db.lead.create({ data })
  const anonymous = await request.newContext(), api = await request.newContext()
  const checks = {}
  try {
    const unauthenticated = await anonymous.get(origin + `/api/cases/${own.id}`, { maxRedirects: 0 })
    assert.equal(unauthenticated.status(), 307); assert.ok(unauthenticated.headers().location.includes('/login'))
    assert.equal((await api.post(origin + '/api/auth/login', { data: { email: user.email, password } })).status(), 200)
    checks.authentication = 'PASS'
    assert.equal((await api.get(origin + `/api/cases/${own.id}`)).status(), 200)
    assert.equal((await api.get(origin + `/api/cases/${hidden.id}`)).status(), 404)
    assert.equal((await api.patch(origin + `/api/cases/${hidden.id}`, { data: { notes: 'attack', expectedUpdatedAt: hidden.updatedAt } })).status(), 404)
    assert.equal((await api.get(origin + `/api/custom-field-values?scope=case&recordId=${hidden.id}`)).status(), 404)
    assert.equal((await api.patch(origin + `/api/cases/${own.id}`, { headers: { origin: 'https://cross-origin.invalid' }, data: { notes: 'attack', expectedUpdatedAt: own.updatedAt } })).status(), 403)
    assert.equal((await api.patch(origin + `/api/cases/${own.id}`, { data: { serviceId: foreignService.id, expectedUpdatedAt: own.updatedAt } })).status(), 400)
    assert.equal((await db.case.findUniqueOrThrow({ where: { id: own.id } })).updatedAt.getTime(), own.updatedAt.getTime())
    assert.equal((await api.patch(origin + `/api/cases/${hidden.id}`, { data: { notes: 'legacy attack' } })).status(), 404)
    assert.equal((await api.patch(origin + `/api/cases/${own.id}`, { headers: { 'X-LegalHub-Case-Write': 'versioned' }, data: { status: 'В работе' } })).status(), 428)
    assert.equal((await api.patch(origin + '/api/custom-field-values', { headers: { 'X-LegalHub-Case-Write': 'versioned' }, data: { scope: 'case', recordId: own.id, values: {} } })).status(), 428)
    assert.equal((await api.patch(origin + `/api/cases/${own.id}`, { data: { status: 'В работе', expectedUpdatedAt: own.updatedAt } })).status(), 200)
    const legacy = await api.patch(origin + `/api/cases/${own.id}`, { data: { notes: 'old manual save' } })
    assert.equal(legacy.status(), 200)
    assert.equal(legacy.headers()['x-legalhub-case-compatibility'], 'legacy-manual-temporary')
    assert.equal((await db.case.findUniqueOrThrow({ where: { id: own.id } })).notes, 'old manual save')
    checks.newWritesRequireVersionAndLegacyManualWorks = 'PASS'
    checks.restrictedCaseAccessAndCrossTenantRelation = 'PASS'; checks.crossOrigin = 'PASS'
    const leads = await (await api.get(origin + '/api/leads?view=list')).json()
    assert.deepEqual(leads.map(row => row.id), [ownedLead.id])
    assert.equal((await api.get(origin + '/api/leads?view=list&staffScope=all')).status(), 403)
    checks.leadVisibility = 'PASS'
    await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } })
    assert.equal((await api.get(origin + `/api/cases/${own.id}`)).status(), 401)
    checks.sessionRevocation = 'PASS'
    await fs.writeFile('docs/qa/case-security-db.json', JSON.stringify({ environment: 'isolated Next + PostgreSQL 16.15', origin, checks }, null, 2) + '\n')
    console.log(JSON.stringify(checks))
  } finally { await anonymous.dispose(); await api.dispose() }
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
