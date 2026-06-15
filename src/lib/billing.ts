import { prisma } from '@/lib/prisma'

export type BillingMetricKey = 'users' | 'clients' | 'cases' | 'leads'

export type PlanLimits = Record<BillingMetricKey, number | null>
export type BillingLimitOverrides = Partial<Record<BillingMetricKey, number | null>>

export type PlanDefinition = {
  key: string
  name: string
  subtitle: string
  price: string
  limits: PlanLimits
  features: string[]
}

export type BillingSnapshot = {
  organization: {
    id: string
    name: string
    plan: string
    status: string
    billingStatus: string
    trialEndsAt: string | null
    currentPeriodEndsAt: string | null
    cancelAtPeriodEnd: boolean
  }
  plan: PlanDefinition
  usage: Record<BillingMetricKey, number>
  softLimitWarnings: BillingMetricKey[]
  customLimitKeys: BillingMetricKey[]
}

const BILLING_METRIC_KEYS: BillingMetricKey[] = ['users', 'clients', 'cases', 'leads']

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    subtitle: 'Для небольшого старта и проверки CRM',
    price: '0 PLN',
    limits: { users: 1, clients: 25, cases: 25, leads: 50 },
    features: [
      'Базовая CRM: клиенты, дела, задачи и календарь',
      'Импорт и экспорт CSV',
      'Один администратор организации',
      'Ручная оплата и ручное сопровождение',
    ],
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    subtitle: 'Для небольшой команды с регулярной работой',
    price: '99 PLN / мес.',
    limits: { users: 3, clients: 150, cases: 150, leads: 300 },
    features: [
      'До 3 пользователей',
      'Работа с лидами и клиентской базой',
      'Настройки процессов и шаблоны документов',
      'Подходит для небольшой фирмы',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    subtitle: 'Для активной команды и роста продаж',
    price: '199 PLN / мес.',
    limits: { users: 10, clients: null, cases: null, leads: null },
    features: [
      'До 10 пользователей',
      'Без лимита клиентов, дел и лидов',
      'Интеграции с формами, квизами и рекламой',
      'Приоритетная настройка рабочего процесса',
    ],
  },
  agency: {
    key: 'agency',
    name: 'Agency',
    subtitle: 'Для агентств с несколькими отделами',
    price: 'По договоренности',
    limits: { users: null, clients: null, cases: null, leads: null },
    features: [
      'Неограниченная команда',
      'Расширенные настройки и интеграции',
      'Помощь с переносом данных',
      'Индивидуальные условия сопровождения',
    ],
  },
  manual: {
    key: 'manual',
    name: 'Manual',
    subtitle: 'Ручной тариф для внутреннего администрирования',
    price: 'Ручной',
    limits: { users: null, clients: null, cases: null, leads: null },
    features: [
      'Ручное управление доступом',
      'Без автоматических ограничений',
      'Используется для администрируемых организаций',
      'Настройки меняются администратором LegalHub',
    ],
  },
}

export const BILLING_METRIC_LABELS: Record<BillingMetricKey, string> = {
  users: 'Пользователи',
  clients: 'Клиенты',
  cases: 'Дела',
  leads: 'Лиды',
}

export function canManageBilling(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export function normalizePlanKey(plan?: string | null) {
  const key = String(plan || 'manual').toLowerCase()
  return PLAN_DEFINITIONS[key] ? key : 'manual'
}

export function getPlanDefinition(plan?: string | null) {
  return PLAN_DEFINITIONS[normalizePlanKey(plan)]
}

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function getBillingLimitOverrides(settings: unknown): BillingLimitOverrides {
  const raw = settingsObject(settingsObject(settings).billingLimits)
  const overrides: BillingLimitOverrides = {}

  for (const key of BILLING_METRIC_KEYS) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (value === null || value === '' || value === 'unlimited') {
      overrides[key] = null
      continue
    }

    const limit = Number(value)
    if (Number.isFinite(limit) && limit > 0) {
      overrides[key] = Math.floor(limit)
    }
  }

  return overrides
}

export function applyBillingLimitOverrides(plan: PlanDefinition, settings: unknown): PlanDefinition {
  const overrides = getBillingLimitOverrides(settings)
  return {
    ...plan,
    limits: {
      ...plan.limits,
      ...overrides,
    },
  }
}

export function billingStatusLabel(status?: string | null) {
  switch (String(status || '').toLowerCase()) {
    case 'trialing':
      return 'Пробный период'
    case 'active':
      return 'Активна'
    case 'past_due':
      return 'Требует оплаты'
    case 'canceled':
      return 'Отменена'
    case 'manual':
      return 'Ручная оплата'
    default:
      return 'Не настроена'
  }
}

export function planDisplayName(plan?: string | null, billingStatus?: string | null) {
  const definition = getPlanDefinition(plan)
  if (billingStatus === 'trialing' && definition.key !== 'free') return `${definition.name} trial`
  return definition.name
}

export function getTrialDaysLeft(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export function usagePercent(used: number, limit: number | null) {
  if (!limit) return null
  return Math.min(100, Math.round((used / limit) * 100))
}

export function isSoftLimitWarning(used: number, limit: number | null) {
  if (!limit) return false
  return used >= Math.ceil(limit * 0.8)
}

export async function getBillingSnapshot(organizationId: string): Promise<BillingSnapshot> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
      billingStatus: true,
      trialEndsAt: true,
      currentPeriodEndsAt: true,
      cancelAtPeriodEnd: true,
      settings: true,
    },
  })

  if (!organization) {
    throw new Error('Organization not found')
  }

  const [users, clients, cases, leads] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    prisma.client.count({ where: { organizationId } }),
    prisma.case.count({ where: { organizationId } }),
    prisma.lead.count({ where: { organizationId } }),
  ])

  const plan = applyBillingLimitOverrides(getPlanDefinition(organization.plan), organization.settings)
  const usage = { users, clients, cases, leads }
  const customLimitKeys = Object.keys(getBillingLimitOverrides(organization.settings)) as BillingMetricKey[]
  const softLimitWarnings = (Object.keys(usage) as BillingMetricKey[])
    .filter(key => isSoftLimitWarning(usage[key], plan.limits[key]))

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      status: organization.status,
      billingStatus: organization.billingStatus,
      trialEndsAt: organization.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
      currentPeriodEndsAt: organization.currentPeriodEndsAt ? organization.currentPeriodEndsAt.toISOString() : null,
      cancelAtPeriodEnd: organization.cancelAtPeriodEnd,
    },
    plan,
    usage,
    softLimitWarnings,
    customLimitKeys,
  }
}
