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
  return task ? NextResponse.json(task) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  try {
    const body = await request.json()
    const scope = await getDataAccessScope(user, organizationId)
    return await entityWrite(request, 'task', body, taskWhereForScope(scope, organizationId, { id: params.id }), async (tx, existing, claim) => {
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
      await notifyAssignment(tx, 'task', updated, existing)
      return updated
    })
  } catch (error) { return entityWriteError(error) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const existing = await findScopedTask(params.id, organizationId, { id: true })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
