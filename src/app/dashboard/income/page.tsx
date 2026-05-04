import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  buildMonthOptions,
  formatDate,
  formatMoney,
  selectedMonth,
} from '@/lib/dashboardAnalytics'

export const dynamic = 'force-dynamic'

export default async function IncomePage({
  searchParams,
}: {
  searchParams: { month?: string | string[] }
}) {
  const allPaymentDates = await prisma.payment.findMany({
    select: { date: true },
    orderBy: { date: 'desc' },
  })
  const months = buildMonthOptions(allPaymentDates.map((payment) => payment.date))
  const monthKey = selectedMonth(searchParams.month, months)
  const month = months.find((item) => item.key === monthKey) || months[0]

  const payments = month
    ? await prisma.payment.findMany({
        where: { date: { gte: month.start, lt: month.end } },
        include: { case: { include: { client: true } } },
        orderBy: { date: 'desc' },
      })
    : []

  const monthTotals = await Promise.all(
    months.map(async (item) => {
      const result = await prisma.payment.aggregate({
        where: { date: { gte: item.start, lt: item.end } },
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
          <div className="page-title">Полученные деньги</div>
          <div className="page-subtitle">Доходы по месяцам и детализация платежей</div>
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
                href={`/dashboard/income?month=${item.key}`}
                className={item.key === monthKey ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                {item.label} · {formatMoney(item.total)}
              </Link>
            ))}
          </div>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>zł</div>
            <div>
              <div className="stat-label">Выбранный месяц</div>
              <div className="stat-value">{month?.label || '-'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>Σ</div>
            <div>
              <div className="stat-label">Получено</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{formatMoney(total)}</div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}>Платежи за месяц</div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Дело</th>
                  <th>Сумма</th>
                  <th>Заметка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>В этом месяце платежей нет</td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.date)}</td>
                    <td style={{ fontWeight: 600 }}>{payment.case.client.firstName} {payment.case.client.lastName}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.case.caseNumber || '—'}</td>
                    <td style={{ color: '#16a34a', fontWeight: 700 }}>{formatMoney(payment.amount)}</td>
                    <td>{payment.note || '-'}</td>
                    <td><Link href={`/cases/${payment.caseId}`} className="btn btn-ghost">Открыть</Link></td>
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
