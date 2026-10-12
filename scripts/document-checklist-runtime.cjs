// Local QA only. Never inherit production DB, integration or transport credentials.
const { spawn, spawnSync } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) assert.ok(!fs.existsSync(name), 'QA refuses env files')
const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'USERPROFILE'])
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())))
Object.assign(env, { DATABASE_URL: 'postgresql://qa@127.0.0.1:55432/legalhub_case_qa', NEXT_TELEMETRY_DISABLED: '1', JWT_SECRET: randomBytes(48).toString('hex'), NOTIFICATIONS_ENABLED: 'true' })
const run = args => { const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true }); if (result.status !== 0) process.exit(result.status || 1) }
const mode = process.argv[2]
if (mode === 'build') {
  env.NODE_ENV = 'production'; env.DATABASE_URL = 'postgresql://qa@127.0.0.1:1/legalhub_build_qa'
  run(['node_modules/prisma/build/index.js', 'generate']); run(['node_modules/next/dist/bin/next', 'build'])
} else if (mode === 'serve') {
  env.NODE_ENV = 'production'
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3107'], { env, stdio: 'inherit', windowsHide: true })
  process.on('SIGINT', () => child.kill()); process.on('SIGTERM', () => child.kill()); child.on('exit', code => process.exit(code || 0))
} else if (mode === 'regression') {
  fs.mkdirSync('.qa', { recursive: true })
  env.NOTIFICATIONS_TEST_DATABASE_URL = 'postgresql://qa@127.0.0.1:55432/legalhub_notifications_qa'; env.RUN_DB_TESTS = '1'
  env.LEAD_WEBHOOK_POOL_TEST_DATABASE_URL = 'postgresql://qa@127.0.0.1:55432/legalhub_webhook_qa'
  const files = fs.readdirSync('tests').filter(name => name.endsWith('.test.mjs')).map(name => path.join('tests', name))
  run(['--test', '--test-concurrency=1', ...files, 'tests/security/hardening.test.mjs'])
} else if (mode === 'qa') run(['scripts/qa-document-checklist.cjs'])
else if (mode === 'followup') run(['scripts/qa-document-checklist-followup.cjs', 'qa'])
else if (mode === 'case-regression') {
  env.LEGALHUB_QA_NODE_MODULES = path.join(process.cwd(), 'node_modules')
  for (const [script, baseline, output] of [
    ['scripts/qa-case-security-postgres.cjs', 'docs/qa/case-security-db.json', 'docs/document-checklist-v2-case-security.json'],
    ['scripts/qa-case-postgres.cjs', 'docs/qa/case-postgres-e2e.json', 'docs/document-checklist-v2-case-regression.json'],
  ]) {
    const original = fs.readFileSync(baseline)
    const result = spawnSync(process.execPath, [script], { env, stdio: 'inherit', windowsHide: true })
    const report = JSON.parse(fs.readFileSync(baseline, 'utf8'))
    // The legacy security runner has a hard-coded PostgreSQL version label.
    if (typeof report.environment === 'string') report.environment = 'isolated Next + disposable loopback PostgreSQL'
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync(baseline, original)
    if (result.status !== 0) process.exit(result.status || 1)
  }
} else throw new Error('Expected build, serve, regression, case-regression, qa or followup')
