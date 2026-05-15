import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDropboxSettings } from '@/lib/dropbox'

export const dynamic = 'force-dynamic'

function canManageStorage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

function asSettings(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const dropbox = getDropboxSettings(org.settings)
  return NextResponse.json({
    provider: dropbox.enabled ? 'dropbox' : 'cloudinary',
    dropbox: {
      enabled: dropbox.enabled,
      rootFolder: dropbox.rootFolder,
      hasAccessToken: Boolean(dropbox.accessToken),
    },
    canManage: canManageStorage(user),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageStorage(user)) {
    return NextResponse.json({ error: 'Only organization administrators can change document storage' }, { status: 403 })
  }

  const organizationId = getOrganizationId(user)
  const body = await req.json().catch(() => ({}))
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const currentSettings = asSettings(org.settings)
  const currentDropbox = getDropboxSettings(currentSettings)
  const dropbox = body.dropbox && typeof body.dropbox === 'object' ? body.dropbox as Record<string, unknown> : {}
  const rootFolder = String(dropbox.rootFolder || currentDropbox.rootFolder || '/ReziFlow CRM').trim() || '/ReziFlow CRM'
  const accessTokenInput = typeof dropbox.accessToken === 'string' ? dropbox.accessToken.trim() : ''
  const clearAccessToken = dropbox.clearAccessToken === true

  const nextSettings = {
    ...currentSettings,
    dropboxEnabled: dropbox.enabled === true,
    dropboxRootFolder: rootFolder.startsWith('/') ? rootFolder : `/${rootFolder}`,
    dropboxAccessToken: clearAccessToken ? '' : accessTokenInput || currentDropbox.accessToken,
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: nextSettings },
    select: { settings: true },
  })

  const updatedDropbox = getDropboxSettings(updated.settings)
  return NextResponse.json({
    provider: updatedDropbox.enabled ? 'dropbox' : 'cloudinary',
    dropbox: {
      enabled: updatedDropbox.enabled,
      rootFolder: updatedDropbox.rootFolder,
      hasAccessToken: Boolean(updatedDropbox.accessToken),
    },
    canManage: true,
  })
}
