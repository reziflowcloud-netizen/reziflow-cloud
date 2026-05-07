import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUiSectionDefinitions, uiSectionDefinitions } from '@/lib/ui-sections'

function canManageSections(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = req.nextUrl.searchParams.get('scope')
  const definitions = getUiSectionDefinitions(scope)
  const rows = await prisma.uiSectionSetting.findMany({
    where: {
      organizationId,
      ...(scope ? { scope } : {}),
    },
  })

  const byKey = new Map(rows.map(row => [`${row.scope}:${row.sectionKey}`, row]))
  const settings = definitions.map(def => {
    const row = byKey.get(`${def.scope}:${def.sectionKey}`)
    return {
      ...def,
      visible: row?.visible ?? true,
      sortOrder: row?.sortOrder ?? def.sortOrder,
    }
  })

  return NextResponse.json({ settings, canManage: canManageSections(user) })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSections(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organizationId = getOrganizationId(user)
  const body = await req.json()
  const incoming = Array.isArray(body.settings) ? body.settings : []
  const valid = new Set(uiSectionDefinitions.map(def => `${def.scope}:${def.sectionKey}`))

  const updates = incoming
    .filter((item: any) => valid.has(`${item.scope}:${item.sectionKey}`))
    .map((item: any, index: number) => {
      const visible = item.visible !== false
      const sortOrder = Number.isFinite(item.sortOrder) ? item.sortOrder : index
      return prisma.uiSectionSetting.upsert({
        where: {
          organizationId_scope_sectionKey: {
            organizationId,
            scope: item.scope,
            sectionKey: item.sectionKey,
          },
        },
        update: { visible, sortOrder },
        create: {
          organizationId,
          scope: item.scope,
          sectionKey: item.sectionKey,
          visible,
          sortOrder,
        },
      })
    })

  await prisma.$transaction(updates)
  return NextResponse.json({ ok: true })
}
