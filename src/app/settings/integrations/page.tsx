'use client'

import { useEffect, useMemo, useState } from 'react'

type WebhookSettings = {
  slug: string
  enabled: boolean
  key: string
}

type WebhookLog = {
  id: number
  status: string
  source?: string | null
  error?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
  lead?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

const samplePayload = `{
  "firstName": "Ivan",
  "lastName": "Ivanov",
  "phone": "+48 123 456 789",
  "email": "ivan@example.com",
  "source": "website",
  "serviceInterest": "Pobyt czasowy",
  "nextContactNote": "Oddzwonic po konsultacji",
  "notes": "Zgloszenie z formularza"
}`

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const webhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/leads/${settings.slug}`
  }, [settings])

  useEffect(() => {
    loadSettings()
    loadLogs()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/lead-webhook-settings', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load integrations')
        return
      }
      setSettings(data)
    } finally {
      setLoading(false)
    }
  }

  async function updateSettings(patch: Record<string, unknown>) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lead-webhook-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save integrations')
        return
      }
      setSettings(data)
    } finally {
      setSaving(false)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/lead-webhook-logs', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setLogs(Array.isArray(data) ? data : [])
    } finally {
      setLogsLoading(false)
    }
  }

  function leadName(lead: WebhookLog['lead']) {
    if (!lead) return ''
    return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || lead.email || 'Лид'
  }

  const maskedKey = settings?.key ? `${settings.key.slice(0, 8)}••••••••••••${settings.key.slice(-6)}` : ''

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Интеграции</div>
          <div className="page-subtitle">Подключение заявок с сайта, квиза, рекламы и внешних сервисов</div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="card">Загрузка...</div>
        ) : settings ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: 16, alignItems: 'start' }}>
            <div className="card">
              <div className="section-title"><span>🔌</span>Webhook для лидов</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                Этот адрес можно указать в квизе, форме сайта, Make, Zapier или другом сервисе. Каждая новая заявка будет создавать лида в этой организации.
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={event => updateSettings({ enabled: event.target.checked })}
                  disabled={saving}
                />
                Принимать лиды через webhook
              </label>

              <div className="form-group">
                <label className="label">Webhook URL</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input className="input" readOnly value={webhookUrl} />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(webhookUrl)}>Копировать</button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Ключ доступа</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8 }}>
                  <input className="input" readOnly value={showKey ? settings.key : maskedKey} />
                  <button className="btn btn-secondary" type="button" onClick={() => setShowKey(value => !value)}>{showKey ? 'Скрыть' : 'Показать'}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(settings.key)}>Копировать</button>
                  <button className="btn btn-danger" type="button" disabled={saving} onClick={() => {
                    if (confirm('Пересоздать ключ? Старые подключения перестанут работать.')) updateSettings({ regenerateKey: true })
                  }}>Новый ключ</button>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--muted)' }}>
                Ключ можно передавать в заголовке <strong>x-reziflow-key</strong> или как Bearer token в Authorization.
              </div>
            </div>

            <div className="card">
              <div className="section-title"><span>🧪</span>Пример запроса</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: 'auto' }}>
{`POST ${webhookUrl}
x-reziflow-key: ${showKey ? settings.key : 'YOUR_KEY'}
Content-Type: application/json

${samplePayload}`}
              </pre>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                Минимально достаточно передать имя, телефон, email, Instagram или Facebook. Остальные поля можно добавлять постепенно.
              </div>
            </div>
          </div>
        ) : null}

        {!loading && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}><span>📥</span>Журнал входящих заявок</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Последние 50 запросов из внешних форм и сервисов</div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={logsLoading}>
                {logsLoading ? 'Обновляю...' : 'Обновить'}
              </button>
            </div>

            {logs.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>Входящих заявок пока нет</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Статус</th>
                      <th>Источник</th>
                      <th>Лид</th>
                      <th>Payload / ошибка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const isCreated = log.status === 'created'
                      const payload = log.payload ? Object.entries(log.payload).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(', ') : ''
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 13 }}>{new Date(log.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 800, background: isCreated ? '#dcfce7' : '#fee2e2', color: isCreated ? '#166534' : '#991b1b' }}>
                              {isCreated ? 'Создан' : log.status === 'failed' ? 'Ошибка' : 'Отклонен'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13 }}>{log.source || '—'}</td>
                          <td style={{ fontSize: 13 }}>
                            {log.lead ? <a href={`/leads/${log.lead.id}`}>{leadName(log.lead)}</a> : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: log.error ? '#991b1b' : 'var(--muted)', maxWidth: 520 }}>
                            {log.error || payload || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
