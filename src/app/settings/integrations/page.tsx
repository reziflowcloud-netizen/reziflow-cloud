'use client'

import { useEffect, useMemo, useState } from 'react'

type WebhookSettings = {
  slug: string
  enabled: boolean
  key: string
  fieldMap: FieldMapRow[]
  assignment: AssignmentSettings
  facebook: FacebookLeadSettings
}

type FieldMapRow = {
  external: string
  target: string
}

type AssignmentSettings = {
  mode: 'off' | 'single' | 'round_robin'
  userId: number | null
  userIds: number[]
}

type FacebookLeadSettings = {
  enabled: boolean
  verifyToken: string
  pageAccessToken: string
  apiVersion: string
}

type UserOption = {
  id: number
  name: string
  email: string
  role: string
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

const targetFields = [
  { value: 'firstName', label: 'Имя' },
  { value: 'lastName', label: 'Фамилия' },
  { value: 'fullName', label: 'Полное имя' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'messengerId', label: 'Messenger ID' },
  { value: 'city', label: 'Город' },
  { value: 'country', label: 'Страна / гражданство' },
  { value: 'language', label: 'Язык' },
  { value: 'serviceInterest', label: 'Интересующая услуга' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'urgency', label: 'Срочность' },
  { value: 'notes', label: 'Заметки' },
  { value: 'source', label: 'Источник' },
  { value: 'nextContactAt', label: 'Следующий контакт' },
  { value: 'nextContactNote', label: 'О чем сконтактироваться' },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [fieldMapDraft, setFieldMapDraft] = useState<FieldMapRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentSettings>({ mode: 'off', userId: null, userIds: [] })
  const [facebookDraft, setFacebookDraft] = useState<FacebookLeadSettings>({ enabled: false, verifyToken: '', pageAccessToken: '', apiVersion: 'v23.0' })
  const [showFacebookToken, setShowFacebookToken] = useState(false)

  const webhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/leads/${settings.slug}`
  }, [settings])
  const webliumWebhookUrl = useMemo(() => {
    if (!webhookUrl || !settings?.key) return ''
    return `${webhookUrl}/${encodeURIComponent(settings.key)}`
  }, [webhookUrl, settings?.key])
  const facebookCallbackUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/meta/leads/${settings.slug}`
  }, [settings])
  const facebookMessagesCallbackUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/meta/messages/${settings.slug}`
  }, [settings])
  const telegramWebhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined' || !settings.key) return ''
    return `${window.location.origin}/api/webhooks/telegram/leads/${settings.slug}/${encodeURIComponent(settings.key)}`
  }, [settings])
  const googleSheetsScript = useMemo(() => {
    if (!webliumWebhookUrl) return ''
    return `const REZIFLOW_WEBHOOK_URL = '${webliumWebhookUrl}';
const REZIFLOW_SENT_COLUMN = 'ReziFlow sent';

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return row[name];
    }
  }
  const normalizedNames = names.map(normalizeColumnName);
  for (const key of Object.keys(row)) {
    if (normalizedNames.indexOf(normalizeColumnName(key)) >= 0 && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function buildNextContactAt(preferredHours) {
  const text = String(preferredHours || '').trim();
  if (!text) return '';

  const match = text.match(/(\\d{1,2})(?:[.:](\\d{2}))?/);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';

  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return Utilities.formatDate(next, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function normalizeReziFlowPayload(row) {
  const firstName = pick(row, ["Ім'я", "Имя", "Name", "name", "firstName"]);
  const phone = pick(row, ["Контактний номер", "Контактный номер", "Телефон", "phone", "Phone"]);
  const interest = pick(row, ["Прізвище", "Интерес", "Услуга", "serviceInterest", "Service"]);
  const preferredHours = pick(row, ["Години", "Годины", "Час", "Время"]);
  const requestDate = pick(row, ["E-mail", "Email", "Дата заявки", "Дата"]);
  const notes = pick(row, ["Нотатки", "Заметки", "Notes", "notes"]);

  return {
    firstName: String(firstName || '').trim(),
    phone: String(phone || '').trim(),
    serviceInterest: String(interest || '').trim(),
    source: 'target',
    nextContactAt: buildNextContactAt(preferredHours),
    nextContactNote: preferredHours ? 'Перезвонить в окно: ' + preferredHours : '',
    notes: [
      requestDate ? 'Дата заявки: ' + requestDate : '',
      notes ? 'Заметки: ' + notes : '',
    ].filter(Boolean).join('\\n'),
    rawSheetRow: row,
  };
}

function postToReziFlow(row) {
  const payload = normalizeReziFlowPayload(row);

  if (!payload.firstName && !payload.phone && !payload.serviceInterest) {
    return false;
  }

  const response = UrlFetchApp.fetch(REZIFLOW_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('ReziFlow webhook failed: ' + code + ' ' + response.getContentText());
  }

  return true;
}

function ensureSentColumn(sheet, headers) {
  let index = headers.indexOf(REZIFLOW_SENT_COLUMN);
  if (index >= 0) return index;

  index = headers.length;
  sheet.getRange(1, index + 1).setValue(REZIFLOW_SENT_COLUMN);
  headers.push(REZIFLOW_SENT_COLUMN);
  return index;
}

function rowToObject(headers, row) {
  const rowObject = {};
  headers.forEach((header, index) => {
    if (header && header !== REZIFLOW_SENT_COLUMN) rowObject[header] = row[index];
  });
  return rowObject;
}

function sendLastRowToReziFlow() {
  sendNewRowsToReziFlow();
}

function sendNewRowsToReziFlow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;

    const headers = values[0].map(String);
    const hadSentColumn = headers.indexOf(REZIFLOW_SENT_COLUMN) >= 0;
    const sentColumnIndex = ensureSentColumn(sheet, headers);

    if (!hadSentColumn) return;

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const alreadySent = String(row[sentColumnIndex] || '').trim();
      if (alreadySent) continue;

      const rowObject = rowToObject(headers, row);
      if (postToReziFlow(rowObject)) {
        sheet.getRange(rowIndex + 1, sentColumnIndex + 1).setValue(new Date());
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function markExistingRowsAsSent() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(String);
  const sentColumnIndex = ensureSentColumn(sheet, headers);
  const now = new Date();
  const marks = values.slice(1).map((row) => {
    const existingMark = String(row[sentColumnIndex] || '').trim();
    return [existingMark || now];
  });

  sheet.getRange(2, sentColumnIndex + 1, marks.length, 1).setValues(marks);
}

function onFormSubmit(e) {
  const rowObject = {};
  const namedValues = e && e.namedValues ? e.namedValues : {};

  Object.keys(namedValues).forEach((key) => {
    const value = namedValues[key];
    rowObject[key] = Array.isArray(value) ? value.join(', ') : value;
  });

  postToReziFlow(rowObject);
}`
  }, [webliumWebhookUrl])

  useEffect(() => {
    loadSettings()
    loadLogs()
    loadUsers()
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
      setFieldMapDraft(Array.isArray(data.fieldMap) ? data.fieldMap : [])
      setAssignmentDraft(data.assignment || { mode: 'off', userId: null, userIds: [] })
      setFacebookDraft(data.facebook || { enabled: false, verifyToken: '', pageAccessToken: '', apiVersion: 'v23.0' })
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
      if (Array.isArray(data.fieldMap)) setFieldMapDraft(data.fieldMap)
      if (data.assignment) setAssignmentDraft(data.assignment)
      if (data.facebook) setFacebookDraft(data.facebook)
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

  async function loadUsers() {
    const res = await fetch('/api/users', { cache: 'no-store' })
    const data = await res.json().catch(() => [])
    if (res.ok) setUsers(Array.isArray(data) ? data : [])
  }

  function leadName(lead: WebhookLog['lead']) {
    if (!lead) return ''
    return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || lead.email || 'Лид'
  }

  function updateFieldMapRow(index: number, patch: Partial<FieldMapRow>) {
    setFieldMapDraft(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  function addFieldMapRow() {
    setFieldMapDraft(current => [...current, { external: '', target: 'phone' }])
  }

  function removeFieldMapRow(index: number) {
    setFieldMapDraft(current => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function saveFieldMap() {
    updateSettings({
      fieldMap: fieldMapDraft
        .map(row => ({ external: row.external.trim(), target: row.target }))
        .filter(row => row.external && row.target),
    })
  }

  function toggleRoundRobinUser(userId: number) {
    setAssignmentDraft(current => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter(id => id !== userId)
        : [...current.userIds, userId],
    }))
  }

  function saveAssignment() {
    updateSettings({ assignment: assignmentDraft })
  }

  function saveFacebookSettings(patch?: Partial<FacebookLeadSettings>) {
    updateSettings({ facebook: { ...facebookDraft, ...patch } })
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
                <label className="label">Webhook URL для Weblium</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input className="input" readOnly value={showKey ? webliumWebhookUrl : 'Покажите ключ, чтобы увидеть URL для Weblium'} />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(webliumWebhookUrl)} disabled={!showKey}>Копировать</button>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                  Используйте этот вариант, если сервис не умеет отправлять заголовок x-reziflow-key.
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

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}><span>⇄</span>Маппинг полей</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                  CRM уже автоматически понимает частые названия вроде name, phone, telefon, email, usluga, service. Здесь можно добавить свои правила для конкретного квиза или формы.
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addFieldMapRow}>+ Поле</button>
            </div>

            {fieldMapDraft.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>Ручных правил пока нет. Автораспознавание все равно работает.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {fieldMapDraft.map((row, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) auto', gap: 10, alignItems: 'center' }}>
                    <input
                      className="input"
                      value={row.external}
                      onChange={event => updateFieldMapRow(index, { external: event.target.value })}
                      placeholder="Поле из формы, например phone_number"
                    />
                    <select className="input" value={row.target} onChange={event => updateFieldMapRow(index, { target: event.target.value })}>
                      {targetFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-danger" onClick={() => removeFieldMapRow(index)}>Удалить</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={saveFieldMap} disabled={saving}>
                {saving ? 'Сохраняю...' : 'Сохранить маппинг'}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>👤</span>Автораспределение лидов</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              Новые лиды из webhook можно сразу назначать ответственному. Если внешний сервис передаст assignedToId, он будет иметь приоритет.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
              <div className="form-group">
                <label className="label">Режим</label>
                <select
                  className="input"
                  value={assignmentDraft.mode}
                  onChange={event => setAssignmentDraft(current => ({ ...current, mode: event.target.value as AssignmentSettings['mode'] }))}
                >
                  <option value="off">Не назначать автоматически</option>
                  <option value="single">Назначать одного сотрудника</option>
                  <option value="round_robin">По очереди между сотрудниками</option>
                </select>
              </div>

              {assignmentDraft.mode === 'single' && (
                <div className="form-group">
                  <label className="label">Ответственный</label>
                  <select
                    className="input"
                    value={assignmentDraft.userId || ''}
                    onChange={event => setAssignmentDraft(current => ({ ...current, userId: event.target.value ? Number(event.target.value) : null }))}
                  >
                    <option value="">— Не выбран —</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                  </select>
                </div>
              )}

              {assignmentDraft.mode === 'round_robin' && (
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Участники очереди</div>
                  {users.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Нет пользователей для выбора</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {users.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={assignmentDraft.userIds.includes(user.id)}
                            onChange={() => toggleRoundRobinUser(user.id)}
                          />
                          <span>
                            <span style={{ display: 'block', fontWeight: 700 }}>{user.name}</span>
                            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{user.email}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={saveAssignment} disabled={saving}>
                {saving ? 'Сохраняю...' : 'Сохранить распределение'}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>📣</span>Facebook Lead Ads</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              Подключение лид-форм Meta/Facebook. В Meta App укажите Callback URL и Verify Token, а в CRM сохраните Page Access Token страницы.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={facebookDraft.enabled}
                onChange={event => setFacebookDraft(current => ({ ...current, enabled: event.target.checked }))}
              />
              Принимать лиды из Facebook Lead Ads
            </label>

            <div className="form-group">
              <label className="label">Callback URL для Meta</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={facebookCallbackUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(facebookCallbackUrl)}>Копировать</button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Callback URL для сообщений Instagram/Facebook</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={facebookMessagesCallbackUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(facebookMessagesCallbackUrl)}>Копировать</button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                Этот URL добавляем в Meta Webhooks для событий сообщений. Verify Token и Page Access Token используются те же, что и для Facebook Lead Ads.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="label">Verify Token</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    className="input"
                    value={facebookDraft.verifyToken}
                    onChange={event => setFacebookDraft(current => ({ ...current, verifyToken: event.target.value }))}
                    placeholder="rzfb_..."
                  />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(facebookDraft.verifyToken)}>Копировать</button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Graph API version</label>
                <input
                  className="input"
                  value={facebookDraft.apiVersion}
                  onChange={event => setFacebookDraft(current => ({ ...current, apiVersion: event.target.value }))}
                  placeholder="v23.0"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Page Access Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  className="input"
                  type={showFacebookToken ? 'text' : 'password'}
                  value={facebookDraft.pageAccessToken}
                  onChange={event => setFacebookDraft(current => ({ ...current, pageAccessToken: event.target.value }))}
                  placeholder="Токен страницы Facebook"
                />
                <button className="btn btn-secondary" type="button" onClick={() => setShowFacebookToken(value => !value)}>
                  {showFacebookToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                Для первой версии вставляем токен вручную. Позже можно добавить вход через Facebook и выбор страницы прямо в CRM.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => updateSettings({ regenerateFacebookVerifyToken: true, facebook: facebookDraft })}
              >
                Новый Verify Token
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveFacebookSettings()} disabled={saving}>
                {saving ? 'Сохраняю...' : 'Сохранить Facebook'}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>📊</span>Google Sheets</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              Если лиды уже попадают в Google таблицу, можно поставить в таблицу Apps Script. Он отправит новую строку в CRM без Make и Zapier.
            </div>

            <div className="form-group">
              <label className="label">Webhook URL для Google Sheets</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={webliumWebhookUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(webliumWebhookUrl)}>Копировать</button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Apps Script</label>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                First setup: run markExistingRowsAsSent once for old rows. Trigger: sendLastRowToReziFlow, source From spreadsheet, event On change. New rows can be appended or inserted anywhere in the sheet.
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: 'auto', maxHeight: 360 }}>
{googleSheetsScript}
              </pre>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => copy(googleSheetsScript)}>Копировать скрипт</button>
              </div>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>✈️</span>Telegram</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              Этот вариант нужен для группы, куда уже приходят уведомления. Создайте своего Telegram-бота, добавьте его в группу и установите webhook на URL ниже. Если Telegram даст боту читать сообщения WebJackBot, CRM будет создавать лиды из этих текстов.
            </div>

            <div className="form-group">
              <label className="label">Telegram webhook URL</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={telegramWebhookUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(telegramWebhookUrl)}>Копировать</button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Команда для подключения webhook:
              <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', color: '#0f172a' }}>{`https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=${telegramWebhookUrl}`}</pre>
            </div>
          </div>
        )}

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
                      const isPing = log.status === 'ping'
                      const payload = log.payload ? Object.entries(log.payload).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(', ') : ''
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 13 }}>{new Date(log.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 800, background: isCreated ? '#dcfce7' : isPing ? '#dbeafe' : '#fee2e2', color: isCreated ? '#166534' : isPing ? '#1d4ed8' : '#991b1b' }}>
                              {isCreated ? 'Создан' : isPing ? 'Тест' : log.status === 'failed' ? 'Ошибка' : 'Отклонен'}
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
