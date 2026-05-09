import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DOCUMENT_TEMPLATE_TYPES, getTemplateLabel } from '@/lib/documentTemplates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function canManageTemplates(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function isTemplateType(type: string) {
  return DOCUMENT_TEMPLATE_TYPES.some(item => item.type === type)
}

function safeDocxFileName(name: string) {
  const base = (name || 'template.docx').replace(/[/\\?%*:|"<>]+/g, '_').slice(0, 120)
  return base.toLowerCase().endsWith('.docx') ? base : `${base}.docx`
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const templates = await (prisma as any).documentTemplate.findMany({
    where: { organizationId },
    select: {
      id: true,
      type: true,
      name: true,
      fileName: true,
      mimeType: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { type: 'asc' },
  })

  return NextResponse.json({
    types: DOCUMENT_TEMPLATE_TYPES,
    templates,
  })
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageTemplates(user)) {
    return NextResponse.json({ error: 'Only organization administrators can manage document templates' }, { status: 403 })
  }

  const organizationId = getOrganizationId(user)
  const formData = await request.formData()
  const type = String(formData.get('type') || '')
  const file = formData.get('file')

  if (!isTemplateType(type)) return NextResponse.json({ error: 'Unknown template type' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'DOCX file is required' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: 'Upload a .docx file' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Template is too large. Maximum size is 8 MB.' }, { status: 413 })
  }

  const template = await (prisma as any).documentTemplate.upsert({
    where: { organizationId_type: { organizationId, type } },
    update: {
      name: getTemplateLabel(type),
      fileName: safeDocxFileName(file.name),
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: bytes,
    },
    create: {
      organizationId,
      type,
      name: getTemplateLabel(type),
      fileName: safeDocxFileName(file.name),
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: bytes,
    },
    select: {
      id: true,
      type: true,
      name: true,
      fileName: true,
      mimeType: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(template)
}
