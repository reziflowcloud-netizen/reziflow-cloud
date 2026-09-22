import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const migrationScript = await readFile(resolve(root, 'scripts/vercel-migrate.js'), 'utf8')
const seedScript = await readFile(resolve(root, 'prisma/seed.js'), 'utf8')
const migrationSql = await readFile(resolve(
  root,
  'prisma/migrations/20260918190000_staff_identity_and_lead_channel_routes/migration.sql',
))

test('already-applied migration history preserves the feature SQL checksum', () => {
  assert.equal(
    createHash('sha256').update(migrationSql).digest('hex'),
    '681e98fad1c81ad4363bdc7f9f066f64c5b6532c8a84228a66317f54fbfd20f5',
  )
})

test('normal build and install do not invoke migrations, db push, or seed', () => {
  assert.equal(pkg.scripts.build, 'prisma generate && next build')
  assert.equal(pkg.scripts.postinstall, 'prisma generate')
  for (const script of [pkg.scripts.build, pkg.scripts.postinstall]) {
    assert.doesNotMatch(script, /migrate|db push|seed/i)
  }
  assert.equal(pkg.scripts['db:migrate:deploy'], 'node scripts/vercel-migrate.js')
  assert.equal(pkg.scripts.seed, 'node prisma/seed.js')
})

test('explicit migrations never invoke seed', () => {
  assert.match(migrationScript, /'migrate', 'deploy'/)
  assert.doesNotMatch(migrationScript, /spawnSync\([^)]*seed/s)
})

test('migration command fails closed for Preview and unknown target without DB writes', () => {
  const fakeUrl = 'postgresql://fake:fake@production.example.invalid/fake'
  const baseEnv = {
    ...process.env,
    DIRECT_URL: fakeUrl,
    DB_MIGRATE_TARGET: 'production',
    DB_MIGRATE_CONFIRM: 'production',
    DB_MIGRATE_EXPECTED_HOST: 'production.example.invalid',
  }
  for (const overrides of [
    { VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'production', DB_MIGRATE_TARGET: 'preview' },
    { VERCEL_ENV: 'production', DB_MIGRATE_TARGET: '' },
    { VERCEL_ENV: 'development' },
    { VERCEL_ENV: 'production', DB_MIGRATE_CONFIRM: '' },
    { VERCEL_ENV: 'production', DB_MIGRATE_EXPECTED_HOST: 'other.example.invalid' },
  ]) {
    const result = spawnSync(process.execPath, ['scripts/vercel-migrate.js'], {
      cwd: root,
      env: { ...baseEnv, ...overrides },
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout + result.stderr, /fake:fake|production\.example\.invalid/)
  }
})

test('seed errors set a nonzero process exit code', () => {
  assert.match(seedScript, /\.catch\(\(error\) => \{[\s\S]*?process\.exitCode = 1/)
})
