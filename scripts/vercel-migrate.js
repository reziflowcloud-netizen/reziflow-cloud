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

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('Seeding default organization and admin user...')

const seedResult = spawnSync('node', ['prisma/seed.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: directUrl,
  },
})

process.exit(seedResult.status ?? 1)
