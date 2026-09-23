export type PasswordResetAuditName =
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_delivery_failed'

export function createPasswordResetAuditEvent(input: {
  event: PasswordResetAuditName
  userId: number
  organizationId: string | null
  timestamp?: Date
}) {
  return {
    event: input.event,
    userId: input.userId,
    organizationId: input.organizationId,
    actor: 'self_service' as const,
    timestamp: (input.timestamp || new Date()).toISOString(),
  }
}

export function recordPasswordResetAuditEvent(input: {
  event: PasswordResetAuditName
  userId: number
  organizationId: string | null
}) {
  const event = createPasswordResetAuditEvent(input)
  console.info('security_audit', JSON.stringify(event))
  return event
}
