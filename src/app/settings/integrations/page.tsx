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
  messagesEnabled: boolean
  verifyToken: string
  pageAccessToken: string
  instagramPageAccessToken: string
  apiVersion: string
}

type StorageSettings = {
  provider: 'cloudinary' | 'dropbox'
  dropbox: {
    enabled: boolean
    rootFolder: string
    hasAccessToken: boolean
    accessToken?: string
  }
  canManage: boolean
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

type MetaTokenDiagnostic = {
  label: string
  configured: boolean
  ok?: boolean
  error?: string
  data?: {
    id?: string
    name?: string
    username?: string
    instagram_business_account?: { id?: string; username?: string }
    connected_instagram_account?: { id?: string; username?: string }
  }
}

type MetaTokenDiagnostics = {
  apiVersion?: string
  facebook?: MetaTokenDiagnostic
  instagram?: MetaTokenDiagnostic
  hint?: string
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

const DEFAULT_FACEBOOK_DRAFT: FacebookLeadSettings = {
  enabled: false,
  messagesEnabled: false,
  verifyToken: '',
  pageAccessToken: '',
  instagramPageAccessToken: '',
  apiVersion: 'v23.0',
}

function metaAccountSummary(account?: { id?: string; name?: string; username?: string } | null) {
  if (!account) return ''
  return [
    account.username ? `@${account.username}` : '',
    account.name || '',
    account.id ? `ID ${account.id}` : '',
  ].filter(Boolean).join(' · ')
}

function metaDiagnosticDetails(item?: MetaTokenDiagnostic) {
  if (!item) return 'Нет данных диагностики'
  if (!item.configured) return 'Токен не сохранен'
  if (!item.ok) return item.error || 'Meta не приняла токен'

  const page = metaAccountSummary(item.data)
  const instagramBusiness = metaAccountSummary(item.data?.instagram_business_account)
  const connectedInstagram = metaAccountSummary(item.data?.connected_instagram_account)

  return [
    page || 'Meta вернула OK',
    instagramBusiness ? `Instagram Business: ${instagramBusiness}` : '',
    connectedInstagram ? `Connected Instagram: ${connectedInstagram}` : '',
  ].filter(Boolean).join(' | ')
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const [fieldMapDraft, setFieldMapDraft] = useState<FieldMapRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentSettings>({ mode: 'off', userId: null, userIds: [] })
  const [facebookDraft, setFacebookDraft] = useState<FacebookLeadSettings>(DEFAULT_FACEBOOK_DRAFT)
  const [showFacebookToken, setShowFacebookToken] = useState(false)
  const [showInstagramToken, setShowInstagramToken] = useState(false)
  const [metaSubscriptionLoading, setMetaSubscriptionLoading] = useState(false)
  const [metaSubscriptionStatus, setMetaSubscriptionStatus] = useState('')
  const [metaDiagnosticsLoading, setMetaDiagnosticsLoading] = useState(false)
  const [metaDiagnostics, setMetaDiagnostics] = useState<MetaTokenDiagnostics | null>(null)
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null)
  const [storageDraft, setStorageDraft] = useState<StorageSettings['dropbox']>({ enabled: false, rootFolder: '/LegalHub', hasAccessToken: false, accessToken: '' })
  const [showDropboxToken, setShowDropboxToken] = useState(false)

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
  const privacyPolicyUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/privacy`
  }, [])
  const dataDeletionUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/data-deletion`
  }, [])
  const telegramWebhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined' || !settings.key) return ''
    return `${window.location.origin}/api/webhooks/telegram/leads/${settings.slug}/${encodeURIComponent(settings.key)}`
  }, [settings])
  const googleSheetsScript = useMemo(() => {
    if (!webliumWebhookUrl) return ''
    return `const REZIFLOW_WEBHOOK_URL = '${webliumWebhookUrl}';
const REZIFLOW_SENT_PREFIX = 'reziflow_sent_';

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

function rowToObject(headers, row) {
  const rowObject = {};
  headers.forEach((header, index) => {
    if (header) rowObject[header] = row[index];
  });
  return rowObject;
}

function rowSentKey(rowObject) {
  const json = JSON.stringify(rowObject);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json);
  return REZIFLOW_SENT_PREFIX + Utilities.base64EncodeWebSafe(digest);
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
    const properties = PropertiesService.getDocumentProperties();

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const rowObject = rowToObject(headers, row);
      const key = rowSentKey(rowObject);
      if (properties.getProperty(key)) continue;

      if (postToReziFlow(rowObject)) {
        properties.setProperty(key, new Date().toISOString());
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
  const properties = PropertiesService.getDocumentProperties();
  const now = new Date();

  values.slice(1).forEach((row) => {
    const rowObject = rowToObject(headers, row);
    properties.setProperty(rowSentKey(rowObject), now.toISOString());
  });
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
    loadStorageSettings()
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
      setFacebookDraft({ ...DEFAULT_FACEBOOK_DRAFT, ...(data.facebook || {}) })
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
      if (data.facebook) setFacebookDraft({ ...DEFAULT_FACEBOOK_DRAFT, ...data.facebook })
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

  async function loadStorageSettings() {
    const res = await fetch('/api/storage-settings', { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.dropbox) {
      setStorageSettings(data)
      setStorageDraft({ ...data.dropbox, accessToken: '' })
    }
  }

  async function saveStorageSettings() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/storage-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropbox: storageDraft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save document storage')
        return
      }
      setStorageSettings(data)
      setStorageDraft({ ...data.dropbox, accessToken: '' })
    } finally {
      setSaving(false)
    }
  }

  function leadName(lead: WebhookLog['lead']) {
    if (!lead) return ''
    return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || lead.email || 'Лид'
  }

  function payloadSummary(payload?: Record<string, unknown> | null) {
    const metaEvent = payload && typeof payload === 'object' ? (payload as any).metaEvent : null
    if (metaEvent && typeof metaEvent === 'object') {
      return [
        `Meta event: ${metaEvent.kind || 'unknown'}`,
        `echo: ${metaEvent.isEcho ? 'yes' : 'no'}`,
        `text: ${metaEvent.hasText ? 'yes' : 'no'}`,
        `keys: ${Array.isArray(metaEvent.eventKeys) ? metaEvent.eventKeys.join(', ') : '—'}`,
      ].join(' · ')
    }
    const metaChange = payload && typeof payload === 'object' ? (payload as any).metaChange : null
    if (metaChange && typeof metaChange === 'object') {
      const author = metaChange.username ? `@${metaChange.username}` : metaChange.fromId || 'unknown'
      const text = metaChange.text ? `: ${metaChange.text}` : ''
      const media = metaChange.mediaProductType ? ` · ${metaChange.mediaProductType}` : ''
      return `Meta change: ${metaChange.kind || 'change'} · ${author}${media}${text}`
    }
    return payload ? Object.entries(payload).slice(0, 4).map(([key, value]) => `${key}: ${typeof value === 'object' && value !== null ? '[object]' : String(value)}`).join(', ') : ''
  }

  function payloadJson(payload?: Record<string, unknown> | null) {
    if (!payload) return ''
    try {
      return JSON.stringify(payload, null, 2)
    } catch {
      return String(payload)
    }
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

  async function subscribeMetaPage() {
    setMetaSubscriptionLoading(true)
    setMetaSubscriptionStatus('')
    setError('')
    try {
      await updateSettings({ facebook: facebookDraft })
      const res = await fetch('/api/meta/subscriptions', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMetaSubscriptionStatus(data.error || 'Meta не приняла подписку страницы')
        return
      }
      const app = Array.isArray(data.apps) ? data.apps.find((item: any) => Array.isArray(item.subscribed_fields)) : null
      const fields = Array.isArray(app?.subscribed_fields) ? app.subscribed_fields.join(', ') : 'messages, message_echoes'
      setMetaSubscriptionStatus(`Страница ${data.page?.name || data.page?.id || ''} подписана. Поля: ${fields}`)
    } finally {
      setMetaSubscriptionLoading(false)
    }
  }

  async function runMetaTokenDiagnostics() {
    setMetaDiagnosticsLoading(true)
    setMetaDiagnostics(null)
    setMetaSubscriptionStatus('')
    setError('')
    try {
      await updateSettings({ facebook: facebookDraft })
      const res = await fetch('/api/meta/token-diagnostics', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Не удалось проверить Meta токены')
        return
      }
      setMetaDiagnostics(data)
    } finally {
      setMetaDiagnosticsLoading(false)
    }
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
            {storageSettings && (
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="section-title" style={{ marginBottom: 4 }}><span>📁</span>Хранение документов</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                   CRM всегда сохраняет документ в Cloudinary как основное хранилище. Если Dropbox подключен, туда дополнительно отправляется копия для папок организации.
                  </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={storageDraft.enabled}
                    disabled={!storageSettings.canManage || saving}
                    onChange={event => setStorageDraft(current => ({ ...current, enabled: event.target.checked }))}
                  />
                   Делать копию новых документов в Dropbox
                  </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1.3fr) auto', gap: 10, alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Папка в Dropbox</label>
                    <input
                      className="input"
                      value={storageDraft.rootFolder}
                      disabled={!storageSettings.canManage || saving}
                      onChange={event => setStorageDraft(current => ({ ...current, rootFolder: event.target.value }))}
                      placeholder="/LegalHub"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Dropbox Access Token</label>
                    <input
                      className="input"
                      type={showDropboxToken ? 'text' : 'password'}
                      value={storageDraft.accessToken || ''}
                      disabled={!storageSettings.canManage || saving}
                      onChange={event => setStorageDraft(current => ({ ...current, accessToken: event.target.value }))}
                      placeholder={storageDraft.hasAccessToken ? 'Токен уже сохранен. Вставьте новый только для замены.' : 'sl....'}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowDropboxToken(value => !value)}>
                      {showDropboxToken ? 'Скрыть' : 'Показать'}
                    </button>
                    <button className="btn btn-primary" type="button" onClick={saveStorageSettings} disabled={!storageSettings.canManage || saving}>
                      {saving ? 'Сохраняю...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Публичные страницы для публикации Meta App</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                Эти ссылки можно вставить в Meta Developers в поля Privacy Policy URL и Data Deletion URL. Страницы открываются без входа в CRM.
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Privacy Policy</span>
                  <input className="input" readOnly value={privacyPolicyUrl} />
                  <a className="btn btn-secondary" href="/privacy" target="_blank" rel="noreferrer">Открыть</a>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(privacyPolicyUrl)}>Копировать</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Data Deletion</span>
                  <input className="input" readOnly value={dataDeletionUrl} />
                  <a className="btn btn-secondary" href="/data-deletion" target="_blank" rel="noreferrer">Открыть</a>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(dataDeletionUrl)}>Копировать</button>
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={facebookDraft.enabled}
                onChange={event => setFacebookDraft(current => ({ ...current, enabled: event.target.checked }))}
              />
              Принимать лиды из Facebook Lead Ads
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={facebookDraft.messagesEnabled}
                onChange={event => setFacebookDraft(current => ({ ...current, messagesEnabled: event.target.checked }))}
              />
              Принимать сообщения из Instagram Direct и Facebook Messenger
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
                Этот URL добавляем в Meta Webhooks для событий сообщений. Verify Token общий, а Page Access Token можно указать отдельно для Facebook Messenger и Instagram Direct.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <button className="btn btn-secondary" type="button" onClick={subscribeMetaPage} disabled={metaSubscriptionLoading || saving}>
                  {metaSubscriptionLoading ? 'Проверяю Meta...' : 'Подписать страницу на messages / message_echoes'}
                </button>
                {metaSubscriptionStatus && (
                  <span style={{ fontSize: 12, color: metaSubscriptionStatus.includes('не приняла') || metaSubscriptionStatus.includes('failed') ? '#991b1b' : 'var(--muted)' }}>
                    {metaSubscriptionStatus}
                  </span>
                )}
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
              <label className="label">Facebook Page Access Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  className="input"
                  type={showFacebookToken ? 'text' : 'password'}
                  name="legalhub-facebook-page-access-token"
                  autoComplete="off"
                  spellCheck={false}
                  value={facebookDraft.pageAccessToken}
                  onChange={event => setFacebookDraft(current => ({ ...current, pageAccessToken: event.target.value }))}
                  placeholder="Токен страницы Facebook для Lead Ads и Messenger"
                />
                <button className="btn btn-secondary" type="button" onClick={() => setShowFacebookToken(value => !value)}>
                  {showFacebookToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                Используется для Facebook Lead Ads и исходящих сообщений Facebook Messenger.
              </div>
            </div>

            <div className="form-group">
              <label className="label">Instagram Page Access Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  className="input"
                  type={showInstagramToken ? 'text' : 'password'}
                  name="legalhub-instagram-page-access-token"
                  autoComplete="off"
                  spellCheck={false}
                  value={facebookDraft.instagramPageAccessToken || ''}
                  onChange={event => setFacebookDraft(current => ({ ...current, instagramPageAccessToken: event.target.value }))}
                  placeholder="Токен для Instagram Direct"
                />
                <button className="btn btn-secondary" type="button" onClick={() => setShowInstagramToken(value => !value)}>
                  {showInstagramToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                Используется для профиля отправителя и ответов в Instagram Direct. Если поле пустое, CRM временно попробует Facebook token.
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: metaDiagnostics ? 12 : 0 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Диагностика Meta токенов</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                    Проверяет сохраненные токены и показывает Page ID / Instagram account, которые Meta возвращает CRM.
                  </div>
                </div>
                <button className="btn btn-secondary" type="button" onClick={runMetaTokenDiagnostics} disabled={metaDiagnosticsLoading || saving}>
                  {metaDiagnosticsLoading ? 'Проверяю...' : 'Проверить токены'}
                </button>
              </div>

              {metaDiagnostics && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {(['facebook', 'instagram'] as const).map(key => {
                    const item = metaDiagnostics[key]
                    const tone = !item?.configured ? '#92400e' : item.ok ? '#166534' : '#991b1b'
                    const background = !item?.configured ? '#fffbeb' : item.ok ? '#f0fdf4' : '#fef2f2'
                    return (
                      <div key={key} style={{ border: `1px solid ${tone}22`, borderRadius: 8, background, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ color: '#0f172a', fontSize: 13 }}>{item?.label || key}</strong>
                          <span style={{ color: tone, fontSize: 12, fontWeight: 800 }}>
                            {!item?.configured ? 'NO TOKEN' : item.ok ? 'OK' : 'ERROR'}
                          </span>
                        </div>
                        <div style={{ color: tone, fontSize: 12, lineHeight: 1.5 }}>{metaDiagnosticDetails(item)}</div>
                      </div>
                    )
                  })}
                  {metaDiagnostics.apiVersion && (
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      Graph API: {metaDiagnostics.apiVersion}
                    </div>
                  )}
                  {metaDiagnostics.hint && (
                    <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
                      {metaDiagnostics.hint}
                    </div>
                  )}
                </div>
              )}
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
                First setup: run markExistingRowsAsSent once for old rows. Trigger: sendLastRowToReziFlow, source From spreadsheet, event On change. The script no longer adds visible columns and stores sent marks inside Apps Script properties.
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLogsCollapsed(current => !current)}
                  aria-expanded={!logsCollapsed}
                >
                  {logsCollapsed ? 'Показать журнал' : 'Свернуть'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={logsLoading}>
                  {logsLoading ? 'Обновляю...' : 'Обновить'}
                </button>
              </div>
            </div>

            {logsCollapsed ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
                Журнал свернут. Записей загружено: {logs.length}.
              </div>
            ) : logs.length === 0 ? (
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
                      const isMessage = log.status === 'message'
                      const isIgnored = log.status === 'ignored'
                      const isComment = log.status === 'comment'
                      const isService = log.status === 'service'
                      const payload = payloadSummary(log.payload)
                      const fullPayload = payloadJson(log.payload)
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 13 }}>{new Date(log.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 800, background: isCreated ? '#dcfce7' : isPing ? '#dbeafe' : isMessage ? '#ede9fe' : isIgnored ? '#fef3c7' : isComment ? '#e0f2fe' : isService ? '#f1f5f9' : '#fee2e2', color: isCreated ? '#166534' : isPing ? '#1d4ed8' : isMessage ? '#6d28d9' : isIgnored ? '#92400e' : isComment ? '#0369a1' : isService ? '#475569' : '#991b1b' }}>
                              {isCreated ? 'Создан' : isPing ? 'Тест' : isMessage ? 'Сообщение' : isIgnored ? 'Пропущено' : isComment ? 'Комментарий' : isService ? 'Сервис' : log.status === 'failed' ? 'Ошибка' : 'Отклонен'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13 }}>{log.source || '—'}</td>
                          <td style={{ fontSize: 13 }}>
                            {log.lead ? <a href={`/leads/${log.lead.id}`}>{leadName(log.lead)}</a> : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: log.error ? '#991b1b' : 'var(--muted)', maxWidth: 520 }}>
                            <div>{log.error || payload || '—'}</div>
                            {fullPayload && (
                              <details style={{ marginTop: 6, color: 'var(--muted)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Показать payload</summary>
                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', marginTop: 8, padding: 10, borderRadius: 6, background: 'var(--bg-soft)', color: 'var(--text)' }}>
                                  {fullPayload}
                                </pre>
                              </details>
                            )}
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
