// src/app/api/cases/[id]/documents/[docId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedCase } from '@/lib/apiScope'
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
      where: { id: parseInt(params.docId) }
    })
    if (doc && doc.caseId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc) {
      const isLocalFile = String(doc.publicId || '').startsWith('local:')
      if (isLocalFile) {
        const publicPath = String(doc.publicId).replace(/^local:/, '').replace(/^\/+/, '')
        const filePath = path.join(process.cwd(), 'public', publicPath)
        try { await unlink(filePath) } catch {}
      }
      // Удалить из Cloudinary
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME
      const apiKey = process.env.CLOUDINARY_API_KEY
      const apiSecret = process.env.CLOUDINARY_API_SECRET
      if (!isLocalFile && cloudName && apiKey && apiSecret && doc.publicId) {
        try {
          const crypto = require('crypto')
          const timestamp = Math.round(Date.now() / 1000)
          const sig = crypto.createHash('sha1')
            .update(`public_id=${doc.publicId}&timestamp=${timestamp}${apiSecret}`)
            .digest('hex')
          await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_id: doc.publicId, signature: sig, api_key: apiKey, timestamp }),
          })
        } catch (e) { console.error('Cloudinary delete error:', e) }
      }
      await (prisma as any).caseDocument.delete({ where: { id: parseInt(params.docId) } })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
