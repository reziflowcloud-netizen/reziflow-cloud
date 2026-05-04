import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { buildMonthOptions, formatDate, selectedMonth } from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function NewClientsPage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const allClients = await prisma.client.findMany({
    where: { organizationId },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const months = buildMonthOptions(allClients.map((item) => item.createdAt))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const clients = month
    ? await prisma.client.findMany({
        where: { organizationId, createdAt: { gte: month.start, lt: month.end } },
        include: { cases: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const monthTotals = await Promise.all(
    months.map(async (item) => ({
      ...item,
      count: await prisma.client.count({ where: { organizationId, createdAt: { gte: item.start, lt: item.end } } }),
    }))
  )

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Новые клиенты</div>
          <div className="page-subtitle">Клиенты, добавленные в выбранном месяце</div>
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
                href={`/dashboard/new-clients?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                {item.label} · {item.count}
              </Link>
            ))}
          </div>
        </div>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="stat-icon" style={{ background: '#d1fae5' }}>#</div>
          <div>
            <div className="stat-label">Добавлено клиентов за {month?.label || 'месяц'}</div>
            <div className="stat-value">{clients.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}>Клиенты за месяц</div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Email</th>
                  <th>Город</th>
                  <th>Дел</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>В этом месяце новых клиентов нет</td></tr>
                ) : clients.map((client) => (
                  <tr key={client.id}>
                    <td>{formatDate(client.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</td>
                    <td>{client.phone || '-'}</td>
                    <td>{client.email || '-'}</td>
                    <td>{client.city || '-'}</td>
                    <td>{client.cases.length}</td>
                    <td><Link href={`/clients/${client.id}`} className="btn btn-ghost">Открыть</Link></td>
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
