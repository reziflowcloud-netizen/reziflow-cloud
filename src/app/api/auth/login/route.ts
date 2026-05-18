import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { slug: process.env.ORGANIZATION_SLUG || 'default' },
    update: {},
    create: {
      id: 'org_default',
      name: process.env.ORGANIZATION_NAME || 'LegalHub',
      slug: process.env.ORGANIZATION_SLUG || 'default',
      status: 'active',
      plan: 'manual',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@migraflow.pl'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

    let user = await prisma.user.findUnique({ where: { email } })
    let organization = null

    if (!user && email === adminEmail && password === adminPassword) {
      organization = await ensureDefaultOrganization()
      user = await prisma.user.create({
        data: {
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 10),
          name: process.env.ADMIN_NAME || 'Administrator',
          role: 'admin',
          organizationId: organization.id,
        },
      })
    }

    if (!user) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    let valid = await bcrypt.compare(password, user.password)
    if (!valid && email === adminEmail && password === adminPassword) {
      organization = await ensureDefaultOrganization()
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(adminPassword, 10),
          name: process.env.ADMIN_NAME || user.name || 'Administrator',
          role: 'admin',
          organizationId: organization.id,
        },
      })
      valid = true
    }

    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    if (!organization) {
      organization = user.organizationId
        ? await prisma.organization.findUnique({ where: { id: user.organizationId } })
        : null
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: (user as any).avatarUrl || null,
      organizationId: user.organizationId || 'org_default',
      organizationName: organization?.name || 'LegalHub',
    })

    const cookieStore = cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: (user as any).avatarUrl || null,
        organizationId: user.organizationId || 'org_default',
        organizationName: organization?.name || 'LegalHub',
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
