import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  buildMonthOptions,
  formatDate,
  formatMoney,
  selectedMonth,
} from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function NewCasesPage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const allCases = await prisma.case.findMany({
    where: { organizationId },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const statuses = await prisma.caseStatus.findMany({ where: { organizationId } })
  const statusColors = new Map(statuses.map((status) => [status.name, status.color]))
  const months = buildMonthOptions(allCases.map((item) => item.createdAt))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const cases = month
    ? await prisma.case.findMany({
        where: { organizationId, createdAt: { gte: month.start, lt: month.end } },
        include: { client: true, service: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const monthTotals = await Promise.all(
    months.map(async (item) => ({
      ...item,
      count: await prisma.case.count({ where: { organizationId, createdAt: { gte: item.start, lt: item.end } } }),
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
                ) : cases.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>{item.client.firstName} {item.client.lastName}</td>
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
