// src/app/api/clients/[id]/travel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  try {
    const entry = await (prisma as any).travelHistory.create({
      data: {
        clientId: params.id,
        country: body.country,
        entryDate: body.entryDate ? new Date(body.entryDate) : null,
        exitDate: body.exitDate ? new Date(body.exitDate) : null,
      }
    })
    return NextResponse.json(entry)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
