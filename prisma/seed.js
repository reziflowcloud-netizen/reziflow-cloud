// prisma/seed.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
  const organization = await prisma.organization.upsert({
    where: { slug: process.env.ORGANIZATION_SLUG || 'default' },
    update: {},
    create: {
      id: 'org_default',
      name: process.env.ORGANIZATION_NAME || 'ReziFlow CRM',
      slug: process.env.ORGANIZATION_SLUG || 'default',
      status: 'active',
      plan: 'manual',
    },
  })
  
  await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@migraflow.pl' },
    update: {
      password: hashedPassword,
      name: process.env.ADMIN_NAME || 'Administrator',
      role: 'admin',
      organizationId: organization.id,
    },
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@migraflow.pl',
      password: hashedPassword,
      name: process.env.ADMIN_NAME || 'Administrator',
      role: 'admin',
      organizationId: organization.id,
    },
  })

  // Create default statuses
  const statuses = [
    { name: 'Новый', color: '#6366f1', order: 0 },
    { name: 'В работе', color: '#f59e0b', order: 1 },
    { name: 'Ожидание документов', color: '#3b82f6', order: 2 },
    { name: 'Решение получено', color: '#10b981', order: 3 },
    { name: 'Архив', color: '#6b7280', order: 4 },
    { name: 'Отказ', color: '#ef4444', order: 5 },
  ]

  for (const status of statuses) {
    await prisma.caseStatus.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: status.name } },
      update: { organizationId: organization.id },
      create: { ...status, organizationId: organization.id },
    })
  }

  console.log('✅ Seed completed!')
  console.log(`📧 Login: ${process.env.ADMIN_EMAIL || 'admin@migraflow.pl'}`)
  console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
