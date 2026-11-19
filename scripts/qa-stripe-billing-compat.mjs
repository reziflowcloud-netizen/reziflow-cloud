// Reproducible OLD APP + NEW DB proof. Disposable loopback PostgreSQL only.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { PrismaClient } from '@prisma/client'

const root = resolve(import.meta.dirname, '..')
const target = new URL(process.env.STRIPE_BILLING_COMPAT_DATABASE_URL || 'http://invalid')
assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55439'); assert.equal(target.pathname, '/legalhub_billing_compat_qa')
const baseline = '41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04'
const dir = resolve(root, '.qa/stripe-old-app')
await mkdir(dir, { recursive: true })
const archive = execFileSync('git', ['archive', baseline, 'prisma'], { cwd: root, maxBuffer: 10 * 1024 * 1024 })
execFileSync('tar', ['-x', '-C', dir], { input: archive })
const show = path => execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, encoding: 'utf8' })
const schema = show('prisma/schema.prisma').replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "./old-client"')
const schemaPath = resolve(dir, 'prisma/schema.prisma')
await writeFile(schemaPath, schema)
// Child processes inherit only explicit, synthetic connection configuration.
const env = { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: target.href, NEXT_TELEMETRY_DISABLED: '1' }
const prisma = args => execFileSync(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), ...args], { cwd: root, env, stdio: 'pipe' })
prisma(['migrate', 'deploy', '--schema', schemaPath])
prisma(['generate', '--schema', schemaPath])
const require = createRequire(import.meta.url)
const { PrismaClient: OldPrisma } = require(resolve(dir, 'prisma/old-client'))
const old = new OldPrisma({ datasources: { db: { url: target.href } } })
const current = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] })
const baselineBilling = show('src/lib/billing.ts').replace("import { prisma } from '@/lib/prisma'", 'const prisma = undefined')
const compiled = ts.transpileModule(baselineBilling, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const oldBilling = {}
new Function('require', 'exports', compiled)(require, oldBilling)
try {
  const org = await old.organization.create({ data: { name: 'Synthetic Old App', slug: 'stripe-compat-old-app', plan: 'manual', settings: { billingLimits: { clients: 777 } } } })
  const user = await old.user.create({ data: { organizationId: org.id, name: 'Synthetic Old Owner', email: 'old-billing-owner@example.test', password: 'not-a-login', role: 'owner' } })
  const client = await old.client.create({ data: { organizationId: org.id, firstName: 'Synthetic', lastName: 'Legacy' } })
  await old.case.create({ data: { organizationId: org.id, clientId: client.id, assignedToId: user.id, status: 'Новый' } })
  await old.lead.create({ data: { organizationId: org.id, fullName: 'Synthetic Legacy Lead', assignedToId: user.id } })
  const tables = await old.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`
  async function hashes() {
    const result = {}
    for (const { tablename } of tables) {
      assert.match(tablename, /^[A-Za-z][A-Za-z0-9_]+$/)
      const rows = await old.$queryRawUnsafe(`SELECT row_to_json(t)::text AS value FROM "${tablename}" t ORDER BY row_to_json(t)::text`)
      result[tablename] = createHash('sha256').update(JSON.stringify(rows)).digest('hex')
    }
    return result
  }
  const before = await hashes(), snapshot = await oldBilling.getBillingSnapshot(org.id, old)
  prisma(['migrate', 'deploy'])
  assert.deepEqual(await hashes(), before, 'Every existing table/data value unchanged by additive migration')
  assert.deepEqual(await oldBilling.getBillingSnapshot(org.id, old), snapshot)
  await old.client.update({ where: { id: client.id }, data: { lastName: 'Legacy Updated' } })
  assert.equal((await current.client.findUnique({ where: { id: client.id } })).lastName, 'Legacy Updated')
  assert.equal(await current.stripeBillingState.count(), 0)
  assert.equal(await current.stripeBillingEvent.count(), 0)
  const report = { baseline, migration: 'ADDITIVE', oldAppNewDb: 'PASS', unchangedExistingTables: tables.length,
    baselineBillingSnapshot: 'PASS', oldClientReadWrite: 'PASS', noExistingDataChanges: 'PASS' }
  await writeFile(resolve(dir, 'compat-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await old.$disconnect(); await current.$disconnect() }
