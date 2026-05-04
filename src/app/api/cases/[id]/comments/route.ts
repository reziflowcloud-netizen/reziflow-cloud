import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const text = String(body.text || '').trim()
    if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })

    const comment = await prisma.comment.create({
      data: {
        caseId: params.id,
        text,
        author: String((user as any).name || (user as any).email || 'User'),
      },
    })

    return NextResponse.json(comment)
  } catch (e: any) {
    console.error('Comment create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
