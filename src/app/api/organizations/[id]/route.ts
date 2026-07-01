import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import path from 'path'
import { unlink } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { deleteCloudinaryResources } from '@/lib/cloudinary'
import { deleteDropboxFile, getDropboxSettings } from '@/lib/dropbox'
import { isSystemAdmin, organizationInclude } from '@/lib/organizationProvisioning'

const BILLING_LIMIT_KEYS = ['users', 'clients', 'cases', 'leads'] as const
type BillingLimitKey = typeof BILLING_LIMIT_KEYS[number]

function plainObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return { ...(value as Record<string, any>) }
}

function normalizeBillingLimits(value: unknown) {
  const source = plainObject(value)
  const limits: Partial<Record<BillingLimitKey, number | null>> = {}

  for (const key of BILLING_LIMIT_KEYS) {
    if (!(key in source)) continue
    const raw = source[key]
    if (raw === null || raw === 'unlimited') {
      limits[key] = null
      continue
    }

    const numeric = Number(raw)
    if (Number.isFinite(numeric) && numeric > 0) {
      limits[key] = Math.floor(numeric)
    }
  }

  return limits
}

async function deleteLocalDocument(publicId: string | null | undefined) {
  if (!publicId || !String(publicId).startsWith('local:')) return false

  const publicRoot = path.resolve(process.cwd(), 'public')
  const publicPath = String(publicId).replace(/^local:/, '').replace(/^\/+/, '')
  const filePath = path.resolve(publicRoot, publicPath)
  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) return false

  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function cleanupOrganizationDocumentFiles(organizationId: string, organizationSettings: unknown) {
  const documents = await (prisma as any).caseDocument.findMany({
    where: { case: { organizationId } },
    select: {
      publicId: true,
      storageProvider: true,
      storageId: true,
      storagePath: true,
      dropboxStorageId: true,
      dropboxPath: true,
    },
  })

  const cloudinaryPublicIds = documents
    .filter((doc: any) => doc.publicId && doc.storageProvider !== 'dropbox' && !String(doc.publicId).startsWith('local:'))
    .map((doc: any) => doc.publicId)

  const [deletedCloudinaryFiles, localResults] = await Promise.all([
    deleteCloudinaryResources(cloudinaryPublicIds),
    Promise.all(documents.map((doc: any) => deleteLocalDocument(doc.publicId))),
  ])

  const dropbox = getDropboxSettings(organizationSettings)
  let deletedDropboxFiles = 0
  if (dropbox.accessToken) {
    for (const doc of documents as any[]) {
      const isDropboxOnly = doc.storageProvider === 'dropbox'
      const dropboxPathOrId = doc.dropboxStorageId || doc.dropboxPath || doc.storageId || doc.storagePath || (isDropboxOnly ? doc.publicId : null)
      if (!dropboxPathOrId) continue
      try {
        await deleteDropboxFile(dropbox.accessToken, dropboxPathOrId)
        deletedDropboxFiles += 1
      } catch (error) {
        console.error('Dropbox organization document delete error:', error)
      }
    }
  }

  return {
    documentsFound: documents.length,
    deletedCloudinaryFiles,
    deletedDropboxFiles,
    deletedLocalFiles: localResults.filter(Boolean).length,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(user.role === 'admin' || user.role === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const canManageAll = isSystemAdmin(user)
  if (!canManageAll && params.id !== getOrganizationId(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data: any = {}
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (canManageAll) {
      if (typeof body.status === 'string') data.status = body.status
      if (typeof body.plan === 'string') data.plan = body.plan
      if (typeof body.billingStatus === 'string') data.billingStatus = body.billingStatus
      if ('trialEndsAt' in body) data.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null
      if ('currentPeriodEndsAt' in body) data.currentPeriodEndsAt = body.currentPeriodEndsAt ? new Date(body.currentPeriodEndsAt) : null
      if ('graceEndsAt' in body) data.graceEndsAt = body.graceEndsAt ? new Date(body.graceEndsAt) : null
    }

    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : ''
    const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : ''
    const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : ''

    const updated = await prisma.$transaction(async tx => {
      const organizationData = { ...data }

      if (canManageAll && 'billingLimits' in body) {
        const existingOrganization = await tx.organization.findUnique({
          where: { id: params.id },
          select: { settings: true },
        })
        const settings = plainObject(existingOrganization?.settings)
        const billingLimits = normalizeBillingLimits(body.billingLimits)

        if (Object.keys(billingLimits).length) {
          settings.billingLimits = billingLimits
        } else {
          delete settings.billingLimits
        }

        organizationData.settings = settings
      }

      await tx.organization.update({
        where: { id: params.id },
        data: organizationData,
      })

      if (canManageAll && (adminName || adminEmail || adminPassword)) {
        const primaryAdmin = await tx.user.findFirst({
          where: { organizationId: params.id, role: 'admin' },
          orderBy: { createdAt: 'asc' },
        })

        if (!primaryAdmin) {
          throw new Error('У этой фирмы пока нет администратора')
        }

        const userData: any = {}
        if (adminName) userData.name = adminName
        if (adminEmail && adminEmail !== primaryAdmin.email) {
          const existingEmail = await tx.user.findUnique({ where: { email: adminEmail } })
          if (existingEmail && existingEmail.id !== primaryAdmin.id) {
            throw new Error('Пользователь с таким email уже есть')
          }
          userData.email = adminEmail
        }
        if (adminPassword) {
          if (adminPassword.length < 6) {
            throw new Error('Пароль должен быть не короче 6 символов')
          }
          userData.password = await bcrypt.hash(adminPassword, 10)
        }

        if (Object.keys(userData).length) {
          await tx.user.update({
            where: { id: primaryAdmin.id },
            data: userData,
          })
        }
      }

      return tx.organization.findUnique({
        where: { id: params.id },
        include: organizationInclude,
      })
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сохранения фирмы' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const currentOrganizationId = getOrganizationId(user)
  if (params.id === currentOrganizationId) {
    return NextResponse.json({ error: 'Нельзя удалить организацию, в которой вы сейчас работаете' }, { status: 400 })
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, settings: true },
    })
    if (!organization) {
      return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
    }

    const organizationCount = await prisma.organization.count()
    if (organizationCount <= 1) {
      return NextResponse.json({ error: 'Нельзя удалить последнюю организацию' }, { status: 400 })
    }

    const fileCleanup = await cleanupOrganizationDocumentFiles(params.id, organization.settings)

    await prisma.$transaction(async tx => {
      const cases = await tx.case.findMany({
        where: { organizationId: params.id },
        select: { id: true },
      })
      const caseIds = cases.map(item => item.id)

      if (caseIds.length) {
        await tx.caseCustomDate.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.docUpdate.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.caseDocument.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.statusHistory.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.comment.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.document.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.payment.deleteMany({ where: { caseId: { in: caseIds } } })
        await tx.case.deleteMany({ where: { id: { in: caseIds } } })
      }

      const clients = await tx.client.findMany({
        where: { organizationId: params.id },
        select: { id: true },
      })
      const clientIds = clients.map(item => item.id)

      if (clientIds.length) {
        await tx.travelHistory.deleteMany({ where: { clientId: { in: clientIds } } })
        await tx.previousPolandStay.deleteMany({ where: { clientId: { in: clientIds } } })
        await tx.clientFamilyLink.deleteMany({
          where: {
            OR: [
              { organizationId: params.id },
              { clientId: { in: clientIds } },
              { relativeClientId: { in: clientIds } },
            ],
          },
        })
        await tx.clientPhone.deleteMany({ where: { organizationId: params.id } })
        await tx.client.deleteMany({ where: { id: { in: clientIds } } })
      }

      const leads = await tx.lead.findMany({
        where: { organizationId: params.id },
        select: { id: true },
      })
      const leadIds = leads.map(item => item.id)

      if (leadIds.length) {
        await tx.leadPhone.deleteMany({ where: { organizationId: params.id } })
        await tx.leadContactHistory.deleteMany({ where: { organizationId: params.id } })
        await tx.leadMessage.deleteMany({ where: { organizationId: params.id } })
        await tx.leadWebhookLog.deleteMany({ where: { organizationId: params.id } })
        await tx.lead.deleteMany({ where: { id: { in: leadIds } } })
      } else {
        await tx.leadWebhookLog.deleteMany({ where: { organizationId: params.id } })
      }

      const customSections = await tx.customSection.findMany({
        where: { organizationId: params.id },
        select: { id: true },
      })
      const customSectionIds = customSections.map(item => item.id)

      await tx.customFieldValue.deleteMany({ where: { organizationId: params.id } })
      if (customSectionIds.length) {
        await tx.customField.deleteMany({ where: { sectionId: { in: customSectionIds } } })
        await tx.customSection.deleteMany({ where: { id: { in: customSectionIds } } })
      }

      await tx.task.deleteMany({ where: { organizationId: params.id } })
      await tx.documentTemplate.deleteMany({ where: { organizationId: params.id } })
      await tx.uiSectionSetting.deleteMany({ where: { organizationId: params.id } })
      await tx.leadStatus.deleteMany({ where: { organizationId: params.id } })
      await tx.caseStatus.deleteMany({ where: { organizationId: params.id } })
      await tx.taskPriority.deleteMany({ where: { organizationId: params.id } })
      await tx.service.deleteMany({ where: { organizationId: params.id } })
      await tx.caseOption.deleteMany({ where: { organizationId: params.id } })
      await tx.employee.deleteMany({ where: { organizationId: params.id } })
      await tx.referralCommission.deleteMany({ where: { organizationId: params.id } })
      await tx.referralAttribution.deleteMany({ where: { organizationId: params.id } })
      await tx.user.deleteMany({ where: { organizationId: params.id } })
      await tx.organization.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ success: true, id: organization.id, name: organization.name, fileCleanup })
  } catch (e: any) {
    console.error('Organization delete error:', e)
    return NextResponse.json({ error: e.message || 'Ошибка удаления организации' }, { status: 500 })
  }
}
