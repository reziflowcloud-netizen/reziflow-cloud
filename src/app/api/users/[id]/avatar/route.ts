import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser, signToken } from '@/lib/auth'
import { deleteCloudinaryResource } from '@/lib/cloudinary'
import crypto from 'crypto'
import { cookies } from 'next/headers'

function canManageUsers(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function refreshUserCookie(updatedUser: any, currentUser: any) {
  const token = await signToken({
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    avatarUrl: updatedUser.avatarUrl || null,
    organizationId: currentUser.organizationId || 'org_default',
    organizationName: currentUser.organizationName || 'ReziFlow Cloud',
  })
  cookies().set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
}

async function uploadAvatarToCloudinary(file: File, organizationId: string, userId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = `reziflow-cloud/organizations/${organizationId}/avatars`
  const publicId = `user-${userId}-${timestamp}`
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  const bytes = Buffer.from(await file.arrayBuffer())
  const dataUri = `data:${file.type || 'image/jpeg'};base64,${bytes.toString('base64')}`
  const formData = new FormData()
  formData.append('file', dataUri)
  formData.append('folder', folder)
  formData.append('public_id', publicId)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key', apiKey)
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.secure_url || !data.public_id) {
    throw new Error(data?.error?.message || `Cloudinary upload failed: ${response.status}`)
  }
  return data as { secure_url: string; public_id: string }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const targetId = parseInt(params.id)
  const isSelf = Number(user.id) === targetId
  if (!canManageUsers(user) && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = await prisma.user.findFirst({ where: { id: targetId, organizationId } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Avatar image is too large' }, { status: 400 })

  const uploaded = await uploadAvatarToCloudinary(file, organizationId, String(targetId))
  if ((target as any).avatarPublicId) {
    await deleteCloudinaryResource((target as any).avatarPublicId)
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { avatarUrl: uploaded.secure_url, avatarPublicId: uploaded.public_id } as any,
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
  })
  if (isSelf) await refreshUserCookie(updated, user)
  return NextResponse.json(updated)
}
