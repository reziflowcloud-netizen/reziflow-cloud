const fs = require('fs')
const { PrismaClient } = require('@prisma/client')

const env = fs.readFileSync('.env', 'utf8')
for (const line of env.split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue
  const index = line.indexOf('=')
  if (index === -1) continue
  const key = line.slice(0, index)
  let value = line.slice(index + 1)
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
  process.env[key] = value
}

const prisma = new PrismaClient()

async function main() {
  const timeout = setTimeout(() => {
    console.error('Connection check timed out after 15 seconds')
    process.exit(2)
  }, 15000)

  try {
    const result = await prisma.$queryRawUnsafe(
      'SELECT id, email, name, role FROM "User" ORDER BY id'
    )
    clearTimeout(timeout)
    console.log(JSON.stringify(result))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error.code || error.name)
  console.error(error.message)
  process.exit(1)
})
