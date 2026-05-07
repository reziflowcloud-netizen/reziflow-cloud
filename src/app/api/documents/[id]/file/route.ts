import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const documentId = parseInt(params.id)
  const doc = await (prisma as any).caseDocument.findFirst({
    where: { id: documentId, case: { organizationId } },
    select: { url: true, name: true, fileType: true },
  })
  if (!doc?.url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const response = await fetch(doc.url)
  if (!response.ok) return NextResponse.json({ error: 'File unavailable' }, { status: 502 })

  const contentType = doc.fileType === 'pdf'
    ? 'application/pdf'
    : response.headers.get('content-type') || 'application/octet-stream'
  const encodedName = encodeURIComponent(doc.name || 'document.pdf')

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
