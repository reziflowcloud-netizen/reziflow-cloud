import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const EVENT_LABELS: Record<string, string> = {
  conference_page_view: 'Page views',
  conference_demo_open: 'Demo opens',
  conference_register_click: 'Register clicks',
  conference_register_complete: 'Registrations',
}

const LANGUAGES = ['ru', 'uk', 'en', 'pl'] as const

function percent(numerator: number, denominator: number) {
  if (!denominator) return '0.0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <article className="card" style={{ padding: 18, minHeight: 116 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
      <div style={{ marginTop: 9, fontSize: 30, lineHeight: 1, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
      {hint && <div style={{ marginTop: 9, color: 'var(--muted)', fontSize: 12 }}>{hint}</div>}
    </article>
  )
}

export default async function ConferenceReportPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!isSystemAdmin(user)) redirect('/settings')

  const events = await prisma.conferenceEvent.findMany({
    select: {
      eventName: true,
      utmContent: true,
      language: true,
      demoOrigin: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const count = (predicate: (event: typeof events[number]) => boolean) => events.filter(predicate).length
  const pageViews = count(event => event.eventName === 'conference_page_view')
  const qr1Visits = count(event => event.eventName === 'conference_page_view' && event.utmContent === 'qr_landing')
  const qr2DemoOpens = count(event => event.eventName === 'conference_demo_open' && event.utmContent === 'qr_demo')
  const landingDemoOpens = count(event => event.eventName === 'conference_demo_open' && event.demoOrigin === 'conference_landing')
  const registerClicks = count(event => event.eventName === 'conference_register_click')
  const completedRegistrations = count(event => event.eventName === 'conference_register_complete')
  const qr1Completed = count(event => event.eventName === 'conference_register_complete' && event.utmContent === 'qr_landing')
  const qr2Completed = count(event => event.eventName === 'conference_register_complete' && event.utmContent === 'qr_demo')

  const languageRows = LANGUAGES.map(language => ({
    language: language === 'uk' ? 'UA' : language.toUpperCase(),
    events: count(event => event.language === language),
    registrations: count(event => event.language === language && event.eventName === 'conference_register_complete'),
  }))

  const byDay = new Map<string, Record<string, number>>()
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10)
    const row = byDay.get(day) || {}
    row[event.eventName] = (row[event.eventName] || 0) + 1
    byDay.set(day, row)
  }
  const dayRows = Array.from(byDay.entries()).reverse()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Conference report</div>
          <div className="page-subtitle">First-touch attribution · 30 days · no personal data</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">Back</Link>
      </div>

      <div className="page-body" style={{ display: 'grid', gap: 18 }}>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <MetricCard label="QR 1 visits" value={qr1Visits} hint="qr_landing" />
          <MetricCard label="QR 2 demo opens" value={qr2DemoOpens} hint="qr_demo" />
          <MetricCard label="Conference page views" value={pageViews} />
          <MetricCard label="Demo opens from landing" value={landingDemoOpens} />
          <MetricCard label="Register clicks" value={registerClicks} />
          <MetricCard label="Completed registrations" value={completedRegistrations} />
        </section>

        <section>
          <div className="section-title" style={{ marginBottom: 10 }}>Conversion</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 14 }}>
            <MetricCard label="QR1 → complete" value={percent(qr1Completed, qr1Visits)} hint={`${qr1Completed} / ${qr1Visits}`} />
            <MetricCard label="QR2 → complete" value={percent(qr2Completed, qr2DemoOpens)} hint={`${qr2Completed} / ${qr2DemoOpens}`} />
            <MetricCard label="Page → demo" value={percent(landingDemoOpens, pageViews)} hint={`${landingDemoOpens} / ${pageViews}`} />
            <MetricCard label="Page → register click" value={percent(registerClicks, pageViews)} hint={`${registerClicks} / ${pageViews}`} />
            <MetricCard label="Register click → complete" value={percent(completedRegistrations, registerClicks)} hint={`${completedRegistrations} / ${registerClicks}`} />
          </div>
        </section>

        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-title" style={{ padding: '16px 18px 10px' }}>QR 1 vs QR 2</div>
          <div className="table-container" style={{ border: 0, borderRadius: 0 }}>
            <table className="table">
              <thead><tr><th>Source</th><th>Entry events</th><th>Completed registrations</th><th>Conversion</th></tr></thead>
              <tbody>
                <tr><td>QR 1 · landing</td><td>{qr1Visits}</td><td>{qr1Completed}</td><td>{percent(qr1Completed, qr1Visits)}</td></tr>
                <tr><td>QR 2 · demo</td><td>{qr2DemoOpens}</td><td>{qr2Completed}</td><td>{percent(qr2Completed, qr2DemoOpens)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-title" style={{ padding: '16px 18px 10px' }}>Language split</div>
          <div className="table-container" style={{ border: 0, borderRadius: 0 }}>
            <table className="table">
              <thead><tr><th>Language</th><th>All events</th><th>Completed registrations</th><th>Share</th></tr></thead>
              <tbody>
                {languageRows.map(row => (
                  <tr key={row.language}>
                    <td>{row.language}</td><td>{row.events}</td><td>{row.registrations}</td><td>{percent(row.events, events.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-title" style={{ padding: '16px 18px 10px' }}>Events by day</div>
          <div className="table-container" style={{ border: 0, borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Date</th>{Object.values(EVENT_LABELS).map(label => <th key={label}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {dayRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>No conference events yet</td></tr>}
                {dayRows.map(([day, row]) => (
                  <tr key={day}>
                    <td>{day}</td>
                    {Object.keys(EVENT_LABELS).map(eventName => <td key={eventName}>{row[eventName] || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
