import { lockActualizationIdentity, reconcileActivatedActualizations } from '@/lib/documentActualization'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { isOrganizationAdmin } from '@/lib/security'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrganizationAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  const body = await req.json()
  try {
    const existing = await (prisma as any).employee.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const emp = await prisma.$transaction(async tx=>{
      await lockActualizationIdentity(tx,organizationId)
      const fresh = await tx.employee.findFirstOrThrow({where:{id:parseInt(params.id),organizationId}})
      const result = await tx.employee.update({where:{id:fresh.id},data:{name:body.name,active:body.active}})
      if (result.active !== fresh.active) await reconcileActivatedActualizations(tx,organizationId)
      return result
    })
    return NextResponse.json(emp)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOrganizationAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const organizationId = getOrganizationId(user)
  try {
    const existing = await (prisma as any).employee.findFirst({ where: { id: parseInt(params.id), organizationId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction(async tx=>{
      await lockActualizationIdentity(tx,organizationId)
      const fresh=await tx.employee.findFirstOrThrow({where:{id:parseInt(params.id),organizationId}})
      await tx.employee.delete({where:{id:fresh.id}})
      await reconcileActivatedActualizations(tx,organizationId)
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
