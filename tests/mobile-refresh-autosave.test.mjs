import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { registerScreenRefresh, refreshScreen, markScreenFetched, isScreenStale } from '../src/lib/screenRefresh.ts'
import { shouldRetirePersonalAppearTask } from '../src/lib/caseImportantDateTasks.ts'

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const engineModule = { exports: {} }
new Function('exports', await compile('../src/lib/caseAutosave.ts'))(engineModule.exports)
const { CaseAutosave } = engineModule.exports
const tick = () => new Promise(resolve => setImmediate(resolve))

test('debounce coalesces edits; explicit Save flushes the timer without a second write', async () => {
  const calls = []
  const engine = new CaseAutosave(async (patch, version) => { calls.push({ patch, version }); return 'v2' }, () => {})
  engine.initialize({ notes: '', totalValue: 20 }, 'v1')
  engine.change('notes', 'a'); engine.change('notes', 'ab'); engine.change('notes', 'abc')
  assert.equal(calls.length, 0)
  assert.equal(await engine.flush(true), true)
  await new Promise(resolve => setTimeout(resolve, 900))
  assert.deepEqual(calls, [{ patch: { notes: 'abc' }, version: 'v1' }])
  assert.equal(engine.state, 'saved')
})

test('text, select, date and clearing persist through automatic debounce', async () => {
  const calls = []
  const engine = new CaseAutosave(async patch => { calls.push(patch); return 'v2' }, () => {})
  engine.initialize({ notes: 'old', serviceId: '1', personalAppearDate: '', personalAppearanceNote: 'old' }, 'v1')
  engine.change('notes', 'new'); engine.change('serviceId', '2')
  engine.change('personalAppearDate', '2026-10-09'); engine.change('personalAppearanceNote', '')
  await new Promise(resolve => setTimeout(resolve, 900))
  assert.deepEqual(calls, [{ notes: 'new', serviceId: '2', personalAppearDate: '2026-10-09', personalAppearanceNote: '' }])
  assert.equal(engine.dirty, false)
})

test('serial saves retain edits typed during a pending request and use the new version', async () => {
  let finish
  const calls = []
  const engine = new CaseAutosave(async (patch, version) => {
    calls.push({ patch, version })
    if (calls.length === 1) await new Promise(resolve => { finish = resolve })
    return `v${calls.length + 1}`
  }, () => {})
  engine.initialize({ notes: '' }, 'v1'); engine.change('notes', 'first')
  const saving = engine.flush(); await tick()
  engine.change('notes', 'second')
  const manual = engine.flush(true)
  assert.equal(engine.safeToRefresh, false)
  finish()
  assert.equal(await saving, true); assert.equal(await manual, true)
  assert.deepEqual(calls, [{ patch: { notes: 'first' }, version: 'v1' }, { patch: { notes: 'second' }, version: 'v2' }])
  assert.equal(engine.safeToRefresh, true)
})

test('editing a manual-only field cannot cancel pending ordinary autosave', async () => {
  const calls = []
  const engine = new CaseAutosave(async patch => { calls.push(patch); return 'v2' }, () => {})
  engine.initialize({ notes: '', cabinetPassword: '' }, 'v1')
  engine.change('notes', 'safe draft')
  engine.change('cabinetPassword', 'manual draft')
  await new Promise(resolve => setTimeout(resolve, 900))
  assert.deepEqual(calls, [{ notes: 'safe draft' }])
  assert.equal(engine.values.cabinetPassword, 'manual draft')
  assert.equal(engine.dirty, true)
  assert.equal(engine.state, 'dirty')
})

test('network failure never reports saved; explicit retry sends the retained patch', async () => {
  let online = false
  let calls = 0
  const engine = new CaseAutosave(async () => { calls++; if (!online) throw new Error('offline'); return 'v2' }, () => {})
  engine.initialize({ notes: '' }, 'v1'); engine.change('notes', 'keep')
  assert.equal(await engine.flush(), false); assert.equal(engine.state, 'error'); assert.equal(engine.dirty, true)
  online = true
  assert.equal(await engine.flush(), true); assert.equal(engine.state, 'saved'); assert.equal(calls, 2)
})

test('409 retains local input and blocks retry until an explicit reload', async () => {
  let calls = 0
  const engine = new CaseAutosave(async () => { calls++; throw Object.assign(new Error(), { status: 409 }) }, () => {})
  engine.initialize({ notes: '' }, 'v1'); engine.change('notes', 'mine')
  assert.equal(await engine.flush(), false); assert.equal(engine.state, 'conflict')
  assert.equal(await engine.flush(true), false); assert.equal(calls, 1); assert.equal(engine.values.notes, 'mine')
  engine.initialize({ notes: 'theirs' }, 'v2')
  assert.equal(engine.safeToRefresh, true)
})

test('financial values and credentials remain dirty until explicit manual Save', async () => {
  const calls = []
  const engine = new CaseAutosave(async patch => { calls.push(patch); return 'v2' }, () => {})
  engine.initialize({ notes: '', totalValue: 10, cabinetPassword: '' }, 'v1')
  engine.change('totalValue', 20); engine.change('cabinetPassword', 'changed'); engine.change('notes', 'safe')
  assert.equal(await engine.flush(), false)
  assert.deepEqual(calls, [{ notes: 'safe' }])
  assert.equal(engine.safeToRefresh, false)
  assert.equal(await engine.flush(true), true)
  assert.deepEqual(calls[1], { totalValue: 20, cabinetPassword: 'changed' })
})

test('refresh skips every loader if any form is dirty; concurrent requests share a single refresh', async () => {
  let ready = false, calls = 0, finish
  const unregister = registerScreenRefresh({ ready: () => ready, load: async () => { calls++; await new Promise(resolve => { finish = resolve }) } })
  try {
    assert.equal(await refreshScreen(async () => {}), 'blocked'); assert.equal(calls, 0)
    ready = true
    const a = refreshScreen(async () => {}), b = refreshScreen(async () => {})
    assert.equal(a, b); assert.equal(calls, 1)
    finish(); assert.equal(await a, 'refreshed')
    markScreenFetched(); assert.equal(isScreenStale(), false)
  } finally { unregister() }
})

async function caseApi() {
  const row = { id: 'case1', organizationId: 'org1', updatedAt: new Date('2026-10-08T10:00:00Z'), notes: 'original', status: 'New' }
  const tasks = [{ id: 1, organizationId: 'org1', title: 'Unrelated reminder', description: '{}' }]
  const history = []
  const db = {
    service: { findFirst: async ({ where }) => where.id === 1 && where.organizationId === 'org1' ? { id: 1 } : null },
    employee: { findFirst: async ({ where }) => where.id === 1 && where.organizationId === 'org1' ? { id: 1 } : null },
    task: {
      findFirst: async ({ where }) => tasks.find(task => task.organizationId === where.organizationId && where.AND.every(condition => task.description.includes(condition.description.contains))) || null,
      create: async ({ data }) => { const task = { id: tasks.length + 2, ...data }; tasks.push(task); return task },
      update: async ({ where, data }) => Object.assign(tasks.find(task => task.id === where.id), data),
      delete: async ({ where }) => tasks.splice(tasks.findIndex(task => task.id === where.id), 1)[0],
    },
    statusHistory: { create: async ({ data }) => { history.push(data); return data } },
    case: {
      findFirst: async ({ where }) => where.organizationId === row.organizationId && where.id === row.id ? { ...row } : null,
      updateMany: async ({ where, data }) => {
        const [scope, version] = where.AND
        if (scope.organizationId !== row.organizationId || version.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 }
        Object.assign(row, data); return { count: 1 }
      },
      findUniqueOrThrow: async () => ({ ...row }),
    },
    $transaction: async callback => callback(db),
  }
  let authorized = true, organizationId = 'org1'
  const module = { exports: {} }
  const mocks = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/auth': { getUser: async () => authorized ? { role: 'admin' } : null, getOrganizationId: () => organizationId },
    '@/lib/apiScope': { getDataAccessScope: async () => ({}), caseWhereForScope: (_scope, org, where) => ({ ...where, organizationId: org }) },
    '@/lib/caseImportantDateTasks': { shouldRetirePersonalAppearTask },
    '@/lib/caseDateReminders': { syncCaseDateReminders: async () => {} },
    '@/lib/employeeSync': { resolveUserIdForEmployee: async (_org, id) => id === 1 ? 'user1' : null },
  }
  new Function('require', 'module', 'exports', await compile('../src/app/api/cases/[id]/route.ts'))(name => mocks[name] || {}, module, module.exports)
  return {
    row,
    tasks,
    history,
    patch: body => module.exports.PATCH({ json: async () => JSON.parse(JSON.stringify({ expectedUpdatedAt: row.updatedAt.toISOString(), ...body })) }, { params: { id: 'case1' } }),
    unauthorized: () => { authorized = false },
    otherTenant: () => { organizationId = 'org2' },
  }
}

test('actual PATCH rejects concurrent writes atomically and a reload observes the persisted value', async () => {
  const api = await caseApi(), expectedUpdatedAt = api.row.updatedAt.toISOString()
  const results = await Promise.all([api.patch({ notes: 'first', expectedUpdatedAt }), api.patch({ notes: 'second', expectedUpdatedAt })])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  assert.equal(api.row.notes, 'first')
  const stale = await api.patch({ notes: 'stale', expectedUpdatedAt })
  assert.equal(stale.status, 409); assert.equal(api.row.notes, 'first')
  const fresh = await api.patch({ notes: '', expectedUpdatedAt: api.row.updatedAt.toISOString() })
  assert.equal(fresh.status, 200); assert.equal(api.row.notes, null)
  const legacy = await api.patch({ notes: 'old form', expectedUpdatedAt: undefined })
  assert.equal(legacy.status, 428); assert.equal(api.row.notes, null)
  const quickStatus = await api.patch({ status: 'Working', expectedUpdatedAt: undefined })
  assert.equal(quickStatus.status, 428)
  assert.equal((await api.patch({ status: 'Working', expectedUpdatedAt: api.row.updatedAt.toISOString() })).status, 200)
  assert.equal(api.row.status, 'Working')
})

test('actual PATCH preserves authentication, tenant scope and time validation', async () => {
  const api = await caseApi()
  assert.equal((await api.patch({ personalAppearTime: '99:00' })).status, 400)
  assert.equal((await api.patch({ serviceId: '999' })).status, 400)
  assert.equal((await api.patch({ employeeId: '999' })).status, 400)
  assert.equal((await api.patch({ notes: 'safe', organizationId: 'org2' })).status, 200)
  assert.equal(api.row.organizationId, 'org1')
  assert.equal(api.row.notes, 'safe')
  api.otherTenant(); assert.equal((await api.patch({ notes: 'attack' })).status, 404)
  api.unauthorized(); assert.equal((await api.patch({ notes: 'attack' })).status, 401)
  assert.equal(api.row.notes, 'safe')
})

test('ordinary notes leave reminders untouched; important date create/clear and status history still use shared logic', async () => {
  const api = await caseApi()
  const initial = JSON.stringify(api.tasks)
  assert.equal((await api.patch({ notes: 'updated', expectedUpdatedAt: api.row.updatedAt.toISOString() })).status, 200)
  assert.equal(JSON.stringify(api.tasks), initial)
  assert.equal((await api.patch({ personalAppearDate: '2026-12-10', personalAppearTime: '11:15', expectedUpdatedAt: api.row.updatedAt.toISOString() })).status, 200)
  assert.equal(api.tasks.length, 2)
  const task = api.tasks.find(task => task.id !== 1)
  assert.equal(task.organizationId, 'org1')
  assert.equal(JSON.parse(task.description).caseImportantDate.kind, 'personalAppearDate')
  assert.equal(JSON.parse(task.description).reminderAt, '2026-12-10T11:15')
  assert.equal((await api.patch({ personalAppearDate: '', status: 'Working', expectedUpdatedAt: api.row.updatedAt.toISOString() })).status, 200)
  assert.equal(api.tasks.length, 1); assert.equal(api.tasks[0].id, 1)
  assert.equal(api.history.length, 1); assert.equal(api.history[0].fromStatus, 'New'); assert.equal(api.history[0].toStatus, 'Working')
})
