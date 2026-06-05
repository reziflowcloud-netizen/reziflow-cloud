// src/app/api/cases/[id]/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { getDropboxSettings, joinDropboxPath, sanitizeDropboxSegment, uploadDropboxFile } from '@/lib/dropbox'
import crypto from 'crypto'
import path from 'path'

function safeFileName(name: string) {
  const parsed = path.parse(name || 'document')
  const base = parsed.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_').slice(0, 80) || 'document'
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12)
  return `${base}${ext}`
}

async function uploadFileToCloudinary(file: File, caseId: string, bytes?: Buffer) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary не настроен: добавьте CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY и CLOUDINARY_API_SECRET в Vercel')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = `reziflow-cloud/cases/${caseId}`
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  const fileBytes = bytes || Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'
  const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const resourceType = isPdf ? 'raw' : 'image'
  const dataUri = `data:${mimeType};base64,${fileBytes.toString('base64')}`
  const formData = new FormData()
  formData.append('file', dataUri)
  formData.append('folder', folder)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key', apiKey)
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.secure_url || !data.public_id) {
    throw new Error(data?.error?.message || `Cloudinary upload failed: ${response.status}`)
  }
  return data as { secure_url: string; public_id: string; resource_type?: string }
}

function serializeDocument(doc: any) {
  if (!doc) return doc
  if (doc.storageProvider === 'dropbox' && !doc.url) {
    return { ...doc, url: `/api/documents/${doc.id}/file` }
  }
  return doc
}

function fileTypeFor(file: File) {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  return isImage ? 'image' : isPdf ? 'pdf' : 'file'
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
    console.error('Dropbox copy upload error:', error)
    return {
      status: 'failed' as const,
      error: String(error?.message || error || 'Dropbox upload failed').slice(0, 1000),
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
    return NextResponse.json(docs.map(serializeDocument))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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

      const safeName = safeFileName(file.name)
      const mimeType = file.type || 'application/octet-stream'
      const fileType = fileTypeFor(file)
      const bytes = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadFileToCloudinary(file, params.id, bytes)
      const dropboxCopy = await uploadDropboxCopy({ file, safeName, scopedCase, caseId: params.id, bytes })
      const doc = await (prisma as any).caseDocument.create({
        data: {
          caseId: params.id,
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          name: safeName,
          fileType,
          storageProvider: 'cloudinary',
          dropboxStorageId: dropboxCopy.status === 'synced' ? dropboxCopy.storageId : null,
          dropboxPath: dropboxCopy.status === 'synced' ? dropboxCopy.path : null,
          dropboxSyncedAt: dropboxCopy.status === 'synced' ? new Date() : null,
          dropboxSyncStatus: dropboxCopy.status,
          dropboxSyncError: dropboxCopy.status === 'failed' ? dropboxCopy.error : null,
          mimeType,
          size: file.size,
        },
      })
      return NextResponse.json(serializeDocument(doc))
    }

    const body = await req.json()
    const doc = await (prisma as any).caseDocument.create({
      data: {
        caseId: params.id,
        url: body.url,
        publicId: body.publicId,
        name: body.name,
        fileType: body.fileType || 'image',
        storageProvider: 'cloudinary',
      }
    })
    return NextResponse.json(serializeDocument(doc))
  } catch (e: any) {
    console.error('Document create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
