export default function DashboardLoading() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Loading...</div>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="stat-card" style={{ minHeight: 82, opacity: 0.72 }} />
          ))}
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card" style={{ minHeight: 204, opacity: 0.72 }} />
          <div className="card" style={{ minHeight: 204, opacity: 0.72 }} />
        </div>
        <div className="card" style={{ minHeight: 160, opacity: 0.72 }} />
      </div>
    </div>
  )
}
