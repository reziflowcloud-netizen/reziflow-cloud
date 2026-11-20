// Synthetic old main Prisma/Billing against the restored, migrated database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = process.cwd()
const url = new URL(process.env.DATABASE_URL)
assert.equal(url.hostname, '127.0.0.1')
assert.match(url.pathname, /^\/legalhub_runner_/)
assert.notEqual(url.port, '5432')
const { PrismaClient } = require(path.join(root, '.qa/main-baseline/old-client'))
const ts = require(path.join(root, 'node_modules/typescript'))
const source = fs.readFileSync(path.join(root, '.qa/main-baseline/billing.ts'), 'utf8')
  .replace("import { prisma } from '@/lib/prisma'", 'const prisma = undefined')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const billing = {}
new Function('require', 'exports', compiled)(require, billing)
const db = new PrismaClient({ datasources: { db: { url: url.href } } })
const recordPath = path.join(root, '.qa/legacy-before.json')
const mode = process.argv[2]
async function fingerprints(tables) {
  const result = {}
  for (const table of tables) {
    assert.match(table, /^[A-Za-z][A-Za-z0-9_]+$/)
    const rows = await db.$queryRawUnsafe('SELECT row_to_json(t)::text AS value FROM "' + table + '" t ORDER BY row_to_json(t)::text')
    result[table] = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  }
  return result
}
async function main() {
  if (mode === 'seed') {
    const org = await db.organization.create({ data: { name: 'Synthetic Maintenance', slug: 'maintenance-four-pending', plan: 'manual', settings: { billingLimits: { clients: 777 } } } })
    const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic Owner', email: 'maintenance@example.invalid', password: 'not-a-login', role: 'owner' } })
    const client = await db.client.create({ data: { organizationId: org.id, firstName: 'Synthetic', lastName: 'Legacy' } })
    await db.case.create({ data: { organizationId: org.id, clientId: client.id, assignedToId: user.id, status: 'Новый' } })
    const lead = await db.lead.create({ data: { organizationId: org.id, fullName: 'Synthetic Żółć Тест', assignedToId: user.id } })
    await db.leadMessage.create({ data: { organizationId: org.id, leadId: lead.id, authorId: user.id, text: 'Synthetic Unicode Żółć Тест', payload: { nested: [1, null, { ok: true }] } } })
    await db.notificationPreference.create({ data: { id: 'synthetic-pref', organizationId: org.id, userId: user.id, events: { test: false } } })
    const rows = await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")
    const tables = rows.map(r => r.tablename)
    const record = { org: org.id, client: client.id, tables, hashes: await fingerprints(tables), billing: JSON.stringify(await billing.getBillingSnapshot(org.id, db)) }
    fs.writeFileSync(recordPath, JSON.stringify(record))
    console.log('LEGACY_SYNTHETIC_SEED_PASS tables=' + tables.length)
  } else {
    assert.equal(mode, 'verify')
    const before = JSON.parse(fs.readFileSync(recordPath))
    assert.deepEqual(await fingerprints(before.tables), before.hashes, 'All existing table values survived restore and four migrations')
    assert.equal(JSON.stringify(await billing.getBillingSnapshot(before.org, db)), before.billing)
    await db.client.update({ where: { id: before.client }, data: { lastName: 'Legacy Updated' } })
    assert.equal((await db.client.findUnique({ where: { id: before.client } })).lastName, 'Legacy Updated')
    for (const table of ['StripeBillingState', 'StripeBillingEvent', 'StripeBillingOperation', 'StripeBillingCoordinator']) {
      const rows = await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM "' + table + '"')
      assert.equal(rows[0].n, 0)
    }
    console.log('OLD_APP_NEW_DB_PASS tables=' + before.tables.length + ' billing=PASS oldClientReadWrite=PASS')
  }
}
main().finally(() => db.$disconnect()).catch(() => { console.error('SYNTHETIC_LEGACY_COMPAT_FAILED'); process.exitCode = 1 })
