import test from 'node:test'
import assert from 'node:assert/strict'
import { checklistProgress, checklistDate, documentNameKey } from '../src/lib/documentChecklistPolicy.ts'
import { registerScreenLeave, prepareScreenLeave, screenLeavePending } from '../src/lib/screenLeave.ts'

test('readiness uses active required received/submitted documents, optional does not block', () => {
  const items = [{ active: true, required: true, status: 'RECEIVED' }, { active: true, required: true, status: 'SUBMITTED_TO_MOS' }, { active: true, required: false, status: 'NEEDED' }, { active: false, required: true, status: 'NEEDED' }]
  assert.deepEqual(checklistProgress(items), { required: 2, received: 2, total: 3, totalReceived: 2, waiting: 0, percent: 100, ready: true, actionable: true })
  items[0].status = 'NEEDED'; assert.equal(checklistProgress(items).ready, false); assert.equal(checklistProgress(items).percent, 50)
  assert.equal(checklistProgress([]).actionable, false)
  assert.equal(checklistProgress([{ active: true, required: false, status: 'NEEDED' }]).ready, true)
})
test('canonical names and literal MOS dates reject invalid/future calendar dates', () => {
  assert.equal(documentNameKey('  Paszport  KLIENTA '), documentNameKey('paszport klienta'))
  assert.equal(checklistDate('2026-01-09').toISOString(), '2026-01-09T00:00:00.000Z')
  for (const date of ['2026-02-30', '2099-01-01', 'x', '2026-1-01']) assert.throws(() => checklistDate(date))
})
test('Case and document editor navigation guards both flush, dedupe concurrent navigation, unregister independently', async () => {
  let first = 0, second = 0, release
  const block = new Promise(resolve => { release = resolve })
  const unregisterA = registerScreenLeave(async () => { first++; await block; return true }, () => true)
  const unregisterB = registerScreenLeave(async () => { second++; return false }, () => true)
  assert.equal(screenLeavePending(), true)
  const a = prepareScreenLeave(), b = prepareScreenLeave(); release()
  assert.deepEqual(await Promise.all([a, b]), [false, false]); assert.equal(first, 1); assert.equal(second, 1)
  unregisterB(); assert.equal(await prepareScreenLeave(), true); unregisterA(); assert.equal(screenLeavePending(), false)
})
