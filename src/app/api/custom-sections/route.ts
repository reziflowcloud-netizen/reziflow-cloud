import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isUiSectionKeyForScope } from '@/lib/ui-sections'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function normalizeScope(value: unknown) {
  return value === 'case' ? 'case' : 'client'
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = req.nextUrl.searchParams.get('scope')
  const sections = await prisma.customSection.findMany({
    where: {
      organizationId,
      ...(scope ? { scope: normalizeScope(scope) } : {}),
    },
    include: {
      fields: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  })

  return NextResponse.json({ sections, canManage: canManage(user) })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const body = await req.json()
  const scope = normalizeScope(body.scope)
  const title = String(body.title || '').trim()
  const targetSectionKey = String(body.targetSectionKey || '').trim() || null
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (targetSectionKey && !isUiSectionKeyForScope(scope, targetSectionKey)) {
    return NextResponse.json({ error: 'Invalid target section' }, { status: 400 })
  }

  const last = await prisma.customSection.findFirst({
    where: { organizationId, scope },
    orderBy: { sortOrder: 'desc' },
  })

  const section = await prisma.customSection.create({
    data: {
      organizationId,
      scope,
      targetSectionKey,
      title,
      description: String(body.description || '').trim() || null,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
    include: { fields: true },
  })

  return NextResponse.json({ section })
}
