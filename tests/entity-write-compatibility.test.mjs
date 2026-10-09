import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const source = ts.transpileModule(await readFile('src/lib/entityWrite.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
for (const entity of ['lead', 'client', 'task']) test(`${entity}: compatibility killswitch, advertised protocol, safe logging and monotonic version`, async () => {
  let row = { id: 'record', organizationId: 'org', updatedAt: new Date('2026-10-09T10:00:00Z') }
  const model = { findFirst: async () => row, updateMany: async ({ data }) => { row = { ...row, ...data }; return { count: 1 } } }
  const tx = { [entity]: model, $queryRawUnsafe: async () => [{ id: row.id }] }
  const exports = {}
  new Function('require','exports',source)(id => id === './prisma' ? { prisma: { $transaction: run => run(tx) } } : require(id), exports)
  const key = entity.toUpperCase() + '_LEGACY_PATCH_COMPAT', original = process.env[key]
  const request = headers => new Request('http://qa.invalid/api/' + entity, { method: 'PATCH', headers })
  const work = (_, existing, claim) => claim({ notes: 'PRIVATE EDITED VALUE' })
  const logs = [], info = console.info; console.info = (...args) => logs.push(args)
  try {
    process.env[key] = 'false'
    await assert.rejects(exports.entityWrite(request(), entity, {}, { id: row.id, organizationId: row.organizationId }, work), error => error.status === 428)
    const loaded = row.updatedAt.toISOString()
    const fresh = await exports.entityWrite(request({ 'X-LegalHub-Entity-Write': 'versioned' }), entity, { expectedUpdatedAt: loaded }, {}, work)
    assert.equal(fresh.status, 200); assert.ok(row.updatedAt > new Date(loaded)); assert.equal(logs.length, 0)
    delete process.env[key]
    await assert.rejects(exports.entityWrite(request({ 'X-LegalHub-Entity-Write': 'versioned' }), entity, {}, {}, work), error => error.status === 428)
    const legacy = await exports.entityWrite(request(), entity, {}, {}, work)
    assert.equal(legacy.headers.get('Deprecation'), 'true'); assert.equal(legacy.headers.get('X-LegalHub-Write-Mode'), 'legacy-manual')
    assert.equal(logs.length, 1); assert.ok(!JSON.stringify(logs).includes('PRIVATE EDITED VALUE'))
    await assert.rejects(exports.entityWrite(request(), entity, { expectedUpdatedAt: loaded }, {}, work), error => error.status === 409)
  } finally { console.info = info; if (original === undefined) delete process.env[key]; else process.env[key] = original }
})
