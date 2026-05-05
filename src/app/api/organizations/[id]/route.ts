import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

function requireAdmin(user: any) {
  return user && (user.role === 'admin' || user.role === 'owner')
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!requireAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const data: any = {}
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.status === 'string') data.status = body.status
    if (typeof body.plan === 'string') data.plan = body.plan
    if ('trialEndsAt' in body) data.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null

    const updated = await prisma.organization.update({
      where: { id: params.id },
      data,
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            cases: true,
            tasks: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сохранения фирмы' }, { status: 500 })
  }
}
