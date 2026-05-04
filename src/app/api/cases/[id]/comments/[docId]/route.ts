import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scopedCase = await findScopedCase(params.id, organizationId, { id: true })
  if (!scopedCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const doc = await (prisma as any).caseDocument.findUnique({ where: { id: parseInt(params.docId) } })
    if (doc && doc.caseId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc) {
      // Удалить из Cloudinary
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME
      const apiKey = process.env.CLOUDINARY_API_KEY
      const apiSecret = process.env.CLOUDINARY_API_SECRET
      if (cloudName && apiKey && apiSecret) {
        const timestamp = Math.round(Date.now() / 1000)
        const crypto = require('crypto')
        const sig = crypto.createHash('sha1').update(`public_id=${doc.publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex')
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_id: doc.publicId, signature: sig, api_key: apiKey, timestamp }),
        })
      }
      await (prisma as any).caseDocument.delete({ where: { id: parseInt(params.docId) } })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
