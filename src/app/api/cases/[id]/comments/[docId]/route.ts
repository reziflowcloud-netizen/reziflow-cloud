import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
import { deleteCloudinaryResource } from '@/lib/cloudinary'
import { caseChildWhere } from '@/lib/nestedResourceScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const doc = await (prisma as any).caseDocument.findFirst({ where: caseChildWhere(params.id, parseInt(params.docId)) })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc) {
      await deleteCloudinaryResource(doc.publicId, {
        authenticated: doc.storageProvider === 'cloudinary_authenticated',
        resourceType: doc.storagePath === 'raw' || doc.fileType === 'pdf' ? 'raw' : 'image',
      })
      await (prisma as any).caseDocument.delete({ where: { id: doc.id } })
    }
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Document delete failed' }, { status: 500 }) }
}
