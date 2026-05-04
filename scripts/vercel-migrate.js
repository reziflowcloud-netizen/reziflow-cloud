const { spawnSync } = require('child_process')

const directUrl = process.env.DIRECT_URL

if (!directUrl) {
  console.log('DIRECT_URL is not set, skipping database migrations.')
  process.exit(0)
}

console.log('Running database migrations with DIRECT_URL...')

const command = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
const result = spawnSync(command, ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: directUrl,
  },
})

process.exit(result.status ?? 1)
