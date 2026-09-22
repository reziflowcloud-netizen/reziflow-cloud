import { prisma } from '@/lib/prisma'
import { getLeadWebhookSettings, settingsObject, type LeadWebhookSettings } from '@/lib/leadWebhook'
import { leadAssignmentData, type LeadAssignmentData } from '@/lib/leadAssignmentPolicy'
import { chooseLeadAssignment } from '@/lib/leadRoutingPolicy'
import { takeNextChannelAssignment } from '@/lib/channelRoundRobin'

export type LeadAssignmentOrigin = 'external' | 'channel' | 'fallback' | 'none'
export type RoutedLeadAssignment = LeadAssignmentData & { origin: LeadAssignmentOrigin }

export function normalizeSourceKey(value: unknown) {
  return String(value || '').trim().toLowerCase().slice(0, 80)
}

async function assignmentForUser(client: any, organizationId: string, rawUserId: unknown) {
  const userId = Number(rawUserId)
  if (!Number.isInteger(userId) || userId <= 0) return null
  const user = await client.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true, employee: { select: { id: true, active: true } } },
  })
  if (!user) return null
  return {
    employeeId: user.employee?.active === false ? null : user.employee?.id || null,
    assignedToId: user.id,
  }
}

export async function resolveInboundLeadAssignment({
  organizationId,
  sourceKey,
  explicitAssignedToId,
  organizationSettings,
  settings: inputSettings,
  client = prisma,
}: {
  organizationId: string
  sourceKey: unknown
  explicitAssignedToId?: unknown
  organizationSettings?: unknown
  settings?: LeadWebhookSettings
  client?: any
}): Promise<RoutedLeadAssignment> {
  const explicit = await assignmentForUser(client, organizationId, explicitAssignedToId)
  if (explicit) return chooseLeadAssignment({ external: explicit })

  const channel = normalizeSourceKey(sourceKey)
  if (channel && channel !== 'manual') {
    const channelAssignment = await takeNextChannelAssignment(client, organizationId, channel)
    if (channelAssignment) return chooseLeadAssignment({ channel: channelAssignment })
  }

  const settings = inputSettings || getLeadWebhookSettings(organizationSettings)
  if (settings.leadWebhookAssignmentMode === 'single' && settings.leadWebhookAssignmentUserId) {
    const fallback = await assignmentForUser(client, organizationId, settings.leadWebhookAssignmentUserId)
    if (fallback) return chooseLeadAssignment({ fallback })
  }

  if (settings.leadWebhookAssignmentMode === 'round_robin') {
    const configuredIds = settings.leadWebhookAssignmentUserIds || []
    const users = await client.user.findMany({
      where: { id: { in: configuredIds }, organizationId },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const available = new Set(users.map((user: any) => user.id))
    const validIds = configuredIds.filter(id => available.has(id))
    if (validIds.length) {
      const cursor = settings.leadWebhookAssignmentCursor || 0
      const picked = validIds[cursor % validIds.length]
      const rawOrganizationSettings = organizationSettings === undefined
        ? (await client.organization.findUnique({ where: { id: organizationId }, select: { settings: true } }))?.settings
        : organizationSettings
      await client.organization.update({
        where: { id: organizationId },
        data: {
          settings: {
            ...settingsObject(rawOrganizationSettings),
            leadWebhookAssignmentCursor: cursor + 1,
          },
        },
      })
      const fallback = await assignmentForUser(client, organizationId, picked)
      if (fallback) return chooseLeadAssignment({ fallback })
    }
  }

  return chooseLeadAssignment({})
}
