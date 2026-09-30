import bcrypt from 'bcryptjs'

type PasswordResetOrganization = {
  id: string
  name?: string
  slug: string
}

type PasswordResetUser = {
  id: number
  organizationId: string | null
  role?: string
}

const ORGANIZATION_EDIT_CREDENTIAL_FIELDS = new Set([
  'adminpassword',
  'newpassword',
  'password',
  'passwordhash',
  'sessionversion',
])

export function hasOrganizationEditCredentialFields(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value as Record<string, unknown>)
    .some(key => ORGANIZATION_EDIT_CREDENTIAL_FIELDS.has(key.toLowerCase()))
}

export function assertAdminPasswordResetTarget(input: {
  requestedOrganizationId: string
  requestedOrganizationSlug: string
  requestedUserId: number
  organization: PasswordResetOrganization
  user: PasswordResetUser
}) {
  const matches =
    input.organization.id === input.requestedOrganizationId &&
    input.organization.slug === input.requestedOrganizationSlug &&
    input.user.id === input.requestedUserId &&
    input.user.organizationId === input.organization.id

  if (!matches) {
    throw new Error('Цель сброса пароля изменилась. Обновите страницу и проверьте организацию и пользователя.')
  }
}

export function createAdminPasswordResetAuditEvent(input: {
  organizationId: string
  userId: number
  actorUserId: number
  timestamp?: Date
}) {
  return {
    event: 'password_reset_admin' as const,
    organizationId: input.organizationId,
    userId: input.userId,
    actorUserId: input.actorUserId,
    timestamp: (input.timestamp || new Date()).toISOString(),
  }
}

export function recordAdminPasswordResetAuditEvent(input: {
  organizationId: string
  userId: number
  actorUserId: number
}) {
  const event = createAdminPasswordResetAuditEvent(input)
  console.info('security_audit', JSON.stringify(event))
  return event
}

type AdminPasswordResetStore = {
  organization: {
    findUnique(args: unknown): Promise<PasswordResetOrganization | null>
  }
  user: {
    findUnique(args: unknown): Promise<PasswordResetUser | null>
    update(args: unknown): Promise<unknown>
  }
}

export async function resetOrganizationAdminPassword(input: {
  store: AdminPasswordResetStore
  organizationId: string
  organizationSlug: string
  userId: number
  newPassword: string
}) {
  const organization = await input.store.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true, slug: true },
  })
  if (!organization) throw new Error('Организация не найдена')

  const targetUser = await input.store.user.findUnique({
    where: { id: input.userId },
    select: { id: true, organizationId: true, role: true },
  })
  if (!targetUser || targetUser.role !== 'admin') {
    throw new Error('Администратор организации не найден')
  }

  assertAdminPasswordResetTarget({
    requestedOrganizationId: input.organizationId,
    requestedOrganizationSlug: input.organizationSlug,
    requestedUserId: input.userId,
    organization,
    user: targetUser,
  })

  const passwordHash = await bcrypt.hash(input.newPassword, 10)
  await input.store.user.update({
    where: { id: targetUser.id },
    data: {
      password: passwordHash,
      sessionVersion: { increment: 1 },
    },
  })

  return {
    organizationId: organization.id,
    organizationName: organization.name || '',
    organizationSlug: organization.slug,
    userId: targetUser.id,
  }
}
