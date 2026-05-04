// src/app/api/cases/[id]/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

function safeFileName(name: string) {
  const parsed = path.parse(name || 'document')
  const base = parsed.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_').slice(0, 80) || 'document'
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12)
  return `${base}${ext}`
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
    return NextResponse.json(docs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 })

      const bytes = Buffer.from(await file.arrayBuffer())
      const fileName = `${Date.now()}-${safeFileName(file.name)}`
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'cases', params.id)
      await mkdir(uploadDir, { recursive: true })
      await writeFile(path.join(uploadDir, fileName), bytes)

      const isImage = file.type.startsWith('image/')
      const publicPath = `/uploads/cases/${params.id}/${fileName}`
      const doc = await (prisma as any).caseDocument.create({
        data: {
          caseId: params.id,
          url: publicPath,
          publicId: `local:${publicPath}`,
          name: file.name,
          fileType: isImage ? 'image' : 'pdf',
        },
      })
      return NextResponse.json(doc)
    }

    const body = await req.json()
    const doc = await (prisma as any).caseDocument.create({
      data: {
        caseId: params.id,
        url: body.url,
        publicId: body.publicId,
        name: body.name,
        fileType: body.fileType || 'image',
      }
    })
    return NextResponse.json(doc)
  } catch (e: any) {
    console.error('Document create error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
