export const SAFE_ASSIGNEE_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const

export function isOrganizationAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const role = String((user as { role?: unknown }).role || '')
  return role === 'admin' || role === 'owner'
}

export function maskCredential(value: unknown): string {
  const credential = typeof value === 'string' ? value.trim() : ''
  if (!credential) return ''
  if (credential.length <= 8) return '********'
  return `${credential.slice(0, 4)}${'*'.repeat(8)}${credential.slice(-4)}`
}

