type PasswordResetOrganization = {
  id: string
  slug: string
}

type PasswordResetUser = {
  id: number
  organizationId: string | null
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
