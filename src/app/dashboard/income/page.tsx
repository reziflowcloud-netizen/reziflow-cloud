import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  buildMonthOptions,
  formatMoney,
  selectedMonth,
} from '@/lib/dashboardAnalytics'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'
import { DashboardText, LocalizedDate, LocalizedMonthLabel } from '@/components/DashboardI18n'

export const dynamic = 'force-dynamic'

export default async function IncomePage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const user = await getUser()
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const caseWhere = caseWhereForScope(scope, organizationId)
  const allPaymentDates = await prisma.payment.findMany({
    where: { case: caseWhere },
    select: { date: true },
    orderBy: { date: 'desc' },
  })
  const months = buildMonthOptions(allPaymentDates.map((payment) => payment.date))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const payments = month
    ? await prisma.payment.findMany({
        where: { date: { gte: month.start, lt: month.end }, case: caseWhere },
        include: { case: { include: { client: true } } },
        orderBy: { date: 'desc' },
      })
    : []

  const monthTotals = await Promise.all(
    months.map(async (item) => {
      const result = await prisma.payment.aggregate({
        where: { date: { gte: item.start, lt: item.end }, case: caseWhere },
        _sum: { amount: true },
      })
      return { ...item, total: result._sum.amount || 0 }
    })
  )

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title"><DashboardText k="income_title" /></div>
          <div className="page-subtitle"><DashboardText k="income_subtitle" /></div>
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
                href={`/dashboard/income?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                <LocalizedMonthLabel monthKey={item.key} /> · {formatMoney(item.total)}
              </Link>
            ))}
          </div>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>zł</div>
            <div>
              <div className="stat-label"><DashboardText k="selected_month" /></div>
              <div className="stat-value"><LocalizedMonthLabel monthKey={month?.key} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>Σ</div>
            <div>
              <div className="stat-label"><DashboardText k="received" /></div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{formatMoney(total)}</div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}><DashboardText k="payments_for_month" /></div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th><DashboardText k="date" /></th>
                  <th><DashboardText k="client" /></th>
                  <th><DashboardText k="case" /></th>
                  <th><DashboardText k="amount" /></th>
                  <th><DashboardText k="note" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}><DashboardText k="no_payments_month" /></td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><LocalizedDate value={payment.date} /></td>
                    <td style={{ fontWeight: 600 }}>{payment.case.client.firstName} {payment.case.client.lastName}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.case.caseNumber || '—'}</td>
                    <td style={{ color: '#16a34a', fontWeight: 700 }}>{formatMoney(payment.amount)}</td>
                    <td>{payment.note || '-'}</td>
                    <td><Link href={`/cases/${payment.caseId}`} className="btn btn-ghost"><DashboardText k="open" /></Link></td>
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
