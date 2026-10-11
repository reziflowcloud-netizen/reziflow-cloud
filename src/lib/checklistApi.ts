import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { getOrganizationId, getUser } from './auth'
import { caseWhereForScope, getDataAccessScope } from './apiScope'
import { ChecklistError } from './documentChecklistPolicy'

export function checklistErrorResponse(error: unknown) {
  if (error instanceof ChecklistError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Document already exists' }, { status: 409 })
  console.error('Document checklist operation failed', error)
  return NextResponse.json({ error: 'Document checklist operation failed' }, { status: 500 })
}
export async function withCaseChecklist(caseId: string, write: boolean, run: (db: Prisma.TransactionClient, record: any) => Promise<any>) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  try {
    const result = await prisma.$transaction(async db => {
      if (write) await db.$queryRaw(Prisma.sql`SELECT id FROM "Case" WHERE id = ${caseId} AND "organizationId" = ${organizationId} FOR UPDATE`)
      const record = await db.case.findFirst({ where: caseWhereForScope(scope, organizationId, { id: caseId }) })
      if (!record) throw new ChecklistError('Not found', 404)
      return run(db, record)
    }, { maxWait: 5000, timeout: 15000, isolationLevel: write ? 'ReadCommitted' : 'RepeatableRead' })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return checklistErrorResponse(error) }
}
export function expectedChecklistVersion(value: unknown, actual: number) {
  if (!Number.isInteger(value) || Number(value) < 0) throw new ChecklistError('Checklist version required', 428)
  if (value !== actual) throw new ChecklistError('Checklist changed; reload before retrying', 409)
}
