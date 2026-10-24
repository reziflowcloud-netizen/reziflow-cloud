import test from 'node:test'
import assert from 'node:assert/strict'
import {
  actualizationDay,
  actualizationDate,
  serviceDocUpdate,
  actualizationSummary,
  actualizationRef,
  actualizationTaskTitle,
  actualizationNeedsAssignment,
} from '../src/lib/documentActualizationPolicy.ts'
import { actualizationTaskId } from '../src/lib/documentActualization.ts'
const record = { id: 'case', predictedDecisionDate: '2026-01-01', docUpdates: [] }
test('latest genuine valid date wins; all reserved markers, invalid dates and createdAt excluded', () => {
  assert.equal(
    actualizationDate({
      ...record,
      docUpdates: [
        { date: '2026-02-01', description: 'Actual' },
        { date: '2026-12-01', description: '__MOS_ID__:x' },
        { date: '2026-12-02', description: ' __OTHER__:service' },
        { date: '2026-02-30', description: 'bad' },
        { date: 'junk', description: 'bad' },
      ],
    }),
    '2026-05-02',
  )
  assert.equal(
    actualizationDate({ ...record, predictedDecisionDate: null, createdAt: '2026-01-01' }),
    null,
  )
  for (const value of [null, 'bad', '2026-02-30', '42', '2026-02-30T08:00:00Z', new Date(NaN)])
    assert.equal(actualizationDay(value), null)
  assert.ok(serviceDocUpdate('__MOS_ID__:x'))
  assert.ok(!serviceDocUpdate('Genuine entry'))
})
test('90 calendar days across DST and month/year edges, not three months', () => {
  for (const [base, result] of [
    ['2026-01-01', '2026-04-01'],
    ['2026-01-31', '2026-05-01'],
    ['2026-07-31', '2026-10-29'],
    ['2026-12-15', '2027-03-15'],
    ['2024-02-01', '2024-05-01'],
  ])
    assert.equal(actualizationDate({ ...record, predictedDecisionDate: base }), result)
  assert.equal(actualizationDay('2026-03-28T23:30:00Z'), '2026-03-29')
  assert.equal(actualizationDay('2026-10-24T22:30:00Z'), '2026-10-25')
  assert.equal(actualizationDay('2026-03-29T00:00:00.000Z'), '2026-03-29')
})
test('cycle identity is deterministic and tenant-separated; A→B→A restores A', () => {
  const id = actualizationTaskId('org', 'case', '2026-04-01')
  assert.equal(id, actualizationTaskId('org', 'case', '2026-04-01'))
  assert.notEqual(id, actualizationTaskId('other', 'case', '2026-04-01'))
  assert.notEqual(id, actualizationTaskId('org', 'case', '2026-05-01'))
  assert.equal(
    actualizationRef({
      id: 'manual',
      description: JSON.stringify({
        documentActualization: { version: 1, caseId: 'case', cycle: '2026-04-01' },
      }),
    }),
    null,
  )
})
test('neutral legacy/no-date, stopped, overdue and completed inline states are read-only', () => {
  assert.equal(actualizationSummary(record, []).state, 'inactive')
  assert.equal(actualizationSummary({ ...record, predictedDecisionDate: null }, []).state, 'noDate')
  assert.equal(actualizationSummary({ ...record, decisionReceived: true }, []).state, 'stopped')
  const task = {
    id: actualizationTaskId('org', 'case', '2026-04-01'),
    status: 'done',
    description: JSON.stringify({
      documentActualization: { version: 1, caseId: 'case', cycle: '2026-04-01' },
    }),
  }
  assert.equal(actualizationSummary(record, [task]).state, 'completed')
  assert.equal(
    actualizationSummary(record, [{ ...task, status: 'todo' }], new Date('2026-04-02T08:00:00Z'))
      .state,
    'overdue',
  )
})
test('offsetless timestamps are rejected consistently across host timezones', async () => {
  const { execFileSync } = await import('node:child_process')
  const source = `import {actualizationDay} from './src/lib/documentActualizationPolicy.ts';console.log(JSON.stringify(['2026-03-29T23:30:00','2026-03-29','2026-03-29T23:30:00Z'].map(actualizationDay)))`
  for (const TZ of ['UTC', 'Europe/Warsaw', 'America/Los_Angeles'])
    assert.deepEqual(
      JSON.parse(
        execFileSync(process.execPath, ['--input-type=module', '-e', source], {
          env: { ...process.env, TZ },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      ),
      [null, '2026-03-29', '2026-03-30'],
    )
})

test('metadata-aware titles follow current language and never change ordinary or persisted titles',()=>{
const task={id:'case-actualization-synthetic',title:'Persisted creation title',description:JSON.stringify({documentActualization:{version:1,caseId:'case',cycle:'2026-04-01'}})}
for(const [lang,title] of [['uk','Актуалізувати документи'],['ru','Актуализировать документы'],['pl','Zaktualizować dokumenty']])assert.equal(actualizationTaskTitle(task,lang),title)
assert.equal(task.title,'Persisted creation title');assert.equal(actualizationTaskTitle({id:'manual',title:'Ordinary title'},'pl'),'Ordinary title')
})

test('assignment badge distinguishes an absent projection from an unassigned managed Task',()=>{
 const base={id:'case-actualization-synthetic',status:'todo',description:JSON.stringify({documentActualization:{version:1,caseId:'case',cycle:'2026-04-01',requiresAssignment:false}})}
 assert.equal(actualizationNeedsAssignment(base),false)
 assert.equal(actualizationNeedsAssignment({...base,assignedToId:7}),false)
 assert.equal(actualizationNeedsAssignment({...base,assignedToId:null}),true)
 assert.equal(actualizationNeedsAssignment({...base,assignedToId:null,status:'inactive'}),false)
 assert.equal(actualizationNeedsAssignment({...base,assignedToId:null,status:'done'}),false)
 assert.equal(actualizationNeedsAssignment({id:'manual',assignedToId:null}),false)
})
