// src/app/api/cases/[id]/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { getDropboxSettings, joinDropboxPath, sanitizeDropboxSegment, uploadDropboxFile } from '@/lib/dropbox'
import { uploadAuthenticatedCloudinaryDocument } from '@/lib/cloudinary'
import {
  DocumentValidationError,
  MAX_DOCUMENT_UPLOAD_BYTES,
  serializeDocumentForBrowser,
  validateDocumentUpload,
} from '@/lib/documentSecurity'
import path from 'path'

function safeFileName(name: string) {
  const parsed = path.parse(name || 'document')
  const base = parsed.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_').slice(0, 80) || 'document'
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12)
  return `${base}${ext}`
}

async function uploadDropboxCopy(args: {
  file: File
  safeName: string
  scopedCase: any
  caseId: string
  bytes: Buffer
}) {
  const dropbox = getDropboxSettings(args.scopedCase.organization?.settings)
  if (!dropbox.enabled || !dropbox.accessToken) {
    return { status: 'disabled' as const }
  }

  try {
    const clientName = sanitizeDropboxSegment(
      `${args.scopedCase.client?.lastName || ''} ${args.scopedCase.client?.firstName || ''}`.trim() || args.scopedCase.client?.phone,
      'Client',
    )
    const caseName = sanitizeDropboxSegment(args.scopedCase.caseNumber || args.caseId, 'Case')
    const filePath = joinDropboxPath(
      dropbox.rootFolder,
      sanitizeDropboxSegment(args.scopedCase.organization?.name, 'Organization'),
      'Clients',
      clientName,
      'Cases',
      caseName,
      `${Date.now()}_${args.safeName}`,
    )
    const uploaded = await uploadDropboxFile({ accessToken: dropbox.accessToken, path: filePath, bytes: args.bytes })
    return {
      status: 'synced' as const,
      storageId: uploaded.id || null,
      path: uploaded.path_display || uploaded.path_lower || filePath,
      size: uploaded.size || args.file.size,
    }
  } catch (error: any) {
    console.error('Dropbox copy upload error:', error instanceof Error ? error.name : 'UnknownError')
    return {
      status: 'failed' as const,
      error: 'Dropbox upload failed',
    }
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const docs = await (prisma as any).caseDocument.findMany({
      where: { caseId: params.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(docs.map(serializeDocumentForBrowser))
  } catch {
    return NextResponse.json({ error: 'Documents could not be loaded' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
    const scopedCase = await findScopedCase(params.id, organizationId, {
        id: true,
        caseNumber: true,
        organization: { select: { name: true, settings: true } },
        client: { select: { firstName: true, lastName: true, phone: true } },
    })
    if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 })
      if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'File is too large. Maximum size is 150 MB.' }, { status: 413 })
      }

      const safeName = safeFileName(file.name)
      const bytes = Buffer.from(await file.arrayBuffer())
      const validated = validateDocumentUpload({
        bytes,
        declaredMime: file.type,
        declaredSize: file.size,
        name: file.name,
      })
      const uploaded = await uploadAuthenticatedCloudinaryDocument({
        bytes,
        folder: `legalhub-private/cases/${params.id}`,
        resourceType: validated.resourceType,
      })
      const dropboxCopy = await uploadDropboxCopy({ file, safeName, scopedCase, caseId: params.id, bytes })
      const doc = await (prisma as any).caseDocument.create({
        data: {
          caseId: params.id,
          url: null,
          publicId: uploaded.public_id,
          name: safeName,
          fileType: validated.fileType,
          storageProvider: 'cloudinary_authenticated',
          storageId: String(uploaded.version || ''),
          storagePath: validated.resourceType,
          dropboxStorageId: dropboxCopy.status === 'synced' ? dropboxCopy.storageId : null,
          dropboxPath: dropboxCopy.status === 'synced' ? dropboxCopy.path : null,
          dropboxSyncedAt: dropboxCopy.status === 'synced' ? new Date() : null,
          dropboxSyncStatus: dropboxCopy.status,
          dropboxSyncError: dropboxCopy.status === 'failed' ? dropboxCopy.error : null,
          mimeType: validated.mimeType,
          size: file.size,
        },
      })
      return NextResponse.json(serializeDocumentForBrowser(doc))
    }

    return NextResponse.json({ error: 'Direct document URLs are not accepted' }, { status: 400 })
  } catch (e: any) {
    console.error('Document create error:', e instanceof Error ? e.name : 'UnknownError')
    const status = e instanceof DocumentValidationError ? e.status : 500
    return NextResponse.json({ error: status === 500 ? 'Document upload failed' : e.message }, { status })
  }
}
