const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const diagnostics = require('../../scripts/local-maintenance/migration-diagnostics.cjs')
const { PREFIX, CAPTURE_BYTES, summarizeMigrationResult } = diagnostics

test('error evidence keeps codes and never emits raw credentials, SQL or paths', () => {
  const result = summarizeMigrationResult({ status: 1,
    stdout: 'private-user@example.test postgresql://private:secret@private.invalid/private',
    stderr: 'Error: P1011: TLS failed at C:\\private\\secret.txt\nDatabase error code: 42501\nSELECT private_client_data' })
  assert.equal(result.category, 'TLS')
  assert.deepEqual(result.prismaCodes, ['P1011'])
  assert.deepEqual(result.sqlstates, ['42501'])
  assert.doesNotMatch(JSON.stringify(result), /private|secret|SELECT|postgresql|@/)
})

test('process failure, buffer overflow and unknown output remain bounded', () => {
  const limited = summarizeMigrationResult({ status: null, error: { code: 'ENOBUFS', message: 'private-secret' }, stderr: 'x'.repeat(CAPTURE_BYTES * 3) })
  assert.equal(limited.exitCode, 1)
  assert.equal(limited.category, 'OUTPUT_LIMIT')
  assert.equal(limited.outputLimited, true)
  const unknown = summarizeMigrationResult({ status: 1, error: { code: 'private-secret', message: 'private-secret' } })
  assert.equal(unknown.processError, null)
  assert.doesNotMatch(JSON.stringify(unknown), /private-secret/)
  assert.equal(summarizeMigrationResult({ status: null, signal: 'SIGTERM' }).exitCode, 1)
  assert.equal(summarizeMigrationResult({ status: 0, error: { code: 'EPERM' } }).exitCode, 1)
})

test('only labelled, bounded codes are accepted; successful process stays successful', () => {
  assert.deepEqual(summarizeMigrationResult({ status: 1, stderr: 'secretP1011 user12345' }).prismaCodes, [])
  const many = summarizeMigrationResult({ status: 1, stderr: Array.from({length: 10}, (_, i) => `Error: P${1000+i}`).join('\n') })
  assert.equal(many.prismaCodes.length, 4)
  assert.equal(summarizeMigrationResult({ status: 0 }).category, 'NONE')
  assert.equal(summarizeMigrationResult({ status: 1, stderr: 'Error: P1002' }).category, 'TIMEOUT')
})

function runGuard(overrides = {}, child = { status: 0, stdout: '', stderr: '' }) {
  const env = { DB_MIGRATE_TARGET: 'production', DB_MIGRATE_CONFIRM: 'production',
    DB_MIGRATE_EXPECTED_HOST: 'db.synthetic.invalid', DIRECT_URL: 'postgresql://synthetic:synthetic@db.synthetic.invalid:5432/synthetic', ...overrides }
  const logs = []; const errors = []; const calls = []; let exitCode
  const stop = Symbol('exit')
  const load = (name) => name === 'child_process' ? { spawnSync: (...args) => { calls.push(args); return child } } : diagnostics
  load.resolve = () => '/synthetic/prisma-cli.js'
  const source = fs.readFileSync(path.join(__dirname, '../../scripts/vercel-migrate.js'), 'utf8')
  try {
    vm.runInNewContext(source, { require: load, URL, process: { env, execPath: '/synthetic/node', exit: (code) => { exitCode = code; throw stop } },
      console: { log: (value) => logs.push(value), error: (value) => errors.push(value) } })
  } catch (error) { if (error !== stop) throw error }
  return { logs, errors, calls, exitCode }
}

test('approved entry point bounds both streams and forwards only the diagnostic envelope', () => {
  const run = runGuard({}, { status: 1, stderr: 'Error: P1011: postgresql://private:secret@private.invalid/private', stdout: 'SELECT private_data' })
  assert.equal(run.exitCode, 1)
  assert.equal(run.calls.length, 1)
  const options = run.calls[0][2]
  assert.equal(options.maxBuffer, CAPTURE_BYTES)
  assert.deepEqual(Array.from(options.stdio), ['ignore', 'pipe', 'pipe'])
  assert.equal(options.env.DATABASE_URL, options.env.DIRECT_URL)
  assert.equal(JSON.parse(run.logs.find((line) => line.startsWith(PREFIX)).slice(PREFIX.length)).category, 'TLS')
  assert.doesNotMatch(run.logs.join('\n') + run.errors.join('\n'), /private|secret|SELECT/)
})

test('existing preview, target, confirmation and hostname guards still refuse before spawning', () => {
  for (const change of [ { VERCEL_ENV: 'preview' }, { DB_MIGRATE_TARGET: 'preview' }, { DB_MIGRATE_CONFIRM: '' },
    { VERCEL_ENV: 'development' }, { DIRECT_URL: '' }, { DB_MIGRATE_EXPECTED_HOST: '' },
    { DIRECT_URL: 'https://db.synthetic.invalid' }, { DIRECT_URL: 'not-a-url' },
    { DIRECT_URL: 'postgresql://synthetic@other.invalid/synthetic' } ]) {
    const run = runGuard(change)
    assert.equal(run.exitCode, 1)
    assert.equal(run.calls.length, 0)
    const frame = JSON.parse(run.logs.find((line) => line.startsWith(PREFIX)).slice(PREFIX.length))
    assert.equal(frame.category, 'ENTRYPOINT_GUARD')
  }
})
