import test from 'node:test'
import assert from 'node:assert/strict'
import { projectLegacyRequirements, legacyOrphanDisposition } from '../src/lib/documentChecklistLegacyMapping.ts'

test('legacy duplicate projection is deterministic and preserves its source rows', () => {
  const rows = [{ id: 448, value: 'Справка о прописке / Meldunek', order: 4 },
    { id: 338, value: 'Справка о прописке / Meldunek', order: 0 }]
  const before = structuredClone(rows)
  const result = projectLegacyRequirements(rows)
  assert.equal(result.normalizedDuplicates, 1)
  assert.equal(result.conflicts, 0)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].sortOrder, 0)
  assert.deepEqual(rows, before)
  assert.deepEqual(projectLegacyRequirements([...rows].reverse()), result)
})

test('an orphan is ignored only with every safety condition proven', () => {
  const safe = { serviceMissing: true, cases: 0, matchingTasks: 0, history: 0, files: 0, exactGeneralCounterpart: true }
  assert.equal(legacyOrphanDisposition(safe), 'IGNORED_LEGACY_ORPHAN')
  for (const key of ['cases', 'matchingTasks', 'history', 'files'])
    assert.equal(legacyOrphanDisposition({ ...safe, [key]: 1 }), 'MANUAL_REVIEW_REQUIRED')
  for (const key of ['serviceMissing', 'exactGeneralCounterpart'])
    assert.equal(legacyOrphanDisposition({ ...safe, [key]: false }), 'MANUAL_REVIEW_REQUIRED')
})

test('conflicting normalized display text and blank names remain parity blockers', () => {
  const result = projectLegacyRequirements([{ id: 1, value: 'Paszport', order: 0 },
    { id: 2, value: 'PASZPORT', order: 1 }, { id: 3, value: '  ', order: 2 }])
  assert.equal(result.conflicts, 1)
  assert.equal(result.blankNames, 1)
})
