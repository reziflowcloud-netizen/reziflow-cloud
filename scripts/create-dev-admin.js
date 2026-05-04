const fs = require('fs')
const bcrypt = require('bcryptjs')
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
  const email = process.env.ADMIN_EMAIL || 'admin@migraflow.pl'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const name = process.env.ADMIN_NAME || 'Administrator'
  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, name, role: 'admin' },
    create: { email, password: hashedPassword, name, role: 'admin' },
  })

  console.log(`Dev admin is ready: ${email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
