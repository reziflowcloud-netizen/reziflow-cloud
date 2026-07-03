'use client'
import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

type BillingLimitKey = 'users' | 'clients' | 'cases' | 'leads'
type BillingLimitForm = Record<BillingLimitKey, string>

type OrganizationItem = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  billingStatus?: string
  settings?: Record<string, any> | null
  trialEndsAt: string | null
  createdAt: string
  users?: Array<{
    id: number
    name: string
    email: string
    role: string
  }>
  _count: {
    users: number
    clients: number
    cases: number
    activeCases: number
    leads: number
    tasks: number
  }
}

const BILLING_LIMIT_FIELDS: BillingLimitKey[] = ['users', 'clients', 'cases', 'leads']

function emptyBillingLimitForm(): BillingLimitForm {
  return { users: '', clients: '', cases: '', leads: '' }
}

function settingsObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, any>
}

function billingLimitsFromSettings(settings: unknown): BillingLimitForm {
  const raw = settingsObject(settingsObject(settings).billingLimits)
  const form = emptyBillingLimitForm()
  for (const key of BILLING_LIMIT_FIELDS) {
    if (!(key in raw)) continue
    form[key] = raw[key] === null ? 'unlimited' : String(raw[key])
  }
  return form
}

function billingLimitPayload(limits: BillingLimitForm) {
  const payload: Partial<Record<BillingLimitKey, number | null>> = {}
  for (const key of BILLING_LIMIT_FIELDS) {
    const value = limits[key]
    if (value === 'unlimited') {
      payload[key] = null
      continue
    }

    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      payload[key] = Math.floor(numeric)
    }
  }
  return payload
}

function billingLimitSummary(settings: unknown, labels: Record<BillingLimitKey, string>, unlimitedText: string) {
  const raw = settingsObject(settingsObject(settings).billingLimits)
  const parts = BILLING_LIMIT_FIELDS.flatMap(key => {
    if (!(key in raw)) return []
    return [`${labels[key]}: ${raw[key] === null ? unlimitedText : raw[key]}`]
  })
  return parts.join(' · ')
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale)
}

const orgText = {
  ru: {
    loadFailed: 'Не удалось загрузить фирмы',
    required: 'Заполните название фирмы, администратора, email и пароль',
    createFailed: 'Не удалось создать фирму',
    created: 'Фирма "{name}" создана. Администратор может входить по своему email и паролю.',
    saveFailed: 'Не удалось сохранить фирму',
    updated: 'Фирма обновлена',
    deleteConfirm: 'Удалить организацию "{name}"?\n\nБудут удалены пользователи: {users}\nКлиенты: {clients}\nДела: {cases}\nЛиды: {leads}\nЗадачи: {tasks}\n\nЭто действие нельзя отменить.',
    deleteFailed: 'Не удалось удалить организацию',
    deleted: 'Организация "{name}" удалена',
    expired: 'Trial истек',
    pastDue: 'Просрочка',
    canceled: 'Отменена',
    free: 'Бесплатный',
    manual: 'Ручной',
    paid: 'Оплачено',
    canceledBilling: 'Отменено',
    payment: 'Оплата',
    newCompany: 'Новая фирма',
    companyName: 'Название фирмы *',
    companyNamePlaceholder: 'Напр.: Legal Partner',
    slug: 'Короткий адрес',
    plan: 'Тариф',
    status: 'Статус',
    trialUntil: 'Пробный период до',
    firstAdmin: 'Первый администратор фирмы',
    name: 'Имя *',
    password: 'Пароль *',
    passwordPlaceholder: 'Минимум 6 символов',
    creating: 'Создание...',
    createCompany: 'Создать фирму',
    cancel: 'Отмена',
    loading: 'Загрузка...',
    empty: 'Фирм пока нет',
    adminNamePlaceholder: 'Имя администратора',
    adminEmailPlaceholder: 'Email для входа',
    adminPasswordPlaceholder: 'Новый пароль, если нужно',
    adminMissing: 'Администратор не задан',
    save: 'Сохранить',
    edit: 'Редактировать',
    deleting: 'Удаление...',
    delete: 'Удалить',
    customLimits: 'Индивидуальные лимиты',
    customLimitsHint: 'Пустое поле использует лимит тарифа. Число задает отдельный лимит для этой организации.',
    tariffPlaceholder: 'по тарифу',
    unlimited: 'Без лимита',
    customLimitsNote: 'Эти настройки применяются только к выбранной организации и отображаются в разделе “Тариф и оплата”.',
    limitLabels: { users: 'Пользователи', clients: 'Клиенты', cases: 'Дела', leads: 'Лиды' },
    totalCases: 'Всего дел',
    activeCases: 'Активные дела',
    leads: 'Лиды',
  },
  uk: {
    loadFailed: 'Не вдалося завантажити фірми',
    required: 'Заповніть назву фірми, адміністратора, email і пароль',
    createFailed: 'Не вдалося створити фірму',
    created: 'Фірму "{name}" створено. Адміністратор може входити зі своїм email і паролем.',
    saveFailed: 'Не вдалося зберегти фірму',
    updated: 'Фірму оновлено',
    deleteConfirm: 'Видалити організацію "{name}"?\n\nБудуть видалені користувачі: {users}\nКлієнти: {clients}\nСправи: {cases}\nЛіди: {leads}\nЗавдання: {tasks}\n\nЦю дію не можна скасувати.',
    deleteFailed: 'Не вдалося видалити організацію',
    deleted: 'Організацію "{name}" видалено',
    expired: 'Trial завершився',
    pastDue: 'Прострочено',
    canceled: 'Скасована',
    free: 'Безкоштовний',
    manual: 'Ручний',
    paid: 'Оплачено',
    canceledBilling: 'Скасовано',
    payment: 'Оплата',
    newCompany: 'Нова фірма',
    companyName: 'Назва фірми *',
    companyNamePlaceholder: 'Напр.: Legal Partner',
    slug: 'Коротка адреса',
    plan: 'Тариф',
    status: 'Статус',
    trialUntil: 'Пробний період до',
    firstAdmin: 'Перший адміністратор фірми',
    name: 'Ім’я *',
    password: 'Пароль *',
    passwordPlaceholder: 'Мінімум 6 символів',
    creating: 'Створення...',
    createCompany: 'Створити фірму',
    cancel: 'Скасувати',
    loading: 'Завантаження...',
    empty: 'Фірм поки немає',
    adminNamePlaceholder: 'Ім’я адміністратора',
    adminEmailPlaceholder: 'Email для входу',
    adminPasswordPlaceholder: 'Новий пароль, якщо потрібно',
    adminMissing: 'Адміністратора не задано',
    save: 'Зберегти',
    edit: 'Редагувати',
    deleting: 'Видалення...',
    delete: 'Видалити',
    customLimits: 'Індивідуальні ліміти',
    customLimitsHint: 'Порожнє поле використовує ліміт тарифу. Число задає окремий ліміт для цієї організації.',
    tariffPlaceholder: 'за тарифом',
    unlimited: 'Без ліміту',
    customLimitsNote: 'Ці налаштування застосовуються тільки до вибраної організації та відображаються в розділі “Тариф і оплата”.',
    limitLabels: { users: 'Користувачі', clients: 'Клієнти', cases: 'Справи', leads: 'Ліди' },
    totalCases: 'Усього справ',
    activeCases: 'Активні справи',
    leads: 'Ліди',
  },
  pl: {
    loadFailed: 'Nie udało się załadować firm',
    required: 'Uzupełnij nazwę firmy, administratora, email i hasło',
    createFailed: 'Nie udało się utworzyć firmy',
    created: 'Firma „{name}” została utworzona. Administrator może logować się swoim emailem i hasłem.',
    saveFailed: 'Nie udało się zapisać firmy',
    updated: 'Firma zaktualizowana',
    deleteConfirm: 'Usunąć organizację „{name}”?\n\nZostaną usunięci użytkownicy: {users}\nKlienci: {clients}\nSprawy: {cases}\nLeady: {leads}\nZadania: {tasks}\n\nTej czynności nie można cofnąć.',
    deleteFailed: 'Nie udało się usunąć organizacji',
    deleted: 'Organizacja „{name}” została usunięta',
    expired: 'Trial wygasł',
    pastDue: 'Po terminie',
    canceled: 'Anulowana',
    free: 'Bezpłatny',
    manual: 'Ręczny',
    paid: 'Opłacono',
    canceledBilling: 'Anulowano',
    payment: 'Płatność',
    newCompany: 'Nowa firma',
    companyName: 'Nazwa firmy *',
    companyNamePlaceholder: 'Np.: Legal Partner',
    slug: 'Krótki adres',
    plan: 'Taryf',
    status: 'Status',
    trialUntil: 'Okres próbny do',
    firstAdmin: 'Pierwszy administrator firmy',
    name: 'Imię *',
    password: 'Hasło *',
    passwordPlaceholder: 'Minimum 6 znaków',
    creating: 'Tworzenie...',
    createCompany: 'Utwórz firmę',
    cancel: 'Anuluj',
    loading: 'Ładowanie...',
    empty: 'Nie ma jeszcze firm',
    adminNamePlaceholder: 'Imię administratora',
    adminEmailPlaceholder: 'Email do logowania',
    adminPasswordPlaceholder: 'Nowe hasło, jeśli potrzebne',
    adminMissing: 'Administrator nie ustawiony',
    save: 'Zapisz',
    edit: 'Edytuj',
    deleting: 'Usuwanie...',
    delete: 'Usuń',
    customLimits: 'Indywidualne limity',
    customLimitsHint: 'Puste pole używa limitu taryfu. Liczba ustawia osobny limit dla tej organizacji.',
    tariffPlaceholder: 'według taryfu',
    unlimited: 'Bez limitu',
    customLimitsNote: 'Te ustawienia dotyczą tylko wybranej organizacji i są widoczne w sekcji “Taryf i płatności”.',
    limitLabels: { users: 'Użytkownicy', clients: 'Klienci', cases: 'Sprawy', leads: 'Leady' },
    totalCases: 'Wszystkie sprawy',
    activeCases: 'Aktywne sprawy',
    leads: 'Leady',
  },
}

export default function OrganizationsPage() {
  const { lang, t } = useLanguage()
  const text = orgText[lang] || orgText.ru
  const locale = lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU'
  const statusLabel = (status: string) => ({
    active: t('org_status_active'),
    paused: t('org_status_paused'),
    trial: t('org_status_trial'),
    expired: text.expired,
    past_due: text.pastDue,
    canceled: text.canceled,
  }[status] || status)
  const planLabel = (plan: string) => ({
    manual: t('org_plan_manual'),
    trial: t('org_plan_trial'),
    free: text.free,
    starter: 'Starter',
    basic: 'Basic',
    pro: 'Pro',
    agency: 'Agency',
  }[plan] || plan)
  const billingLabel = (status?: string) => ({
    manual: text.manual,
    trialing: 'Trial',
    active: text.paid,
    past_due: text.pastDue,
    canceled: text.canceledBilling,
    expired: text.expired,
  }[status || ''] || status || '—')
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [canManageAll, setCanManageAll] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan: 'manual',
    status: 'active',
    trialEndsAt: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    plan: '',
    status: '',
    trialEndsAt: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    billingLimits: emptyBillingLimitForm(),
  })

  useEffect(() => {
    loadOrganizations()
  }, [])

  async function loadOrganizations() {
    setLoading(true)
    const res = await fetch('/api/organizations')
    const data = await res.json().catch(() => [])
    if (res.ok) {
      if (Array.isArray(data)) {
        setOrganizations(data)
        setCanManageAll(true)
      } else {
        setOrganizations(data.organizations || [])
        setCanManageAll(Boolean(data.canManageAll))
      }
    }
    else setError(data.error || text.loadFailed)
    setLoading(false)
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function createOrganization() {
    setError('')
    setSuccess('')
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      setError(text.required)
      return
    }

    setSaving(true)
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || text.createFailed)
      return
    }

    setOrganizations(prev => [...prev, data])
    setForm({ name: '', slug: '', plan: 'manual', status: 'active', trialEndsAt: '', adminName: '', adminEmail: '', adminPassword: '' })
    setShowNew(false)
    setSuccess(text.created.replace('{name}', data.name))
  }

  function startEdit(org: OrganizationItem) {
    const primaryAdmin = org.users?.[0]
    setEditingId(org.id)
    setEditForm({
      name: org.name,
      plan: org.plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
      adminName: primaryAdmin?.name || '',
      adminEmail: primaryAdmin?.email || '',
      adminPassword: '',
      billingLimits: billingLimitsFromSettings(org.settings),
    })
  }

  function setBillingLimit(key: BillingLimitKey, value: string) {
    setEditForm(prev => ({
      ...prev,
      billingLimits: { ...prev.billingLimits, [key]: value },
    }))
  }

  function setBillingUnlimited(key: BillingLimitKey, checked: boolean) {
    setBillingLimit(key, checked ? 'unlimited' : '')
  }

  async function saveOrganization(id: string) {
    setError('')
    setSuccess('')
    setSaving(true)
    const payload = canManageAll
      ? { ...editForm, billingLimits: billingLimitPayload(editForm.billingLimits) }
      : editForm
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || text.saveFailed)
      return
    }
    setOrganizations(prev => prev.map(org => org.id === id ? data : org))
    setEditingId(null)
    setSuccess(text.updated)
  }

  async function deleteOrganization(org: OrganizationItem) {
    setError('')
    setSuccess('')

    const message = text.deleteConfirm
      .replace('{name}', org.name)
      .replace('{users}', String(org._count.users))
      .replace('{clients}', String(org._count.clients))
      .replace('{cases}', String(org._count.cases))
      .replace('{leads}', String(org._count.leads))
      .replace('{tasks}', String(org._count.tasks))

    if (!window.confirm(message)) return

    setDeletingId(org.id)
    const res = await fetch(`/api/organizations/${org.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)

    if (!res.ok) {
      setError(data.error || text.deleteFailed)
      return
    }

    setOrganizations(prev => prev.filter(item => item.id !== org.id))
    if (editingId === org.id) setEditingId(null)
    setSuccess(text.deleted.replace('{name}', org.name))
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('organizations_title')}</div>
          <div className="page-subtitle">{t('organizations_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
          {canManageAll && <button className="btn btn-primary" onClick={() => setShowNew(true)}>{t('new_company')}</button>}
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#14532d', fontSize: 13 }}>
            {success}
          </div>
        )}

        {canManageAll && showNew && (
          <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--brand)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{text.newCompany}</div>
              <button onClick={() => setShowNew(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">{text.companyName}</label>
                <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder={text.companyNamePlaceholder} />
              </div>
              <div className="form-group">
                <label className="label">{text.slug}</label>
                <input className="input" value={form.slug} onChange={e => setField('slug', e.target.value)} placeholder="legal-partner" />
              </div>
              <div className="form-group">
                <label className="label">{text.plan}</label>
                <select className="select" value={form.plan} onChange={e => setField('plan', e.target.value)}>
                  <option value="manual">{planLabel('manual')}</option>
                  <option value="trial">{planLabel('trial')}</option>
                  <option value="free">{planLabel('free')}</option>
                  <option value="starter">Starter</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agency</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">{text.status}</label>
                <select className="select" value={form.status} onChange={e => setField('status', e.target.value)}>
                  <option value="active">{statusLabel('active')}</option>
                  <option value="trial">{statusLabel('trial')}</option>
                  <option value="paused">{statusLabel('paused')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">{text.trialUntil}</label>
                <input className="input" type="date" value={form.trialEndsAt} onChange={e => setField('trialEndsAt', e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 16px' }} />
            <div className="section-title">{text.firstAdmin}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">{text.name}</label>
                <input className="input" value={form.adminName} onChange={e => setField('adminName', e.target.value)} placeholder="Administrator" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.adminEmail} onChange={e => setField('adminEmail', e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="form-group">
                <label className="label">{text.password}</label>
                <input className="input" type="password" value={form.adminPassword} onChange={e => setField('adminPassword', e.target.value)} placeholder={text.passwordPlaceholder} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={createOrganization} disabled={saving}>
                {saving ? text.creating : text.createCompany}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>{text.cancel}</button>
            </div>
          </div>
        )}

        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('administrator')}</th>
                  <th>{t('organization')}</th>
                  <th>{t('plan')}</th>
                  <th>{t('status')}</th>
                  <th>{text.payment}</th>
                  <th>{t('trial_until')}</th>
                  <th>{t('users_short')}</th>
                  <th>{t('clients_title')}</th>
                  <th>{text.totalCases}</th>
                  <th>{text.activeCases}</th>
                  <th>{text.leads}</th>
                  <th>{t('tasks_title')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--muted)' }}>{text.loading}</td></tr>
                )}
                {!loading && organizations.length === 0 && (
                  <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--muted)' }}>{text.empty}</td></tr>
                )}
                {organizations.map(org => {
                  const primaryAdmin = org.users?.[0]
                  const limitSummary = billingLimitSummary(org.settings, text.limitLabels, text.unlimited)
                  return (
                  <Fragment key={org.id}>
                  <tr>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <div style={{ display: 'grid', gap: 8, minWidth: 220 }}>
                          <input className="input" value={editForm.adminName} onChange={e => setEditForm(p => ({ ...p, adminName: e.target.value }))} placeholder={text.adminNamePlaceholder} />
                          <input className="input" type="email" value={editForm.adminEmail} onChange={e => setEditForm(p => ({ ...p, adminEmail: e.target.value }))} placeholder={text.adminEmailPlaceholder} />
                          <input className="input" type="password" value={editForm.adminPassword} onChange={e => setEditForm(p => ({ ...p, adminPassword: e.target.value }))} placeholder={text.adminPasswordPlaceholder} />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700 }}>{primaryAdmin?.name || '—'}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{primaryAdmin?.email || text.adminMissing}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                      ) : (
                        <>
                          <div style={{ fontWeight: 700 }}>{org.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{org.slug}</div>
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <select className="select" value={editForm.plan} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                          <option value="manual">{planLabel('manual')}</option>
                          <option value="trial">{planLabel('trial')}</option>
                          <option value="free">{planLabel('free')}</option>
                          <option value="starter">Starter</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                          <option value="agency">Agency</option>
                        </select>
                      ) : (
                        <>
                          <div>{planLabel(org.plan)}</div>
                          {limitSummary && (
                            <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11, lineHeight: 1.35 }}>
                              {limitSummary}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <select className="select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                          <option value="active">{statusLabel('active')}</option>
                          <option value="trial">{statusLabel('trial')}</option>
                          <option value="paused">{statusLabel('paused')}</option>
                        </select>
                      ) : (
                        <span className="badge" style={{
                          background: org.status === 'active' ? '#dcfce7' : org.status === 'trial' ? '#eff6ff' : '#f3f4f6',
                          color: org.status === 'active' ? '#166534' : org.status === 'trial' ? '#1d4ed8' : '#374151',
                        }}>{statusLabel(org.status)}</span>
                      )}
                    </td>
                    <td>{billingLabel(org.billingStatus)}</td>
                    <td>
                      {editingId === org.id && canManageAll ? (
                        <input className="input" type="date" value={editForm.trialEndsAt} onChange={e => setEditForm(p => ({ ...p, trialEndsAt: e.target.value }))} />
                      ) : formatDate(org.trialEndsAt, locale)}
                    </td>
                    <td>{org._count.users}</td>
                    <td>{org._count.clients}</td>
                    <td>{org._count.cases}</td>
                    <td>{org._count.activeCases}</td>
                    <td>{org._count.leads}</td>
                    <td>{org._count.tasks}</td>
                    <td>
                      {editingId === org.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary" onClick={() => saveOrganization(org.id)} disabled={saving}>{text.save}</button>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>{text.cancel}</button>
                        </div>
                      ) : canManageAll ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary" onClick={() => startEdit(org)}>{text.edit}</button>
                          <button
                            className="btn btn-secondary"
                            style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                            onClick={() => deleteOrganization(org)}
                            disabled={deletingId === org.id || saving}
                          >
                            {deletingId === org.id ? text.deleting : text.delete}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {editingId === org.id && canManageAll && (
                    <tr className="billing-limit-row">
                      <td colSpan={13}>
                        <div className="billing-limit-panel">
                          <div className="billing-limit-head">
                            <div>
                              <strong>{text.customLimits}</strong>
                              <span>{text.customLimitsHint}</span>
                            </div>
                          </div>
                          <div className="billing-limit-grid">
                            {BILLING_LIMIT_FIELDS.map(key => {
                              const value = editForm.billingLimits[key]
                              const unlimited = value === 'unlimited'
                              return (
                                <div key={key} className="billing-limit-control">
                                  <label className="label">{text.limitLabels[key]}</label>
                                  <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={unlimited ? '' : value}
                                    disabled={unlimited}
                                    onChange={event => setBillingLimit(key, event.target.value)}
                                    placeholder={text.tariffPlaceholder}
                                  />
                                  <label className="billing-limit-check">
                                    <input
                                      type="checkbox"
                                      checked={unlimited}
                                      onChange={event => setBillingUnlimited(key, event.target.checked)}
                                    />
                                    <span>{text.unlimited}</span>
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                          <div className="billing-limit-note">
                            {text.customLimitsNote}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
