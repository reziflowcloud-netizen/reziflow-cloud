import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { downloadDropboxFile, getDropboxSettings } from '@/lib/dropbox'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { getAuthenticatedCloudinaryDocumentUrl } from '@/lib/cloudinary'
import { isApprovedCloudinaryUrl, resolveLocalDocumentPath } from '@/lib/documentSecurity'
import { readFile } from 'fs/promises'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const documentId = parseInt(params.id)
  const doc = await (prisma as any).caseDocument.findFirst({
    where: { id: documentId, case: caseWhereForScope(scope, organizationId) },
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

  const encodedName = encodeURIComponent(doc.name || 'document')
  const responseHeaders = (contentType: string) => ({
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })

  if (String(doc.publicId || '').startsWith('local:')) {
    try {
      const filePath = resolveLocalDocumentPath(`${process.cwd()}/public`, doc.publicId)
      const bytes = await readFile(filePath)
      return new NextResponse(bytes, {
        headers: responseHeaders(doc.mimeType || (doc.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream')),
      })
    } catch {
      return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
    }
  }

  if (!doc.url && (doc.storageProvider === 'dropbox' || doc.dropboxStorageId || doc.dropboxPath)) {
    const dropbox = getDropboxSettings(doc.case?.organization?.settings)
    const pathOrId = doc.dropboxStorageId || doc.storageId || doc.dropboxPath || doc.storagePath || doc.publicId
    if (!dropbox.accessToken || !pathOrId) return NextResponse.json({ error: 'Dropbox is not configured' }, { status: 409 })

    const response = await downloadDropboxFile(dropbox.accessToken, pathOrId)
    return new NextResponse(response.body, {
      headers: responseHeaders(doc.mimeType || response.headers.get('content-type') || 'application/octet-stream'),
    })
  }

  let providerUrl = ''
  if (doc.storageProvider === 'cloudinary_authenticated' && doc.publicId) {
    try {
      providerUrl = getAuthenticatedCloudinaryDocumentUrl({
        publicId: doc.publicId,
        resourceType: doc.storagePath === 'raw' || doc.fileType === 'pdf' ? 'raw' : 'image',
        version: doc.storageId ? Number(doc.storageId) : null,
      })
    } catch {
      return NextResponse.json({ error: 'File provider is not configured' }, { status: 503 })
    }
  } else if (doc.url && isApprovedCloudinaryUrl(doc.url, process.env.CLOUDINARY_CLOUD_NAME)) {
    providerUrl = doc.url
  }

  if (!providerUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404 })

  const urls = [providerUrl]
  if (doc.fileType === 'pdf' && doc.storageProvider !== 'cloudinary_authenticated') {
    const rawUrl = providerUrl
      .replace('/image/upload/', '/raw/upload/')
      .replace('/auto/upload/', '/raw/upload/')
    if (rawUrl !== providerUrl && isApprovedCloudinaryUrl(rawUrl, process.env.CLOUDINARY_CLOUD_NAME)) urls.push(rawUrl)
  }

  let response: Response | null = null
  for (const url of urls) {
    try {
      const attempt = await fetch(url, { redirect: 'manual', cache: 'no-store' })
      if (attempt.ok) {
        response = attempt
        break
      }
    } catch {
      // Provider/network failures are intentionally reported without internal details.
    }
  }
  if (!response) return NextResponse.json({ error: 'File unavailable' }, { status: 502 })

  const contentType = doc.fileType === 'pdf'
    ? 'application/pdf'
    : response.headers.get('content-type') || 'application/octet-stream'
  return new NextResponse(response.body, {
    headers: responseHeaders(contentType),
  })
}
