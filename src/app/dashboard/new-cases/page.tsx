import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  buildMonthOptions,
  formatMoney,
  selectedMonth,
  toValidDate,
} from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DataAccessScope, caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { DashboardText, LocalizedDate, LocalizedMonthLabel } from '@/components/DashboardI18n'

export const dynamic = 'force-dynamic'

type DashboardCaseDate = {
  createdAt: Date
  contractDate: Date | null
  contractSigned: boolean
}

function dashboardCaseDate(item: DashboardCaseDate): Date {
  const contractDate = toValidDate(item.contractDate)
  const createdAt = toValidDate(item.createdAt)
  return (item.contractSigned && contractDate ? contractDate : createdAt) || new Date(0)
}

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

export default async function NewCasesPage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const allCases = await prisma.case.findMany({
    where: caseWhereForScope(scope, organizationId),
    select: { createdAt: true, contractDate: true, contractSigned: true },
    orderBy: { createdAt: 'desc' },
  })
  const statuses = await prisma.caseStatus.findMany({ where: { organizationId } })
  const statusColors = new Map(statuses.map((status) => [status.name, status.color]))
  const months = buildMonthOptions(allCases.map(dashboardCaseDate))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const cases = month
    ? await prisma.case.findMany({
        where: dashboardCaseMonthWhere(organizationId, month.start, month.end, scope),
        include: { client: true, service: true },
        orderBy: { createdAt: 'desc' },
      })
    : []
  const sortedCases = [...cases].sort((a, b) => dashboardCaseDate(b).getTime() - dashboardCaseDate(a).getTime())

  const monthTotals = await Promise.all(
    months.map(async (item) => ({
      ...item,
      count: await prisma.case.count({ where: dashboardCaseMonthWhere(organizationId, item.start, item.end, scope) }),
    }))
  )

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title"><DashboardText k="new_cases" /></div>
          <div className="page-subtitle"><DashboardText k="new_cases_subtitle" /></div>
        </div>
        <Link href="/dashboard" className="btn btn-secondary"><DashboardText k="back" /></Link>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><DashboardText k="months" /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {monthTotals.map((item) => (
              <Link
                key={item.key}
                href={`/dashboard/new-cases?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                <LocalizedMonthLabel monthKey={item.key} /> · {item.count}
              </Link>
            ))}
          </div>
        </div>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>#</div>
          <div>
            <div className="stat-label">
              <DashboardText k="created_cases_for" /> {month ? <LocalizedMonthLabel monthKey={month.key} /> : <DashboardText k="month" />}
            </div>
            <div className="stat-value">{cases.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}><DashboardText k="cases_for_month" /></div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th><DashboardText k="date" /></th>
                  <th><DashboardText k="client" /></th>
                  <th><DashboardText k="status" /></th>
                  <th><DashboardText k="service" /></th>
                  <th><DashboardText k="cost" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}><DashboardText k="no_new_cases_month" /></td></tr>
                ) : sortedCases.map((item) => (
                  <tr key={item.id}>
                    <td><LocalizedDate value={dashboardCaseDate(item)} /></td>
                    <td style={{ fontWeight: 600 }}>
                      {item.client ? `${item.client.firstName} ${item.client.lastName}`.trim() : <DashboardText k="client_not_found" />}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${statusColors.get(item.status) || '#64748b'}20`,
                          color: statusColors.get(item.status) || '#475569',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/cases/${item.id}`}
                        className="badge"
                        style={{
                          background: `${item.service?.color || '#64748b'}20`,
                          color: item.service?.color || '#475569',
                          textDecoration: 'none',
                        }}
                        title={item.caseNumber || undefined}
                      >
                        {item.service?.name || <DashboardText k="no_service" />}
                      </Link>
                    </td>
                    <td>{formatMoney(item.totalValue)}</td>
                    <td><Link href={`/cases/${item.id}`} className="btn btn-ghost"><DashboardText k="open" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
