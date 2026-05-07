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

  const urls = [doc.url]
  if (doc.fileType === 'pdf') {
    const rawUrl = doc.url
      .replace('/image/upload/', '/raw/upload/')
      .replace('/auto/upload/', '/raw/upload/')
    if (rawUrl !== doc.url) urls.push(rawUrl)
  }

  let response: Response | null = null
  for (const url of urls) {
    const attempt = await fetch(url)
    if (attempt.ok) {
      response = attempt
      break
    }
  }
  if (!response) return NextResponse.json({ error: 'File unavailable' }, { status: 502 })

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
