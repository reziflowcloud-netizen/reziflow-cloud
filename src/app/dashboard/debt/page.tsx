import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatMoney } from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { DashboardText } from '@/components/DashboardI18n'

export const dynamic = 'force-dynamic'

export default async function DebtPage() {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const cases = await prisma.case.findMany({
    where: caseWhereForScope(scope, organizationId, { totalValue: { gt: 0 } }),
    include: { client: true, service: true },
    orderBy: { updatedAt: 'desc' },
  })

  const clients = new Map<string, {
    id: string
    name: string
    phone: string | null
    totalValue: number
    totalPaid: number
    debt: number
    cases: { id: string; caseNumber: string | null; debt: number; serviceName: string; serviceColor: string }[]
  }>()

  for (const item of cases) {
    const debt = Math.max(0, item.totalValue - item.totalPaid)
    if (debt <= 0) continue

    const current = clients.get(item.clientId) || {
      id: item.clientId,
      name: `${item.client.firstName} ${item.client.lastName}`,
      phone: item.client.phone,
      totalValue: 0,
      totalPaid: 0,
      debt: 0,
      cases: [],
    }

    current.totalValue += item.totalValue
    current.totalPaid += item.totalPaid
    current.debt += debt
    current.cases.push({
      id: item.id,
      caseNumber: item.caseNumber,
      debt,
      serviceName: item.service?.name || '',
      serviceColor: item.service?.color || '#64748b',
    })
    clients.set(item.clientId, current)
  }

  const debtClients = Array.from(clients.values()).sort((a, b) => b.debt - a.debt)
  const totalDebt = debtClients.reduce((sum, item) => sum + item.debt, 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title"><DashboardText k="debt_title" /></div>
          <div className="page-subtitle"><DashboardText k="debt_subtitle" /></div>
        </div>
        <Link href="/dashboard" className="btn btn-secondary"><DashboardText k="back" /></Link>
      </div>

      <div className="page-body">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef2f2' }}>Σ</div>
            <div>
              <div className="stat-label"><DashboardText k="total_debt" /></div>
              <div className="stat-value" style={{ color: '#dc2626' }}>{formatMoney(totalDebt)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fff7ed' }}>#</div>
            <div>
              <div className="stat-label"><DashboardText k="clients_with_debt" /></div>
              <div className="stat-value">{debtClients.length}</div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}><DashboardText k="who_owes_money" /></div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th><DashboardText k="client" /></th>
                  <th><DashboardText k="phone" /></th>
                  <th><DashboardText k="service" /></th>
                  <th><DashboardText k="cost" /></th>
                  <th><DashboardText k="paid" /></th>
                  <th><DashboardText k="debt" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debtClients.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}><DashboardText k="no_debts" /></td></tr>
                ) : debtClients.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.phone || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {item.cases.map((caseItem) => (
                        <div key={caseItem.id}>
                          <Link
                            href={`/cases/${caseItem.id}`}
                            className="badge"
                            style={{
                              background: `${caseItem.serviceColor}20`,
                              color: caseItem.serviceColor,
                              textDecoration: 'none',
                              marginRight: 6,
                            }}
                            title={caseItem.caseNumber || undefined}
                          >
                            {caseItem.serviceName || <DashboardText k="no_service" />}
                          </Link>
                          {' '}({formatMoney(caseItem.debt)})
                        </div>
                      ))}
                    </td>
                    <td>{formatMoney(item.totalValue)}</td>
                    <td>{formatMoney(item.totalPaid)}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatMoney(item.debt)}</td>
                    <td><Link href={`/clients/${item.id}`} className="btn btn-ghost"><DashboardText k="open" /></Link></td>
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
