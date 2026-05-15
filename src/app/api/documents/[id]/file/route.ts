import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { downloadDropboxFile, getDropboxSettings } from '@/lib/dropbox'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const documentId = parseInt(params.id)
  const doc = await (prisma as any).caseDocument.findFirst({
    where: { id: documentId, case: { organizationId } },
    select: {
      url: true,
      publicId: true,
      name: true,
      fileType: true,
      storageProvider: true,
      storageId: true,
      storagePath: true,
      dropboxStorageId: true,
      dropboxPath: true,
      mimeType: true,
      case: { select: { organization: { select: { settings: true } } } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!doc.url && (doc.storageProvider === 'dropbox' || doc.dropboxStorageId || doc.dropboxPath)) {
    const dropbox = getDropboxSettings(doc.case?.organization?.settings)
    const pathOrId = doc.dropboxStorageId || doc.storageId || doc.dropboxPath || doc.storagePath || doc.publicId
    if (!dropbox.accessToken || !pathOrId) return NextResponse.json({ error: 'Dropbox is not configured' }, { status: 409 })

    const response = await downloadDropboxFile(dropbox.accessToken, pathOrId)
    const encodedName = encodeURIComponent(doc.name || 'document')
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': doc.mimeType || response.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  if (!doc.url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
