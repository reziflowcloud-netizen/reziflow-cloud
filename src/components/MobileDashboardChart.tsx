'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CompactLocalizedMonthLabel, DashboardText } from '@/components/DashboardI18n'
import styles from '@/app/dashboard/DashboardMobile.module.css'

export type MobileDashboardMonth = {
  monthKey: string
  cases: number
  clients: number
}

export default function MobileDashboardChart({ months }: { months: MobileDashboardMonth[] }) {
  const [metric, setMetric] = useState<'cases' | 'clients'>('cases')
  const max = Math.max(...months.map(month => month[metric]), 1)
  const href = metric === 'cases' ? '/dashboard/new-cases' : '/dashboard/new-clients'

  return (
    <section className={`${styles.mobileOnly} ${styles.mobileChart}`} aria-labelledby="mobile-dashboard-dynamics">
      <div className={styles.chartHeader}>
        <h2 id="mobile-dashboard-dynamics" className={styles.chartTitle}>
          <DashboardText k="dynamics" />
        </h2>
        <div className={styles.chartSegments} role="group" aria-label="Dashboard metric">
          <button
            type="button"
            className={`${styles.chartSegment} ${metric === 'cases' ? styles.chartSegmentActive : ''}`}
            aria-pressed={metric === 'cases'}
            onClick={() => setMetric('cases')}
          >
            <DashboardText k="cases" />
          </button>
          <button
            type="button"
            className={`${styles.chartSegment} ${metric === 'clients' ? styles.chartSegmentActive : ''}`}
            aria-pressed={metric === 'clients'}
            onClick={() => setMetric('clients')}
          >
            <DashboardText k="clients" />
          </button>
        </div>
      </div>

      <Link href={href} className={styles.chartPlotLink} aria-label={metric === 'cases' ? 'Open case dynamics' : 'Open client dynamics'}>
        <div className={styles.chartPlot}>
          {months.map(month => {
            const value = month[metric]
            const height = Math.max((value / max) * 76, value > 0 ? 12 : 3)
            return (
              <div key={month.monthKey} className={styles.chartColumn}>
                <div className={styles.chartBarArea}>
                  <div className={styles.chartBar} style={{ height: `${height}px` }}>
                    {value > 0 && <span className={styles.chartValue}>{value}</span>}
                  </div>
                </div>
                <span className={styles.chartMonth}>
                  <CompactLocalizedMonthLabel monthKey={month.monthKey} />
                </span>
              </div>
            )
          })}
        </div>
      </Link>
    </section>
  )
}
