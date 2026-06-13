import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanPreferences(value: any) {
  const prefs: Record<string, unknown> = {}
  if (Array.isArray(value?.clientColumns)) {
    prefs.clientColumns = Array.from(new Set(value.clientColumns.filter((item: unknown) => typeof item === 'string')))
  }
  if (Array.isArray(value?.leadColumns)) {
    prefs.leadColumns = Array.from(new Set(value.leadColumns.filter((item: unknown) => typeof item === 'string')))
  }
  return prefs
}

export async function GET() {
  const user = await getUser()
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await (prisma as any).user.findUnique({
    where: { id: Number(user.id) },
    select: { preferences: true },
  })

  return NextResponse.json(asRecord(dbUser?.preferences))
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const existing = await (prisma as any).user.findUnique({
    where: { id: Number(user.id) },
    select: { preferences: true },
  })
  const next = { ...asRecord(existing?.preferences), ...cleanPreferences(body) }

  const updated = await (prisma as any).user.update({
    where: { id: Number(user.id) },
    data: { preferences: next },
    select: { preferences: true },
  })

  return NextResponse.json(asRecord(updated.preferences))
}
