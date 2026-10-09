import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

export class EntityWriteError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function entityWriteError(error: unknown) {
  if (error instanceof SyntaxError || (error as { name?: string })?.name === 'PrismaClientValidationError') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (error instanceof EntityWriteError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Entity PATCH failed', { code: (error as { code?: string })?.code || 'unknown' })
  return NextResponse.json({ error: 'Unable to save' }, { status: 500 })
}
// Temporary compatibility for already-open bundles. Remove in a separate maintenance rollout.
// New clients advertise versioned writes: missing versions never silently fall back.
export async function entityWrite(request: NextRequest, entity: 'lead' | 'client' | 'task', body: any,
  where: any, work: (tx: any, existing: any, claim: (data: any) => Promise<any>) => Promise<any>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EntityWriteError(400, 'Invalid body')
  const legacy = !Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')
  const table = { lead: 'Lead', client: 'Client', task: 'Task' }[entity]
  const result = await prisma.$transaction(async tx => {
    const model = (tx as any)[entity]
    const first = await model.findFirst({ where })
    if (!first) throw new EntityWriteError(404, 'Not found')
    // Lock before rereading: legacy edits and dependent side effects use a fresh scoped row.
    // Identifiers come exclusively from the fixed table map, never from request data.
    await tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, first.id)
    const existing = await model.findFirst({ where })
    if (!existing) throw new EntityWriteError(404, 'Not found')
    if (legacy && (request.headers.get('X-LegalHub-Entity-Write') === 'versioned' || process.env[`${entity.toUpperCase()}_LEGACY_PATCH_COMPAT`] === 'false')) {
      throw new EntityWriteError(428, 'Version required')
    }
    const expected = legacy ? existing.updatedAt : typeof body.expectedUpdatedAt === 'string' ? new Date(body.expectedUpdatedAt) : new Date(NaN)
    if (!Number.isFinite(expected.getTime())) throw new EntityWriteError(400, 'Invalid version')
    if (existing.updatedAt.getTime() !== expected.getTime()) throw new EntityWriteError(409, 'Record changed')
    const claim = async (data: any) => {
      const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1))
      const updated = await model.updateMany({ where: { ...where, updatedAt: expected }, data: { ...data, updatedAt } })
      if (updated.count !== 1) throw new EntityWriteError(409, 'Record changed')
      return model.findFirst({ where: { id: existing.id, organizationId: existing.organizationId } })
    }
    return work(tx, existing, claim)
  }, { timeout: 15000 })
  const response = NextResponse.json(result)
  if (legacy) {
    console.info('legacy-entity-patch', { entity, organizationId: result.organizationId, recordId: result.id })
    response.headers.set('Deprecation', 'true')
    response.headers.set('X-LegalHub-Write-Mode', 'legacy-manual')
  }
  return response
}

export async function readEntityCustomFields(tx: any, organizationId: string, entity: string, id: string) {
  const fields = await tx.customField.findMany({ where: { active: true, section: { organizationId, scope: entity, active: true } }, select: { id: true, values: { where: { organizationId, recordType: entity, recordId: id }, take: 1 } } })
  return Object.fromEntries(fields.map((field: any) => [field.id, field.values[0]?.value || '']))
}
export async function writeEntityCustomFields(tx: any, organizationId: string, entity: string, id: string, values: unknown) {
  if (values === undefined) return
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new EntityWriteError(400, 'Invalid custom fields')
  const ids = Object.keys(values).map(Number)
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new EntityWriteError(400, 'Invalid custom fields')
  const fields = await tx.customField.findMany({ where: { id: { in: ids }, active: true, section: { organizationId, scope: entity, active: true } }, select: { id: true } })
  if (fields.length !== ids.length) throw new EntityWriteError(400, 'Invalid custom fields')
  for (const fieldId of ids) {
    const raw = (values as Record<string, unknown>)[fieldId]
    if (raw != null && !['string', 'number', 'boolean'].includes(typeof raw)) throw new EntityWriteError(400, 'Invalid custom value')
    const value = raw == null ? '' : String(raw)
    await tx.customFieldValue.upsert({ where: { fieldId_recordType_recordId: { fieldId, recordType: entity, recordId: id } }, update: { value }, create: { organizationId, fieldId, recordType: entity, recordId: id, value } })
  }
}
