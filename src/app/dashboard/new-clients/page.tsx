import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { buildMonthOptions, selectedMonth } from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { clientWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { DashboardText, LocalizedDate, LocalizedMonthLabel } from '@/components/DashboardI18n'

export const dynamic = 'force-dynamic'

export default async function NewClientsPage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const allClients = await prisma.client.findMany({
    where: clientWhereForScope(scope, organizationId),
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const months = buildMonthOptions(allClients.map((item) => item.createdAt))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const clients = month
    ? await prisma.client.findMany({
        where: clientWhereForScope(scope, organizationId, { createdAt: { gte: month.start, lt: month.end } }),
        include: { cases: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const monthTotals = await Promise.all(
    months.map(async (item) => ({
      ...item,
      count: await prisma.client.count({ where: clientWhereForScope(scope, organizationId, { createdAt: { gte: item.start, lt: item.end } }) }),
    }))
  )

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title"><DashboardText k="new_clients" /></div>
          <div className="page-subtitle"><DashboardText k="new_clients_subtitle" /></div>
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
                href={`/dashboard/new-clients?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                <LocalizedMonthLabel monthKey={item.key} /> · {item.count}
              </Link>
            ))}
          </div>
        </div>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="stat-icon" style={{ background: '#d1fae5' }}>#</div>
          <div>
            <div className="stat-label">
              <DashboardText k="added_clients_for" /> {month ? <LocalizedMonthLabel monthKey={month.key} /> : <DashboardText k="month" />}
            </div>
            <div className="stat-value">{clients.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}><DashboardText k="clients_for_month" /></div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th><DashboardText k="date" /></th>
                  <th><DashboardText k="client" /></th>
                  <th><DashboardText k="phone" /></th>
                  <th>Email</th>
                  <th><DashboardText k="city" /></th>
                  <th><DashboardText k="cases_short" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}><DashboardText k="no_new_clients_month" /></td></tr>
                ) : clients.map((client) => (
                  <tr key={client.id}>
                    <td><LocalizedDate value={client.createdAt} /></td>
                    <td style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</td>
                    <td>{client.phone || '-'}</td>
                    <td>{client.email || '-'}</td>
                    <td>{client.city || '-'}</td>
                    <td>{client.cases.length}</td>
                    <td><Link href={`/clients/${client.id}`} className="btn btn-ghost"><DashboardText k="open" /></Link></td>
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
