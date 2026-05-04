import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  try {
    const d = await (prisma as any).docUpdate.create({
      data: { caseId: params.id, date: new Date(body.date), description: body.description }
    })
    return NextResponse.json(d)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
