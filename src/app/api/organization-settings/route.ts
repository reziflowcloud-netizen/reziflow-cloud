import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

type OrganizationSettings = {
  mosAutoRemindersEnabled: boolean
}

const defaultSettings: OrganizationSettings = {
  mosAutoRemindersEnabled: true,
}

function canManageSettings(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeSettings(value: unknown): OrganizationSettings {
  const raw = toObject(value)
  return {
    mosAutoRemindersEnabled: raw.mosAutoRemindersEnabled !== false,
  }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  return NextResponse.json({
    settings: normalizeSettings(organization?.settings),
    canManage: canManageSettings(user),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSettings(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const body = await req.json().catch(() => ({}))
  const incoming = toObject(body?.settings)

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = { ...defaultSettings, ...toObject(organization.settings) }
  const nextSettings: OrganizationSettings = {
    ...current,
    mosAutoRemindersEnabled: incoming.mosAutoRemindersEnabled !== false,
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: nextSettings },
  })

  return NextResponse.json({ settings: nextSettings })
}
