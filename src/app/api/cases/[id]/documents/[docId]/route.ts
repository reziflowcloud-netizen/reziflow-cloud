// src/app/api/cases/[id]/documents/[docId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { deleteCloudinaryResource } from '@/lib/cloudinary'
import { deleteDropboxFile, getDropboxSettings } from '@/lib/dropbox'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const doc = await (prisma as any).caseDocument.findUnique({
      where: { id: parseInt(params.docId) },
      include: { case: { select: { organization: { select: { settings: true } } } } },
    })
    if (doc && doc.caseId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc) {
      const isLocalFile = String(doc.publicId || '').startsWith('local:')
      if (isLocalFile) {
        const publicPath = String(doc.publicId).replace(/^local:/, '').replace(/^\/+/, '')
        const filePath = path.join(process.cwd(), 'public', publicPath)
        try { await unlink(filePath) } catch {}
      }
      const isDropboxOnly = doc.storageProvider === 'dropbox'
      if (!isLocalFile && doc.publicId && !isDropboxOnly) {
        await deleteCloudinaryResource(doc.publicId)
      }

      const dropboxPathOrId = doc.dropboxStorageId || doc.dropboxPath || doc.storageId || doc.storagePath || (isDropboxOnly ? doc.publicId : null)
      if (dropboxPathOrId) {
        const dropbox = getDropboxSettings(doc.case?.organization?.settings)
        if (dropbox.accessToken) {
          try { await deleteDropboxFile(dropbox.accessToken, dropboxPathOrId) } catch (error) { console.error('Dropbox delete error:', error) }
        }
      }
      await (prisma as any).caseDocument.delete({ where: { id: parseInt(params.docId) } })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
