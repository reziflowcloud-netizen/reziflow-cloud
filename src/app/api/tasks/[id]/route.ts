import {actualizationRef} from '@/lib/documentActualizationPolicy'
import {findScopedCase} from '@/lib/apiScope'
import { dispatchAssignmentPush } from '@/lib/assignmentDelivery'
// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDataAccessScope, taskWhereForScope, clientWhereForScope, findScopedTask } from '@/lib/apiScope'

import { entityWrite, entityWriteError, EntityWriteError } from '@/lib/entityWrite'
import { notifyAssignment } from '@/lib/notifications'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const task = await findScopedTask(params.id, getOrganizationId(user))
  if(task&&actualizationRef(task)&&!await findScopedCase(actualizationRef(task).caseId,getOrganizationId(user),{id:true}))return NextResponse.json({error:'Not found'},{status:404})
  return task ? NextResponse.json(task) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const scope = await getDataAccessScope(user, organizationId)
    let assignmentIds: string[] = []
    return await entityWrite(request, 'task', body, taskWhereForScope(scope, organizationId, { id: params.id }), async (tx, existing, claim) => {
      const managed=actualizationRef(existing)
      if(managed){
        if(!await tx.case.findFirst({where:{id:managed.caseId,organizationId,...(scope.restricted?{assignedToId:scope.userId}:{})},select:{id:true}}))throw new EntityWriteError(404,'Not found')
        for(const key of ['title','description','dueDate','assignedToId','clientName'])if(key in body&&(key==='dueDate'?new Date(body[key]).getTime()!==existing.dueDate?.getTime():body[key]!==existing[key]))throw new EntityWriteError(409,'Automatic control is managed by the Case')
        if('status' in body&&body.status!==existing.status&&!['done','completed'].includes(body.status))throw new EntityWriteError(409,'Automatic control can only be completed here')
      }else{try{if(Object.prototype.hasOwnProperty.call(JSON.parse(body.description||'{}')||{},'documentActualization'))throw new EntityWriteError(400,'Reserved automatic Task metadata')}catch(e){if(e instanceof EntityWriteError)throw e}}
      const data: any = {}
      for (const key of ['title', 'description', 'priority', 'status', 'clientName']) if (key in body) { if (body[key] != null && typeof body[key] !== 'string') throw new EntityWriteError(400, 'Invalid field'); data[key] = body[key] }
      if ('dueDate' in body) {
        data.dueDate = body.dueDate ? new Date(body.dueDate) : null
        if (data.dueDate && !Number.isFinite(data.dueDate.getTime())) throw new EntityWriteError(400, 'Invalid date')
      }
      if ('assignedToId' in body) {
        data.assignedToId = scope.restricted ? scope.userId : body.assignedToId ? Number(body.assignedToId) : null
        if (data.assignedToId && !await tx.user.findFirst({ where: { id: data.assignedToId, organizationId }, select: { id: true } })) throw new EntityWriteError(400, 'User not found')
      }
      // Linked clients live in the existing description metadata, not a new schema relation.
      if (typeof data.description === 'string') {
        let meta: any
        try { meta = JSON.parse(data.description) } catch { meta = null }
        if (meta?.clientId && !await tx.client.findFirst({ where: clientWhereForScope(scope, organizationId, { id: meta.clientId }), select: { id: true } })) throw new EntityWriteError(400, 'Client not found')
      }
      const updated = await claim(data)
      assignmentIds = await notifyAssignment(tx, 'task', updated, existing)
      return updated
    }, async result => { if (assignmentIds.length) await dispatchAssignmentPush(organizationId, [result.id]) })
  } catch (error) { return entityWriteError(error) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const existing = await findScopedTask(params.id, organizationId, { id: true, description:true })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if(actualizationRef(existing))return NextResponse.json({error:'Automatic control is managed by the Case'},{status:409})
  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
