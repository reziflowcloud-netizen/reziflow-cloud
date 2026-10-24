import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { writeDocUpdate, DocUpdateError } from '@/lib/docUpdateWrite'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await writeDocUpdate(user, params.id, 'create', await req.json()))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof DocUpdateError ? e.message : 'Unable to save document update' },
      { status: e instanceof DocUpdateError ? e.status : e instanceof SyntaxError ? 400 : 500 },
    )
  }
}
