// src/app/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DataAccessScope, caseWhereForScope, clientWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import Link from 'next/link'
import { Suspense } from 'react'
import UpcomingEvents from '@/components/UpcomingEvents'
import Tr from '@/components/Tr'
import DashboardOnboarding, { DashboardOnboardingStep } from '@/components/DashboardOnboarding'
import { LocalizedMonthLabel } from '@/components/DashboardI18n'
import TutorialVideoButton from '@/components/TutorialVideoButton'

export const dynamic = 'force-dynamic'

function dashboardCaseMonthWhere(organizationId: string, start: Date, end: Date, scope: DataAccessScope) {
  return caseWhereForScope(scope, organizationId, {
    OR: [
      { contractSigned: true, contractDate: { gte: start, lt: end } },
      {
        createdAt: { gte: start, lt: end },
        OR: [{ contractSigned: false }, { contractDate: null }],
      },
    ],
  })
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый':               { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе':            { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено':    { bg: '#dcfce7', color: '#14532d' },
  'Архив':               { bg: '#f3f4f6', color: '#374151' },
  'Отказ':               { bg: '#fef2f2', color: '#991b1b' },
}

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export default async function DashboardPage() {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const [scope, organization] = await Promise.all([
    getDataAccessScope(user, organizationId),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    }),
  ])
  const canManageSetup = user?.role === 'admin' || user?.role === 'owner'
  const quickStartEnabled = settingsObject(organization?.settings).quickStartEnabled !== false

  return (
    <div className="fade-in">
      <style>{`
        .dash-stat-link { text-decoration: none; display: block; }
        .dash-stat-link:hover .stat-card { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .stat-card { transition: box-shadow 0.15s, transform 0.15s; }
        .dash-chart-card { overflow: hidden; }
        .dash-mini-chart {
          height: 124px; display: flex; align-items: flex-end; justify-content: space-between;
          gap: 10px; margin-top: 4px; padding: 8px 4px 0;
        }
        .dash-chart-bar-wrap {
          flex: 1; min-width: 0; height: 112px; display: grid;
          grid-template-rows: 20px 1fr 16px; align-items: end; justify-items: center;
        }
        .dash-chart-bar {
          width: 100%; max-width: 76px; min-height: 2px; border-radius: 8px 8px 3px 3px;
          transition: transform 0.15s, filter 0.15s;
        }
        .dash-chart-bar-wrap:hover .dash-chart-bar { transform: translateY(-2px); filter: brightness(1.08); }
        .dash-chart-label { font-size: 10px; color: var(--muted); white-space: nowrap; }
        .dash-chart-value {
          font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 999px;
          background: var(--surface); border: 1px solid var(--border); opacity: 0;
        }
        .dash-chart-value.is-visible { opacity: 1; }
        [data-theme="slate"] .dash-chart-card {
          background: linear-gradient(180deg, rgba(17,24,39,.98), rgba(8,18,30,.98));
          box-shadow: inset 0 1px 0 rgba(224,242,254,.04), var(--shadow);
        }
        [data-theme="slate"] .dash-mini-chart {
          background: linear-gradient(180deg, rgba(6,182,212,.09), rgba(14,165,233,.02));
          border: 1px solid rgba(6,182,212,.12);
          border-radius: 8px;
          padding: 8px 8px 0;
        }
        @media (max-width: 768px) {
          .dashboard-chart-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
          .dashboard-chart-grid .dash-chart-card {
            min-height: 142px !important;
            padding: 12px !important;
          }
          .dashboard-chart-grid .dash-mini-chart {
            height: 76px;
            gap: 4px;
            padding: 6px 4px 0;
          }
          .dashboard-chart-grid .dash-chart-bar-wrap {
            height: 68px;
            grid-template-rows: 16px 1fr 14px;
          }
          .dashboard-chart-grid .dash-chart-bar-wrap:nth-child(-n+3) {
            display: none;
          }
          .dashboard-chart-grid .dash-chart-label,
          .dashboard-chart-grid .dash-chart-value {
            font-size: 9px;
          }
          .dashboard-chart-grid .dash-chart-value {
            padding: 1px 4px;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title"><Tr k="dashboard_title" /></div>
          <div className="page-subtitle"><Tr k="dashboard_welcome" />, {user?.name as string}!</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TutorialVideoButton videoKey="dashboard" />
        </div>
      </div>

      <div className="page-body">

        {canManageSetup && quickStartEnabled && (
          <Suspense fallback={<DashboardOnboardingFallback />}>
            <DashboardOnboardingSection organizationId={organizationId} />
          </Suspense>
        )}

        <Suspense fallback={<DashboardStatsFallback />}>
          <DashboardStats organizationId={organizationId} scope={scope} />
        </Suspense>

        <Suspense fallback={<DashboardChartsFallback />}>
          <DashboardCharts organizationId={organizationId} scope={scope} />
        </Suspense>

        {/* Предстоящие события */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔔 <Tr k="upcoming" />
            </div>
            <Link href="/calendar" className="btn btn-ghost" style={{ fontSize: 13 }}><Tr k="open_calendar" /></Link>
          </div>
          <UpcomingEvents />
        </div>

        <Suspense fallback={<RecentCasesFallback />}>
          <RecentCasesTable organizationId={organizationId} scope={scope} />
        </Suspense>

      </div>
    </div>
  )
}

function DashboardOnboardingFallback() {
  return <div className="onboarding-panel" style={{ minHeight: 210, opacity: 0.72 }} />
}

async function DashboardOnboardingSection({ organizationId }: { organizationId: string }) {
  const [
    serviceCount,
    statusCount,
    userCount,
    employeeCount,
    clientCount,
    caseCount,
  ] = await Promise.all([
    prisma.service.count({ where: { organizationId, active: true } }),
    prisma.caseStatus.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId, active: true } }),
    prisma.client.count({ where: { organizationId } }),
    prisma.case.count({ where: { organizationId } }),
  ])

  const hasTeam = userCount > 1 || employeeCount > 0

  const steps: DashboardOnboardingStep[] = [
    {
      id: 'services',
      href: '/settings/services',
      done: serviceCount > 0,
      count: serviceCount,
    },
    {
      id: 'statuses',
      href: '/settings/statuses',
      done: statusCount > 0,
      count: statusCount,
    },
    {
      id: 'team',
      href: '/settings/users',
      done: hasTeam,
      userCount,
      employeeCount,
    },
    {
      id: 'clients',
      href: '/clients/new',
      done: clientCount > 0,
      count: clientCount,
    },
    {
      id: 'first-case',
      href: '/cases/new',
      done: caseCount > 0,
      count: caseCount,
    },
  ]

  return <DashboardOnboarding organizationId={organizationId} steps={steps} />
}

function DashboardStatsFallback() {
  return (
    <div className="stats-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="stat-card" style={{ minHeight: 82, opacity: 0.72 }} />
      ))}
    </div>
  )
}

async function DashboardStats({ organizationId, scope }: { organizationId: string; scope: DataAccessScope }) {
  let totalClients = 0
  let totalCases = 0
  let activeCases = 0
  let monthlyIncome = 0
  let totalDebt = 0
  let contractsNoPay = 0
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

  try {
    const scopedUserId = scope.restricted ? scope.userId : null
    const caseWhere = caseWhereForScope(scope, organizationId)
    const [clientCount, caseStats, payments] = await Promise.all([
      prisma.client.count({ where: clientWhereForScope(scope, organizationId) }),
      prisma.$queryRaw<Array<{ totalCases: number; activeCases: number; totalDebt: number; contractsNoPay: number }>>`
        SELECT
          COUNT(*)::int AS "totalCases",
          COUNT(*) FILTER (
            WHERE lower(status) NOT LIKE '%архив%'
              AND lower(status) NOT LIKE '%архів%'
              AND lower(status) NOT LIKE '%archive%'
              AND lower(status) NOT LIKE '%archiw%'
              AND lower(status) NOT LIKE '%отказ%'
              AND lower(status) NOT LIKE '%відмова%'
              AND lower(status) NOT LIKE '%odmowa%'
              AND lower(status) NOT LIKE '%refusal%'
              AND lower(status) NOT LIKE '%rejected%'
              AND lower(status) NOT LIKE '%закрыт%'
              AND lower(status) NOT LIKE '%закрит%'
              AND lower(status) NOT LIKE '%closed%'
              AND lower(status) NOT LIKE '%zamkni%'
          )::int AS "activeCases",
          COALESCE(SUM(GREATEST("totalValue" - "totalPaid", 0)), 0)::double precision AS "totalDebt",
          COUNT(*) FILTER (WHERE "contractSigned" = true AND "totalPaid" = 0 AND "totalValue" > 0)::int AS "contractsNoPay"
        FROM "Case"
        WHERE "organizationId" = ${organizationId}
          AND (${scopedUserId}::int IS NULL OR "assignedToId" = ${scopedUserId})
      `,
      prisma.payment.aggregate({
        where: { date: { gte: startOfMonth }, case: caseWhere },
        _sum: { amount: true },
      }),
    ])
    const stats = caseStats[0] || { totalCases: 0, activeCases: 0, totalDebt: 0, contractsNoPay: 0 }
    totalClients = clientCount
    totalCases = Number(stats.totalCases || 0)
    activeCases = Number(stats.activeCases || 0)
    monthlyIncome = payments._sum.amount || 0
    totalDebt = Number(stats.totalDebt || 0)
    contractsNoPay = Number(stats.contractsNoPay || 0)
  } catch (e) { console.error(e) }

  return (
    <div className="stats-grid">
      <Link href="/dashboard/income" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#dcfce7' }}><span style={{ fontSize: 20 }}>💰</span></div>
          <div>
            <div className="stat-label"><Tr k="income_month" /></div>
            <div className="stat-value" style={{ color: '#16a34a' }}>{monthlyIncome.toFixed(2)} zł</div>
          </div>
        </div>
      </Link>
      <Link href="/dashboard/debt" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}><span style={{ fontSize: 20 }}>📉</span></div>
          <div>
            <div className="stat-label"><Tr k="debt" /></div>
            <div className="stat-value" style={{ color: '#dc2626' }}>{totalDebt.toFixed(2)} zł</div>
          </div>
        </div>
      </Link>
      <Link href="/cases?filter=no_pay" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#eff6ff' }}><span style={{ fontSize: 20 }}>📄</span></div>
          <div>
            <div className="stat-label"><Tr k="contracts_no_pay" /></div>
            <div className="stat-value">{contractsNoPay}</div>
          </div>
        </div>
      </Link>
      <Link href="/clients" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#f5f3ff' }}><span style={{ fontSize: 20 }}>👥</span></div>
          <div>
            <div className="stat-label"><Tr k="total_clients" /></div>
            <div className="stat-value">{totalClients}</div>
          </div>
        </div>
      </Link>
      <Link href="/cases" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#fff7ed' }}><span style={{ fontSize: 20 }}>📋</span></div>
          <div>
            <div className="stat-label"><Tr k="total_cases" /></div>
            <div className="stat-value">{totalCases}</div>
          </div>
        </div>
      </Link>
      <Link href="/cases?filter=active" className="dash-stat-link">
        <div className="stat-card" style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: '#ecfdf5' }}><span style={{ fontSize: 20 }}>⚡</span></div>
          <div>
            <div className="stat-label"><Tr k="active_cases" /></div>
            <div className="stat-value">{activeCases}</div>
          </div>
        </div>
      </Link>
    </div>
  )
}

function dashboardMonthRanges() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const start = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), 1))
    const end = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth() + 1, 1))
    return { start, end }
  })
}

function DashboardChartsFallback() {
  return (
    <div className="grid-2 dashboard-chart-grid" style={{ marginBottom: 16 }}>
      <div className="card dash-chart-card" style={{ minHeight: 204, opacity: 0.72 }} />
      <div className="card dash-chart-card" style={{ minHeight: 204, opacity: 0.72 }} />
    </div>
  )
}

async function DashboardCharts({ organizationId, scope }: { organizationId: string; scope: DataAccessScope }) {
  const lastMonths = await Promise.all(dashboardMonthRanges().map(async ({ start, end }) => {
    const [cases, clients] = await Promise.all([
      prisma.case.count({ where: dashboardCaseMonthWhere(organizationId, start, end, scope) }),
      prisma.client.count({ where: clientWhereForScope(scope, organizationId, { createdAt: { gte: start, lt: end } }) }),
    ])
    return {
      monthKey: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
      cases,
      clients,
    }
  }))
  const maxCases = Math.max(...lastMonths.map(m => m.cases), 1)
  const maxClients = Math.max(...lastMonths.map(m => m.clients), 1)
  const makeBars = (metric: 'cases' | 'clients', max: number) => lastMonths.map(m => ({
    value: m[metric],
    monthKey: m.monthKey,
    height: Math.max((m[metric] / max) * 76, m[metric] > 0 ? 12 : 2),
  }))

  return (
    <div className="grid-2 dashboard-chart-grid" style={{ marginBottom: 16 }}>
      {([['new_cases','cases','#06b6d4',maxCases,'/dashboard/new-cases'],['new_clients','clients','#0891b2',maxClients,'/dashboard/new-clients']] as const).map(([labelKey, key, color, max, href]) => {
        const bars = makeBars(key as 'cases' | 'clients', max as number)
        return (
          <Link key={key} href={href} className="dash-stat-link">
            <div className="card dash-chart-card" style={{ cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}><Tr k={labelKey} /></div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}><Tr k="last_6months" /></div>
              <div className="dash-mini-chart">
                {bars.map((bar, i) => (
                  <div key={i} className="dash-chart-bar-wrap">
                    <span className={`dash-chart-value ${bar.value > 0 ? 'is-visible' : ''}`} style={{ color }}>
                      {bar.value}
                    </span>
                    <div
                      className="dash-chart-bar"
                      style={{
                        height: `${bar.height}px`,
                        background: bar.value > 0
                          ? `linear-gradient(180deg, ${color} 0%, ${color}cc 56%, ${color}2b 100%)`
                          : 'linear-gradient(180deg, var(--border), transparent)',
                        boxShadow: bar.value > 0 ? `0 10px 24px ${color}30` : 'none',
                      }}
                    />
                    <span className="dash-chart-label" style={{ color: i === bars.length - 1 ? color : undefined, fontWeight: i === bars.length - 1 ? 700 : 400 }}>
                      <LocalizedMonthLabel monthKey={bar.monthKey} variant="short" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function RecentCasesFallback() {
  return <div className="table-container" style={{ minHeight: 190, opacity: 0.72 }} />
}

async function RecentCasesTable({ organizationId, scope }: { organizationId: string; scope: DataAccessScope }) {
  const [recentCases, statuses] = await Promise.all([
    prisma.case.findMany({
      where: caseWhereForScope(scope, organizationId),
      select: {
        id: true,
        caseNumber: true,
        status: true,
        totalValue: true,
        totalPaid: true,
        client: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.caseStatus.findMany({
      where: { organizationId },
      select: { name: true, color: true },
    }),
  ])
  const statusColors = new Map(statuses.map(status => [status.name, status.color]))
  const getCaseStatusStyle = (name: string) => {
    const color = statusColors.get(name)
    if (color) return { bg: `${color}18`, color }
    return STATUS_COLORS[name] || { bg: '#f3f4f6', color: '#374151' }
  }

  return (
    <div className="table-container">
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}><Tr k="recent_cases" /></div>
        <Link href="/cases" className="btn btn-ghost" style={{ fontSize: 13 }}><Tr k="all_cases" /></Link>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th><Tr k="client" /></th>
              <th><Tr k="service" /></th>
              <th><Tr k="status" /></th>
              <th><Tr k="cost" /></th>
              <th><Tr k="income_month" /></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentCases.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                <Link href="/cases/new" style={{ color: 'var(--brand)' }}><Tr k="new_case" /></Link>
              </td></tr>
            ) : recentCases.map(c => {
              const sc = getCaseStatusStyle(c.status)
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {c.client.firstName[0]}{c.client.lastName[0]}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.client.firstName} {c.client.lastName}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.service?.name || '—'}</td>
                  <td><span className="badge" style={{ background: sc.bg, color: sc.color }}>{c.status}</span></td>
                  <td>{c.totalValue.toFixed(2)} zł</td>
                  <td style={{ color: c.totalPaid >= c.totalValue && c.totalValue > 0 ? '#16a34a' : '#dc2626' }}>
                    {c.totalPaid.toFixed(2)} zł
                  </td>
                  <td>
                    <Link href={`/cases/${c.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                      <Tr k="open" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
