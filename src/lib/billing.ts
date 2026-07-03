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
const INACTIVE_CASE_STATUS_TERMS = [
  'архив',
  'архів',
  'archive',
  'archiw',
  'заверш',
  'completed',
  'closed',
  'закрыт',
  'закрит',
  'zamkni',
  'отказ',
  'відмова',
  'odmowa',
  'refusal',
  'rejected',
]

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    subtitle: 'Для знакомства и первых клиентов',
    price: '0 zł навсегда',
    limits: { users: 1, clients: 10, cases: 10, leads: 20 },
    features: [
      '1 пользователь',
      'До 10 клиентов',
      'До 10 активных дел',
      'До 20 лидов',
      'Базовые услуги, статусы, задачи, календарь и документы',
    ],
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    subtitle: 'Для одного специалиста или маленькой команды',
    price: '249 zł / мес.',
    limits: { users: 3, clients: 50, cases: 50, leads: 80 },
    features: [
      'До 3 пользователей',
      'До 50 клиентов',
      'До 50 активных дел',
      'До 80 лидов',
      'Импорт базы, документы, оплаты, задачи и календарь',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    subtitle: 'Основной тариф для растущего агентства',
    price: '499 zł / мес.',
    limits: { users: 10, clients: 200, cases: 200, leads: 300 },
    features: [
      'До 10 пользователей',
      'До 200 клиентов',
      'До 200 активных дел',
      'До 300 лидов',
      'Роли, доступы, отчёты, шаблоны и расширенный контроль',
    ],
  },
  agency: {
    key: 'agency',
    name: 'Agency',
    subtitle: 'Для агентств с несколькими отделами',
    price: 'от 849 zł / мес.',
    limits: { users: null, clients: null, cases: null, leads: null },
    features: [
      'Индивидуальные лимиты',
      'Несколько отделов или офисов',
      'Приоритетная поддержка',
      'Помощь с переносом данных',
      'Индивидуальные шаблоны документов и расширенные интеграции',
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
  cases: 'Активные дела',
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

export function isBillableActiveCaseStatus(status?: string | null) {
  const value = String(status || '').trim().toLowerCase()
  return !INACTIVE_CASE_STATUS_TERMS.some(term => value.includes(term))
}

export function activeCasesWhere(organizationId: string) {
  return {
    organizationId,
    NOT: {
      OR: INACTIVE_CASE_STATUS_TERMS.map(term => ({
        status: { contains: term, mode: 'insensitive' as const },
      })),
    },
  }
}

export class BillingLimitError extends Error {
  code = 'BILLING_LIMIT_REACHED'
  metric: BillingMetricKey
  used: number
  limit: number
  requested: number
  planName: string

  constructor(args: { metric: BillingMetricKey; used: number; limit: number; requested: number; planName: string }) {
    const label = BILLING_METRIC_LABELS[args.metric]
    super(`Достигнут лимит тарифа ${args.planName}: ${label} ${args.used}/${args.limit}. Чтобы добавить ещё, перейдите на тариф выше или измените индивидуальные лимиты организации.`)
    this.name = 'BillingLimitError'
    this.metric = args.metric
    this.used = args.used
    this.limit = args.limit
    this.requested = args.requested
    this.planName = args.planName
  }
}

export function isBillingLimitError(error: unknown): error is BillingLimitError {
  return error instanceof BillingLimitError || Boolean(error && typeof error === 'object' && (error as any).code === 'BILLING_LIMIT_REACHED')
}

export function billingLimitResponsePayload(error: BillingLimitError) {
  return {
    error: error.message,
    code: error.code,
    metric: error.metric,
    used: error.used,
    limit: error.limit,
    requested: error.requested,
    planName: error.planName,
    upgradeRequired: true,
  }
}

export async function assertBillingLimit(organizationId: string, metric: BillingMetricKey, requested = 1) {
  const amount = Math.max(0, Math.floor(Number(requested) || 0))
  if (amount === 0) return

  const snapshot = await getBillingSnapshot(organizationId)
  const limit = snapshot.plan.limits[metric]
  if (!limit) return

  const used = snapshot.usage[metric]
  if (used + amount <= limit) return

  throw new BillingLimitError({
    metric,
    used,
    limit,
    requested: amount,
    planName: snapshot.plan.name,
  })
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
    prisma.case.count({ where: activeCasesWhere(organizationId) }),
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
