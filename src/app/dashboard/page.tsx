// src/app/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import Link from 'next/link'
import UpcomingEvents from '@/components/UpcomingEvents'
import Tr from '@/components/Tr'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый':               { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе':            { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено':    { bg: '#dcfce7', color: '#14532d' },
  'Архив':               { bg: '#f3f4f6', color: '#374151' },
  'Отказ':               { bg: '#fef2f2', color: '#991b1b' },
}

export default async function DashboardPage() {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  let totalClients = 0, totalCases = 0, activeCases = 0
  let monthlyIncome = 0, totalDebt = 0, contractsNoPay = 0
  let last6months: { month: string; cases: number; clients: number }[] = []
  let recentCases: any[] = []

  try {
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

    ;[totalClients, totalCases, activeCases] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.case.count({ where: { organizationId } }),
      prisma.case.count({ where: { organizationId, status: { in: ['Новый', 'В работе', 'Ожидание документов'] } } }),
    ])

    const payments = await prisma.payment.aggregate({
      where: { date: { gte: startOfMonth }, case: { organizationId } },
      _sum: { amount: true }
    })
    monthlyIncome = payments._sum.amount || 0

    const allCases = await prisma.case.findMany({
      where: { organizationId },
      select: { totalValue: true, totalPaid: true, contractSigned: true }
    })
    totalDebt = allCases.reduce((acc, c) => acc + Math.max(0, c.totalValue - c.totalPaid), 0)
    contractsNoPay = allCases.filter(c => c.contractSigned && c.totalPaid === 0 && c.totalValue > 0).length

    // Графики с UTC чтобы избежать проблем с часовым поясом
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), 1))
      const end = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth() + 1, 1) - 1)

      const [cases, clients] = await Promise.all([
        prisma.case.count({ where: { organizationId, createdAt: { gte: start, lte: end } } }),
        prisma.client.count({ where: { organizationId, createdAt: { gte: start, lte: end } } }),
      ])

      last6months.push({
        month: start.toLocaleDateString('ru', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        cases,
        clients
      })
    }

    recentCases = await prisma.case.findMany({
      where: { organizationId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
  } catch (e) { console.error(e) }

  const maxCases = Math.max(...last6months.map(m => m.cases), 1)
  const maxClients = Math.max(...last6months.map(m => m.clients), 1)

  return (
    <div className="fade-in">
      <style>{`
        .dash-stat-link { text-decoration: none; display: block; }
        .dash-stat-link:hover .stat-card { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .stat-card { transition: box-shadow 0.15s, transform 0.15s; }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title"><Tr k="dashboard_title" /></div>
          <div className="page-subtitle"><Tr k="dashboard_welcome" />, {user?.name as string}!</div>
        </div>
      </div>

      <div className="page-body">

        {/* Все 6 карточек в одной сетке */}
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

        {/* Графики */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {([['new_cases','cases','#3b82f6',maxCases,'/dashboard/new-cases'],['new_clients','clients','#10b981',maxClients,'/dashboard/new-clients']] as const).map(([labelKey, key, color, max, href]) => (
            <Link key={key} href={href} className="dash-stat-link">
            <div className="card" style={{ cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}><Tr k={labelKey} /></div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}><Tr k="last_6months" /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                {last6months.map((m, i) => {
                  const val = m[key as 'cases' | 'clients']
                  const isCurrent = i === last6months.length - 1
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: isCurrent ? color : 'var(--text)' }}>
                        {val > 0 ? val : ''}
                      </div>
                      <div style={{
                        width: '100%',
                        background: isCurrent ? color : color + '70',
                        borderRadius: '4px 4px 0 0',
                        height: `${(val / (max as number)) * 60}px`,
                        minHeight: val > 0 ? 4 : 0,
                      }} />
                      <div style={{ fontSize: 10, color: isCurrent ? color : 'var(--muted)', fontWeight: isCurrent ? 600 : 400 }}>
                        {m.month}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            </Link>
          ))}
        </div>

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

        {/* Последние дела */}
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
                  <th><Tr k="case_number" /></th>
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
                  const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
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
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{c.caseNumber || '—'}</td>
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

      </div>
    </div>
  )
}
