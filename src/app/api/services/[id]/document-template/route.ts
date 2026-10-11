import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { isOrganizationAdmin } from '@/lib/security'
import { effectiveDocumentTemplate } from '@/lib/documentChecklist'
import { checklistErrorResponse, expectedChecklistVersion } from '@/lib/checklistApi'
import { ChecklistError, checklistName, documentNameKey } from '@/lib/documentChecklistPolicy'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrganizationAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!Number.isInteger(Number(params.id)) || Number(params.id) <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const template = await effectiveDocumentTemplate(prisma, getOrganizationId(user), Number(params.id))
    return NextResponse.json({ items: template.items, legacy: template.legacy, version: template.service?.documentTemplateVersion || 0 })
  } catch (error) { return checklistErrorResponse(error) }
}
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrganizationAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!Number.isInteger(Number(params.id)) || Number(params.id) <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const result = await prisma.$transaction(async db => {
      await db.$queryRaw(Prisma.sql`SELECT id FROM "Service" WHERE id = ${Number(params.id)} AND "organizationId" = ${organizationId} FOR UPDATE`)
      const template = await effectiveDocumentTemplate(db, organizationId, Number(params.id))
      if (!template.service) throw new ChecklistError('Not found', 404)
      expectedChecklistVersion(body.expectedVersion, template.service.documentTemplateVersion)
      if (!Array.isArray(body.items) || body.items.length > 200) throw new ChecklistError('Invalid template')
      const seen = new Set<string>()
      const ids = new Set<string>()
      const rows = body.items.map((item: any, sortOrder: number) => {
        const name = checklistName(item.name), nameKey = documentNameKey(name)
        if (seen.has(nameKey)) throw new ChecklistError('Duplicate document name')
        seen.add(nameKey)
        if (typeof item.required !== 'boolean' || typeof item.forMos !== 'boolean' || typeof item.active !== 'boolean') throw new ChecklistError('Invalid flags')
        if (item.id && !template.items.some(row => row.id === item.id)) throw new ChecklistError('Invalid template item')
        if (item.id && ids.has(item.id)) throw new ChecklistError('Duplicate template item')
        if (item.id) ids.add(item.id)
        return { id: item.id, name, nameKey, required: item.required, forMos: item.forMos, active: item.active, sortOrder }
      })
      // Require archived rows to remain in the request; no silent deletion or ID replacement.
      if (!template.legacy && template.items.some(old => !rows.some((row: any) => row.id === old.id))) throw new ChecklistError('Archive template items instead of deleting')
      // Free unique names first, permitting rename/swap atomically without losing references.
      if (!template.legacy) for (const old of template.items) await db.serviceDocumentRequirement.update({ where: { id: old.id }, data: { nameKey: `__renaming_${old.id}` } })
      for (const row of rows) {
        const { id, ...data } = row
        if (id) await db.serviceDocumentRequirement.update({ where: { id }, data })
        else await db.serviceDocumentRequirement.create({ data: { ...data, serviceId: template.service.id } })
      }
      const service = await db.service.update({ where: { id: template.service.id }, data: { documentTemplateInitializedAt: new Date(), documentTemplateVersion: { increment: 1 } } })
      return { version: service.documentTemplateVersion, legacy: false, items: await db.serviceDocumentRequirement.findMany({ where: { serviceId: service.id }, orderBy: { sortOrder: 'asc' } }) }
    }, { timeout: 15000 })
    return NextResponse.json(result)
  } catch (error) { return checklistErrorResponse(error) }
}
