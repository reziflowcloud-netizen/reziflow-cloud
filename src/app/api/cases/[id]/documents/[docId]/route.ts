// src/app/api/cases/[id]/documents/[docId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { deleteCloudinaryResource } from '@/lib/cloudinary'
import { deleteDropboxFile, getDropboxSettings } from '@/lib/dropbox'
import { resolveLocalDocumentPath } from '@/lib/documentSecurity'
import { caseChildWhere } from '@/lib/nestedResourceScope'
import { unlink } from 'fs/promises'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const doc = await (prisma as any).caseDocument.findFirst({
      where: caseChildWhere(params.id, parseInt(params.docId)),
      include: { case: { select: { organization: { select: { settings: true } } } } },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc) {
      const isLocalFile = String(doc.publicId || '').startsWith('local:')
      if (isLocalFile) {
        try {
          const filePath = resolveLocalDocumentPath(`${process.cwd()}/public`, doc.publicId)
          await unlink(filePath)
        } catch {}
      }
      const isDropboxOnly = doc.storageProvider === 'dropbox'
      if (!isLocalFile && doc.publicId && !isDropboxOnly) {
        await deleteCloudinaryResource(doc.publicId, {
          authenticated: doc.storageProvider === 'cloudinary_authenticated',
          resourceType: doc.storagePath === 'raw' || doc.fileType === 'pdf' ? 'raw' : 'image',
        })
      }

      const dropboxPathOrId = doc.dropboxStorageId || doc.dropboxPath || doc.storageId || doc.storagePath || (isDropboxOnly ? doc.publicId : null)
      if (dropboxPathOrId) {
        const dropbox = getDropboxSettings(doc.case?.organization?.settings)
        if (dropbox.accessToken) {
          try { await deleteDropboxFile(dropbox.accessToken, dropboxPathOrId) } catch (error) {
            console.error('Dropbox delete error:', error instanceof Error ? error.name : 'UnknownError')
          }
        }
      }
      await (prisma as any).caseDocument.delete({ where: { id: doc.id } })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Document delete failed' }, { status: 500 })
  }
}
