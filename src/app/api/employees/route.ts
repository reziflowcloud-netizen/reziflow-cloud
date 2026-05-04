import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const employees = await (prisma as any).employee.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return NextResponse.json(employees)
  } catch { return NextResponse.json([]) }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await req.json()
  try {
    const emp = await (prisma as any).employee.create({ data: { organizationId, name: body.name } })
    return NextResponse.json(emp)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
