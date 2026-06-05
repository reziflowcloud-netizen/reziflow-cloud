import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatMoney } from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'

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
      serviceName: item.service?.name || 'Без услуги',
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
          <div className="page-title">Задолженность</div>
          <div className="page-subtitle">Клиенты и дела с неоплаченным остатком</div>
        </div>
        <Link href="/dashboard" className="btn btn-secondary">Назад</Link>
      </div>

      <div className="page-body">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef2f2' }}>Σ</div>
            <div>
              <div className="stat-label">Всего долг</div>
              <div className="stat-value" style={{ color: '#dc2626' }}>{formatMoney(totalDebt)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fff7ed' }}>#</div>
            <div>
              <div className="stat-label">Клиентов с долгом</div>
              <div className="stat-value">{debtClients.length}</div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}>Кто должен деньги</div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Услуги</th>
                  <th>Стоимость</th>
                  <th>Оплачено</th>
                  <th>Долг</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debtClients.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Задолженностей нет</td></tr>
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
                            title={caseItem.caseNumber || 'Номер не указан'}
                          >
                            {caseItem.serviceName}
                          </Link>
                          {' '}({formatMoney(caseItem.debt)})
                        </div>
                      ))}
                    </td>
                    <td>{formatMoney(item.totalValue)}</td>
                    <td>{formatMoney(item.totalPaid)}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatMoney(item.debt)}</td>
                    <td><Link href={`/clients/${item.id}`} className="btn btn-ghost">Открыть</Link></td>
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
