import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  buildMonthOptions,
  formatDate,
  formatMoney,
  selectedMonth,
  toValidDate,
} from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DataAccessScope, caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'

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
          <div className="page-title">Новые дела</div>
          <div className="page-subtitle">Дела, созданные в выбранном месяце</div>
        </div>
        <Link href="/dashboard" className="btn btn-secondary">Назад</Link>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Месяцы</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {monthTotals.map((item) => (
              <Link
                key={item.key}
                href={`/dashboard/new-cases?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                {item.label} · {item.count}
              </Link>
            ))}
          </div>
        </div>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>#</div>
          <div>
            <div className="stat-label">Создано дел за {month?.label || 'месяц'}</div>
            <div className="stat-value">{cases.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}>Дела за месяц</div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Статус</th>
                  <th>Услуга</th>
                  <th>Стоимость</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>В этом месяце новых дел нет</td></tr>
                ) : sortedCases.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(dashboardCaseDate(item))}</td>
                    <td style={{ fontWeight: 600 }}>
                      {item.client ? `${item.client.firstName} ${item.client.lastName}`.trim() : 'Клиент не найден'}
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
                            title={item.caseNumber || 'Номер не указан'}
                      >
                        {item.service?.name || 'Без услуги'}
                      </Link>
                    </td>
                    <td>{formatMoney(item.totalValue)}</td>
                    <td><Link href={`/cases/${item.id}`} className="btn btn-ghost">Открыть</Link></td>
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
