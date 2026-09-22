// Explicit maintenance command only. Never call this from install or build.
const { spawnSync } = require('child_process')

function refuse(reason) {
  console.error(`Migration refused: ${reason}`)
  process.exit(1)
}

const target = process.env.DB_MIGRATE_TARGET
const confirmation = process.env.DB_MIGRATE_CONFIRM
const vercelEnvironment = process.env.VERCEL_ENV
const expectedHost = process.env.DB_MIGRATE_EXPECTED_HOST?.trim().toLowerCase()
const directUrl = process.env.DIRECT_URL

// Preview migrations remain forbidden until there is a separate Preview DB.
if (vercelEnvironment === 'preview' || target === 'preview') {
  refuse('Preview migrations are forbidden')
}
if (target !== 'production' || confirmation !== 'production') {
  refuse('set DB_MIGRATE_TARGET and DB_MIGRATE_CONFIRM explicitly to production')
}
if (vercelEnvironment && vercelEnvironment !== 'production') {
  refuse('VERCEL_ENV must be production when present')
}
if (!directUrl || !expectedHost) {
  refuse('DIRECT_URL and DB_MIGRATE_EXPECTED_HOST are required')
}

let actualHost
try {
  const parsed = new URL(directUrl)
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    refuse('DIRECT_URL must be PostgreSQL')
  }
  actualHost = parsed.hostname.toLowerCase()
} catch {
  refuse('DIRECT_URL must be a valid PostgreSQL URL')
}
if (actualHost !== expectedHost) {
  refuse('DIRECT_URL host does not match the explicitly confirmed target host')
}

console.log('Running explicitly confirmed production migrations (no seed).')
const result = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: directUrl },
  },
)
if (result.error) {
  console.error('Migration command failed to start')
  process.exit(1)
}
process.exit(result.status ?? 1)
