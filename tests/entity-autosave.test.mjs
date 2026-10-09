import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const load = async path => {
  const exports = {}
  new Function('exports', ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports)
  return exports
}
const { EntityAutosave } = await load('src/lib/caseAutosave.ts')
const policies = await load('src/lib/entityAutosave.ts')
for (const entity of ['LEAD', 'CLIENT', 'TASK']) {
  test(`${entity}: minimal structural patch; debounce/manual Save share serial queue and versions`, async () => {
    const calls = [], allowed = policies.entityFieldPolicy(policies[entity + '_AUTOSAVE_FIELDS'])
    let finish
    const engine = new EntityAutosave(async (patch, version) => { calls.push({ patch, version }); if (calls.length === 1) await new Promise(resolve => { finish = resolve }); return 'v' + (calls.length + 1) }, () => {}, allowed)
    const key = entity === 'TASK' ? 'title' : 'email'
    engine.initialize({ [key]: 'initial', phones: [{ phone: '123' }], 'custom:1': '', familyClientIds: [] }, 'v1')
    engine.change('phones', [{ phone: '123' }]); assert.equal(engine.dirty, false)
    engine.change(key, 'one'); engine.change(key, 'latest')
    const auto = engine.flush(), manual = engine.flush(true)
    engine.change(key, 'typed during save'); finish()
    assert.equal(await auto, true); assert.equal(await manual, true)
    assert.deepEqual(calls, [{ patch: { [key]: 'latest' }, version: 'v1' }, { patch: { [key]: 'typed during save' }, version: 'v2' }])
    assert.equal(engine.safeToRefresh, true)
    engine.dispose()
  })
  test(`${entity}: failure retains local edits; Retry and conflict never use legacy fallback`, async () => {
    let online = false, status = 0, calls = 0
    const engine = new EntityAutosave(async () => { calls++; if (!online) throw Object.assign(new Error('failure'), { status }); return 'v2' }, () => {}, policies.entityFieldPolicy(policies[entity + '_AUTOSAVE_FIELDS']))
    const key = entity === 'TASK' ? 'title' : 'email'
    engine.initialize({ [key]: 'initial' }, 'v1'); engine.change(key, '')
    assert.equal(await engine.flush(), false); assert.equal(engine.state, 'error'); assert.equal(engine.values[key], ''); assert.equal(engine.safeToRefresh, false)
    online = true; assert.equal(await engine.flush(), true); assert.equal(calls, 2)
    online = false; status = 409; engine.change(key, 'local conflict')
    assert.equal(await engine.flush(), false); assert.equal(engine.state, 'conflict'); assert.equal(await engine.flush(true), false); assert.equal(calls, 3)
    engine.dispose()
  })
}
test('Client family graph edits wait for manual Save, while ordinary edits still autosave', async () => {
  const calls = []
  const engine = new EntityAutosave(async patch => { calls.push(patch); return 'v2' }, () => {}, policies.entityFieldPolicy(policies.CLIENT_AUTOSAVE_FIELDS))
  engine.initialize({ email: '', familyClientIds: [] }, 'v1'); engine.change('email', 'new'); engine.change('familyClientIds', ['relative'])
  assert.equal(await engine.flush(), false); assert.deepEqual(calls, [{ email: 'new' }]); assert.equal(engine.safeToRefresh, false)
  assert.equal(await engine.flush(true), true); assert.deepEqual(calls[1], { familyClientIds: ['relative'] }); engine.dispose()
})
