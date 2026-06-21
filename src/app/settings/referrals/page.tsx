'use client'
import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

type Partner = {
  id: string
  name: string
  code: string
  status: string
  contactEmail?: string | null
  payoutDetails?: string | null
  notes?: string | null
  commissionType: string
  commissionValue: number
  commissionMonths: number
  signupUrl: string
  portalUrl?: string | null
  totals: { total: number, open: number, paid: number, canceled: number }
  commissions?: Array<{
    id: string
    organizationId: string
    amount: number
    currency: string
    status: string
    earnedAt: string
    paidAt?: string | null
    notes?: string | null
    organization?: {
      id: string
      name: string
    }
  }>
  attributions: Array<{
    id: string
    createdAt: string
    organization: {
      id: string
      name: string
      slug: string
      status: string
      plan: string
      billingStatus?: string
      trialEndsAt?: string | null
      createdAt: string
    }
  }>
}

type PartnerEditForm = {
  name: string
  code: string
  status: string
  contactEmail: string
  commissionType: string
  commissionValue: string
  commissionMonths: string
  notes: string
  payoutDetails: string
}

const referralText = {
  ru: {
    title: 'Рефералы',
    subtitle: 'Партнерские ссылки, приглашенные организации и будущие выплаты',
    back: 'Назад',
    loadFailed: 'Не удалось загрузить рефералов',
    createFailed: 'Не удалось создать партнера',
    copied: 'Реферальная ссылка скопирована',
    copyFailed: 'Не удалось скопировать ссылку. Выделите ее вручную.',
    saveFailed: 'Не удалось сохранить партнера',
    updated: 'Партнер обновлен',
    deleteConfirm: 'Удалить партнера "{name}"? Если у него есть история, он будет архивирован и скрыт из списка.',
    deleteFailed: 'Не удалось удалить партнера',
    archived: 'Партнер архивирован',
    deleted: 'Партнер удален',
    commissionFailed: 'Не удалось начислить комиссию',
    commissionCreated: 'Комиссия начислена',
    payoutConfirm: 'Отметить все открытые начисления партнера "{name}" как выплаченные?',
    payoutNote: 'Ручная выплата через админку LegalHub',
    payoutFailed: 'Не удалось отметить выплату',
    payoutDone: 'Открытые начисления отмечены как выплаченные',
    newPartner: 'Новый реферальный партнер',
    partnerName: 'Имя партнера *',
    partnerNamePlaceholder: 'Напр.: Ivan Legal Partner',
    linkCode: 'Код ссылки',
    partnerEmail: 'Email партнера',
    commissionType: 'Тип комиссии',
    percentage: 'Процент',
    fixed: 'Фиксированно',
    commission: 'Комиссия',
    months: 'Месяцев',
    note: 'Заметка',
    notePlaceholder: 'Условия, источник, договоренность',
    payoutDetails: 'Реквизиты для выплат',
    payoutPlaceholder: 'IBAN, BLIK, договоренность по выплатам',
    creating: 'Создание...',
    createPartner: 'Создать партнера',
    partner: 'Партнер',
    link: 'Ссылка',
    terms: 'Условия',
    invited: 'Приглашено',
    payable: 'К выплате',
    paid: 'Выплачено',
    actions: 'Действия',
    loading: 'Загрузка...',
    empty: 'Партнеров пока нет',
    emailMissing: 'Email не указан',
    partnerPortal: 'Кабинет партнера',
    code: 'Код',
    copy: 'Копировать',
    organizations: 'организаций',
    openAccruals: 'открытых',
    accruals: 'начислений',
    hide: 'Скрыть',
    details: 'Подробнее',
    close: 'Закрыть',
    edit: 'Редактировать',
    deleting: 'Удаление...',
    delete: 'Удалить',
    referralLink: 'Реферальная ссылка',
    partnerCode: 'Код партнера',
    invitedOrganizations: 'Приглашенные организации',
    noInvited: 'Пока нет приглашенных организаций',
    organization: 'Организация',
    status: 'Статус',
    plan: 'Тариф',
    date: 'Дата',
    createCommission: 'Начислить комиссию',
    amountPlaceholder: 'Сумма, PLN',
    charging: '...',
    charge: 'Начислить',
    commissionNotePlaceholder: 'Заметка к начислению',
    needInvited: 'Сначала нужна приглашенная организация',
    total: 'Всего',
    paying: 'Выплата...',
    payOpen: 'Выплатить открытые',
    commissionsByOrg: 'Начисления по организациям',
    accrual: 'Начисление',
    amount: 'Сумма',
    earnedAt: 'Начислено',
    paidAt: 'Выплачено',
    noCommissions: 'Начислений пока нет',
    organizationFallback: 'Организация',
    partnerCommission: 'Партнерская комиссия',
    editPartner: 'Редактирование партнера',
    active: 'Активен',
    paused: 'Отключен',
    cancel: 'Отмена',
    saving: 'Сохранение...',
    save: 'Сохранить',
    statuses: { active: 'Активна', paused: 'Пауза', manual: 'Ручной', past_due: 'Просрочка', canceled: 'Отменена', expired: 'Истек trial' },
    commissionStatuses: { pending: 'К выплате', paid: 'Выплачено', canceled: 'Отменено' },
    locale: 'ru-RU',
  },
  uk: {
    title: 'Реферали',
    subtitle: 'Партнерські посилання, запрошені організації та майбутні виплати',
    back: 'Назад',
    loadFailed: 'Не вдалося завантажити рефералів',
    createFailed: 'Не вдалося створити партнера',
    copied: 'Реферальне посилання скопійовано',
    copyFailed: 'Не вдалося скопіювати посилання. Виділіть його вручну.',
    saveFailed: 'Не вдалося зберегти партнера',
    updated: 'Партнера оновлено',
    deleteConfirm: 'Видалити партнера "{name}"? Якщо є історія, його буде архівовано і приховано зі списку.',
    deleteFailed: 'Не вдалося видалити партнера',
    archived: 'Партнера архівовано',
    deleted: 'Партнера видалено',
    commissionFailed: 'Не вдалося нарахувати комісію',
    commissionCreated: 'Комісію нараховано',
    payoutConfirm: 'Позначити всі відкриті нарахування партнера "{name}" як виплачені?',
    payoutNote: 'Ручна виплата через адмінку LegalHub',
    payoutFailed: 'Не вдалося позначити виплату',
    payoutDone: 'Відкриті нарахування позначено як виплачені',
    newPartner: 'Новий реферальний партнер',
    partnerName: 'Ім’я партнера *',
    partnerNamePlaceholder: 'Напр.: Ivan Legal Partner',
    linkCode: 'Код посилання',
    partnerEmail: 'Email партнера',
    commissionType: 'Тип комісії',
    percentage: 'Відсоток',
    fixed: 'Фіксовано',
    commission: 'Комісія',
    months: 'Місяців',
    note: 'Нотатка',
    notePlaceholder: 'Умови, джерело, домовленість',
    payoutDetails: 'Реквізити для виплат',
    payoutPlaceholder: 'IBAN, BLIK, домовленість щодо виплат',
    creating: 'Створення...',
    createPartner: 'Створити партнера',
    partner: 'Партнер',
    link: 'Посилання',
    terms: 'Умови',
    invited: 'Запрошено',
    payable: 'До виплати',
    paid: 'Виплачено',
    actions: 'Дії',
    loading: 'Завантаження...',
    empty: 'Партнерів поки немає',
    emailMissing: 'Email не вказано',
    partnerPortal: 'Кабінет партнера',
    code: 'Код',
    copy: 'Копіювати',
    organizations: 'організацій',
    openAccruals: 'відкритих',
    accruals: 'нарахувань',
    hide: 'Сховати',
    details: 'Детальніше',
    close: 'Закрити',
    edit: 'Редагувати',
    deleting: 'Видалення...',
    delete: 'Видалити',
    referralLink: 'Реферальне посилання',
    partnerCode: 'Код партнера',
    invitedOrganizations: 'Запрошені організації',
    noInvited: 'Запрошених організацій поки немає',
    organization: 'Організація',
    status: 'Статус',
    plan: 'Тариф',
    date: 'Дата',
    createCommission: 'Нарахувати комісію',
    amountPlaceholder: 'Сума, PLN',
    charging: '...',
    charge: 'Нарахувати',
    commissionNotePlaceholder: 'Нотатка до нарахування',
    needInvited: 'Спочатку потрібна запрошена організація',
    total: 'Всього',
    paying: 'Виплата...',
    payOpen: 'Виплатити відкриті',
    commissionsByOrg: 'Нарахування по організаціях',
    accrual: 'Нарахування',
    amount: 'Сума',
    earnedAt: 'Нараховано',
    paidAt: 'Виплачено',
    noCommissions: 'Нарахувань поки немає',
    organizationFallback: 'Організація',
    partnerCommission: 'Партнерська комісія',
    editPartner: 'Редагування партнера',
    active: 'Активний',
    paused: 'Вимкнений',
    cancel: 'Скасувати',
    saving: 'Збереження...',
    save: 'Зберегти',
    statuses: { active: 'Активна', paused: 'Пауза', manual: 'Ручний', past_due: 'Прострочено', canceled: 'Скасована', expired: 'Trial завершився' },
    commissionStatuses: { pending: 'До виплати', paid: 'Виплачено', canceled: 'Скасовано' },
    locale: 'uk-UA',
  },
  pl: {
    title: 'Polecenia',
    subtitle: 'Linki partnerskie, zaproszone organizacje i przyszłe wypłaty',
    back: 'Wstecz',
    loadFailed: 'Nie udało się załadować partnerów',
    createFailed: 'Nie udało się utworzyć partnera',
    copied: 'Link polecający skopiowany',
    copyFailed: 'Nie udało się skopiować linku. Zaznacz go ręcznie.',
    saveFailed: 'Nie udało się zapisać partnera',
    updated: 'Partner zaktualizowany',
    deleteConfirm: 'Usunąć partnera „{name}”? Jeśli ma historię, zostanie zarchiwizowany i ukryty z listy.',
    deleteFailed: 'Nie udało się usunąć partnera',
    archived: 'Partner zarchiwizowany',
    deleted: 'Partner usunięty',
    commissionFailed: 'Nie udało się naliczyć prowizji',
    commissionCreated: 'Prowizja naliczona',
    payoutConfirm: 'Oznaczyć wszystkie otwarte naliczenia partnera „{name}” jako wypłacone?',
    payoutNote: 'Ręczna wypłata przez panel LegalHub',
    payoutFailed: 'Nie udało się oznaczyć wypłaty',
    payoutDone: 'Otwarte naliczenia oznaczono jako wypłacone',
    newPartner: 'Nowy partner polecający',
    partnerName: 'Imię partnera *',
    partnerNamePlaceholder: 'Np.: Ivan Legal Partner',
    linkCode: 'Kod linku',
    partnerEmail: 'Email partnera',
    commissionType: 'Typ prowizji',
    percentage: 'Procent',
    fixed: 'Stała kwota',
    commission: 'Prowizja',
    months: 'Miesięcy',
    note: 'Notatka',
    notePlaceholder: 'Warunki, źródło, ustalenia',
    payoutDetails: 'Dane do wypłat',
    payoutPlaceholder: 'IBAN, BLIK, ustalenia dotyczące wypłat',
    creating: 'Tworzenie...',
    createPartner: 'Utwórz partnera',
    partner: 'Partner',
    link: 'Link',
    terms: 'Warunki',
    invited: 'Zaproszono',
    payable: 'Do wypłaty',
    paid: 'Wypłacono',
    actions: 'Działania',
    loading: 'Ładowanie...',
    empty: 'Nie ma jeszcze partnerów',
    emailMissing: 'Email nie podany',
    partnerPortal: 'Panel partnera',
    code: 'Kod',
    copy: 'Kopiuj',
    organizations: 'organizacji',
    openAccruals: 'otwartych',
    accruals: 'naliczeń',
    hide: 'Ukryj',
    details: 'Szczegóły',
    close: 'Zamknij',
    edit: 'Edytuj',
    deleting: 'Usuwanie...',
    delete: 'Usuń',
    referralLink: 'Link polecający',
    partnerCode: 'Kod partnera',
    invitedOrganizations: 'Zaproszone organizacje',
    noInvited: 'Brak zaproszonych organizacji',
    organization: 'Organizacja',
    status: 'Status',
    plan: 'Taryf',
    date: 'Data',
    createCommission: 'Naliczyć prowizję',
    amountPlaceholder: 'Kwota, PLN',
    charging: '...',
    charge: 'Nalicz',
    commissionNotePlaceholder: 'Notatka do naliczenia',
    needInvited: 'Najpierw potrzebna jest zaproszona organizacja',
    total: 'Razem',
    paying: 'Wypłata...',
    payOpen: 'Wypłać otwarte',
    commissionsByOrg: 'Naliczenia według organizacji',
    accrual: 'Naliczenie',
    amount: 'Kwota',
    earnedAt: 'Naliczono',
    paidAt: 'Wypłacono',
    noCommissions: 'Brak naliczeń',
    organizationFallback: 'Organizacja',
    partnerCommission: 'Prowizja partnerska',
    editPartner: 'Edycja partnera',
    active: 'Aktywny',
    paused: 'Wyłączony',
    cancel: 'Anuluj',
    saving: 'Zapisywanie...',
    save: 'Zapisz',
    statuses: { active: 'Aktywna', paused: 'Pauza', manual: 'Ręczny', past_due: 'Po terminie', canceled: 'Anulowana', expired: 'Trial wygasł' },
    commissionStatuses: { pending: 'Do wypłaty', paid: 'Wypłacono', canceled: 'Anulowano' },
    locale: 'pl-PL',
  },
}

function money(value: number) {
  return `${value.toFixed(2)} zł`
}

function statusBadge(status: string | undefined, text: typeof referralText.ru) {
  const label: Record<string, string> = {
    trial: 'Trial',
    active: text.statuses.active,
    paused: text.statuses.paused,
    trialing: 'Trial',
    manual: text.statuses.manual,
    past_due: text.statuses.past_due,
    canceled: text.statuses.canceled,
    expired: text.statuses.expired,
  }
  return label[status || ''] || status || '—'
}

function commissionStatusLabel(status: string | undefined, text: typeof referralText.ru) {
  const labels: Record<string, string> = {
    pending: text.commissionStatuses.pending,
    paid: text.commissionStatuses.paid,
    canceled: text.commissionStatuses.canceled,
  }
  return labels[status || ''] || status || '—'
}

function formatDate(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleDateString(locale) : '—'
}

export default function ReferralsPage() {
  const { lang } = useLanguage()
  const text = referralText[lang] || referralText.ru
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null)
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null)
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null)
  const [payingPartnerId, setPayingPartnerId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editForms, setEditForms] = useState<Record<string, PartnerEditForm>>({})
  const [commissionForms, setCommissionForms] = useState<Record<string, { organizationId: string, amount: string, notes: string }>>({})
  const [form, setForm] = useState({
    name: '',
    code: '',
    contactEmail: '',
    commissionType: 'percentage',
    commissionValue: '10',
    commissionMonths: '12',
    notes: '',
    payoutDetails: '',
  })

  useEffect(() => {
    loadPartners()
  }, [])

  async function loadPartners() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/referrals')
    const data = await res.json().catch(() => ({}))
    if (res.ok) setPartners(data.partners || [])
    else setError(data.error || text.loadFailed)
    setLoading(false)
  }

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || text.createFailed)
      return
    }
    setPartners(prev => [data, ...prev])
    if (data.id) setExpandedPartnerId(data.id)
    setForm({
      name: '',
      code: '',
      contactEmail: '',
      commissionType: 'percentage',
      commissionValue: '10',
      commissionMonths: '12',
      notes: '',
      payoutDetails: '',
    })
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function buildEditForm(partner: Partner): PartnerEditForm {
    return {
      name: partner.name || '',
      code: partner.code || '',
      status: partner.status || 'active',
      contactEmail: partner.contactEmail || '',
      commissionType: partner.commissionType || 'percentage',
      commissionValue: String(partner.commissionValue || ''),
      commissionMonths: String(partner.commissionMonths || ''),
      notes: partner.notes || '',
      payoutDetails: partner.payoutDetails || '',
    }
  }

  function editForm(partner: Partner) {
    return editForms[partner.id] || buildEditForm(partner)
  }

  function startEditing(partner: Partner) {
    setError('')
    setSuccess('')
    setExpandedPartnerId(partner.id)
    setEditingPartnerId(partner.id)
    setEditForms(prev => ({ ...prev, [partner.id]: buildEditForm(partner) }))
  }

  function togglePartner(partnerId: string) {
    const isOpen = expandedPartnerId === partnerId
    setExpandedPartnerId(isOpen ? null : partnerId)
    if (isOpen && editingPartnerId === partnerId) setEditingPartnerId(null)
  }

  async function copyReferralLink(url: string) {
    setError('')
    setSuccess('')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setSuccess(text.copied)
    } catch {
      setError(text.copyFailed)
    }
  }

  function setEditField(partner: Partner, key: keyof PartnerEditForm, value: string) {
    setEditForms(prev => ({
      ...prev,
      [partner.id]: { ...editForm(partner), [key]: value },
    }))
  }

  async function savePartner(partner: Partner) {
    setError('')
    setSuccess('')
    setSavingEditId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm(partner)),
    })
    const data = await res.json().catch(() => ({}))
    setSavingEditId(null)
    if (!res.ok) {
      setError(data.error || text.saveFailed)
      return
    }
    setSuccess(text.updated)
    setEditingPartnerId(null)
    await loadPartners()
  }

  async function deletePartner(partner: Partner) {
    if (!window.confirm(text.deleteConfirm.replace('{name}', partner.name))) return

    setError('')
    setSuccess('')
    setDeletingPartnerId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingPartnerId(null)
    if (!res.ok) {
      setError(data.error || text.deleteFailed)
      return
    }
    setSuccess(data.archived ? text.archived : text.deleted)
    if (editingPartnerId === partner.id) setEditingPartnerId(null)
    if (expandedPartnerId === partner.id) setExpandedPartnerId(null)
    await loadPartners()
  }

  function commissionForm(partner: Partner) {
    return commissionForms[partner.id] || {
      organizationId: partner.attributions[0]?.organization.id || '',
      amount: '',
      notes: '',
    }
  }

  function setCommissionField(partner: Partner, key: string, value: string) {
    setCommissionForms(prev => ({
      ...prev,
      [partner.id]: { ...commissionForm(partner), [key]: value },
    }))
  }

  async function createCommission(partner: Partner) {
    const current = commissionForm(partner)
    setError('')
    setSuccess('')
    setSavingCommissionId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}/commissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    const data = await res.json().catch(() => ({}))
    setSavingCommissionId(null)
    if (!res.ok) {
      setError(data.error || text.commissionFailed)
      return
    }
    setSuccess(text.commissionCreated)
    setCommissionForms(prev => ({
      ...prev,
      [partner.id]: { organizationId: current.organizationId, amount: '', notes: '' },
    }))
    await loadPartners()
  }

  async function payOpenCommissions(partner: Partner) {
    if (!window.confirm(text.payoutConfirm.replace('{name}', partner.name))) return

    setError('')
    setSuccess('')
    setPayingPartnerId(partner.id)
    const res = await fetch(`/api/referrals/${partner.id}/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: text.payoutNote }),
    })
    const data = await res.json().catch(() => ({}))
    setPayingPartnerId(null)
    if (!res.ok) {
      setError(data.error || text.payoutFailed)
      return
    }
    setSuccess(text.payoutDone)
    await loadPartners()
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{text.title}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">{text.back}</Link>
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

        <div className="card" style={{ marginBottom: 18, maxWidth: 980 }}>
          <div className="section-title">{text.newPartner}</div>
          <form onSubmit={createPartner}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 220px', gap: 14 }}>
              <div className="form-group">
                <label className="label">{text.partnerName}</label>
                <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder={text.partnerNamePlaceholder} required />
              </div>
              <div className="form-group">
                <label className="label">{text.linkCode}</label>
                <input className="input" value={form.code} onChange={e => setField('code', e.target.value)} placeholder="ivan" />
              </div>
              <div className="form-group">
                <label className="label">{text.partnerEmail}</label>
                <input className="input" type="email" value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)} placeholder="partner@example.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 180px 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="label">{text.commissionType}</label>
                <select className="select" value={form.commissionType} onChange={e => setField('commissionType', e.target.value)}>
                  <option value="percentage">{text.percentage}</option>
                  <option value="fixed">{text.fixed}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">{text.commission}</label>
                <input className="input" value={form.commissionValue} onChange={e => setField('commissionValue', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">{text.months}</label>
                <input className="input" value={form.commissionMonths} onChange={e => setField('commissionMonths', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">{text.note}</label>
                <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} style={{ minHeight: 82, resize: 'vertical' }} placeholder={text.notePlaceholder} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">{text.payoutDetails}</label>
              <textarea className="input" value={form.payoutDetails} onChange={e => setField('payoutDetails', e.target.value)} rows={3} style={{ minHeight: 82, resize: 'vertical' }} placeholder={text.payoutPlaceholder} />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? text.creating : text.createPartner}</button>
          </form>
        </div>

        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{text.partner}</th>
                  <th>{text.link}</th>
                  <th>{text.terms}</th>
                  <th>{text.invited}</th>
                  <th>{text.payable}</th>
                  <th>{text.paid}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>{text.loading}</td></tr>}
                {!loading && partners.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>{text.empty}</td></tr>}
                {partners.map(partner => {
                  const isExpanded = expandedPartnerId === partner.id
                  const currentCommissionForm = commissionForm(partner)

                  return (
                    <Fragment key={partner.id}>
                      <tr
                        onClick={() => togglePartner(partner.id)}
                        style={{ cursor: 'pointer', background: isExpanded ? '#f8fafc' : undefined }}
                      >
                        <td>
                          <div style={{ fontWeight: 800 }}>{partner.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.contactEmail || text.emailMissing}</div>
                          {partner.portalUrl && (
                            <a
                              href={partner.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}
                            >
                              {text.partnerPortal}
                            </a>
                          )}
                        </td>
                        <td>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'grid', gap: 6, maxWidth: 320 }}>
                            <div
                              title={partner.signupUrl}
                              style={{ color: 'var(--brand)', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {partner.signupUrl}
                            </div>
                            <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{text.code}: {partner.code}</span>
                              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => copyReferralLink(partner.signupUrl)}>
                                {text.copy}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td>
                          {partner.commissionType === 'percentage' ? `${partner.commissionValue}%` : money(partner.commissionValue)}
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissionMonths} {text.months.toLowerCase()}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{partner.attributions.length}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{text.organizations}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{money(partner.totals.open)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissions?.filter(item => item.status === 'pending').length || 0} {text.openAccruals}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{money(partner.totals.paid)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{partner.commissions?.length || 0} {text.accruals}</div>
                        </td>
                        <td>
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 260 }}>
                            <button type="button" className="btn btn-secondary" onClick={() => togglePartner(partner.id)}>
                              {isExpanded ? text.hide : text.details}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => editingPartnerId === partner.id ? setEditingPartnerId(null) : startEditing(partner)}
                            >
                              {editingPartnerId === partner.id ? text.close : text.edit}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ color: '#b91c1c' }}
                              onClick={() => deletePartner(partner)}
                              disabled={deletingPartnerId === partner.id}
                            >
                              {deletingPartnerId === partner.id ? text.deleting : text.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: '#fbfdff', padding: 0 }}>
                            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
                              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8, padding: 12 }}>
                                <div className="section-title">{text.referralLink}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                                  <input
                                    className="input"
                                    readOnly
                                    value={partner.signupUrl}
                                    onFocus={e => e.currentTarget.select()}
                                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                                  />
                                  <button type="button" className="btn btn-secondary" onClick={() => copyReferralLink(partner.signupUrl)}>
                                    {text.copy}
                                  </button>
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{text.partnerCode}: {partner.code}</div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
                                <div>
                                  <div className="section-title" style={{ marginBottom: 8 }}>{text.invitedOrganizations}</div>
                                  {partner.attributions.length === 0 ? (
                                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.noInvited}</div>
                                  ) : (
                                    <div className="table-scroll">
                                      <table className="table">
                                        <thead>
                                          <tr>
                                            <th>{text.organization}</th>
                                            <th>{text.status}</th>
                                            <th>{text.plan}</th>
                                            <th>{text.date}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {partner.attributions.map(item => (
                                            <tr key={item.id}>
                                              <td style={{ fontWeight: 800 }}>{item.organization.name}</td>
                                              <td>{statusBadge(item.organization.billingStatus || item.organization.status, text)}</td>
                                              <td>{item.organization.plan || '—'}</td>
                                              <td>{formatDate(item.organization.createdAt, text.locale)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'grid', gap: 12 }}>
                                  <div>
                                    <div className="section-title" style={{ marginBottom: 8 }}>{text.createCommission}</div>
                                    {partner.attributions.length > 0 ? (
                                      <div style={{ display: 'grid', gap: 8 }}>
                                        <select
                                          className="select"
                                          value={currentCommissionForm.organizationId}
                                          onChange={e => setCommissionField(partner, 'organizationId', e.target.value)}
                                        >
                                          {partner.attributions.map(item => (
                                            <option key={item.organization.id} value={item.organization.id}>{item.organization.name}</option>
                                          ))}
                                        </select>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) auto', gap: 8 }}>
                                          <input
                                            className="input"
                                            value={currentCommissionForm.amount}
                                            onChange={e => setCommissionField(partner, 'amount', e.target.value)}
                                            placeholder={text.amountPlaceholder}
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => createCommission(partner)}
                                            disabled={savingCommissionId === partner.id}
                                          >
                                            {savingCommissionId === partner.id ? text.charging : text.charge}
                                          </button>
                                        </div>
                                        <textarea
                                          className="input"
                                          value={currentCommissionForm.notes}
                                          onChange={e => setCommissionField(partner, 'notes', e.target.value)}
                                          rows={4}
                                          style={{ minHeight: 96, resize: 'vertical' }}
                                          placeholder={text.commissionNotePlaceholder}
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.needInvited}</div>
                                    )}
                                  </div>

                                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 10, padding: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                                      <div>
                                        <div className="label">{text.payable}</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.open)}</div>
                                      </div>
                                      <div>
                                        <div className="label">{text.paid}</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.paid)}</div>
                                      </div>
                                      <div>
                                        <div className="label">{text.total}</div>
                                        <div style={{ fontWeight: 800 }}>{money(partner.totals.total)}</div>
                                      </div>
                                    </div>
                                    {partner.totals.open > 0 && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => payOpenCommissions(partner)}
                                        disabled={payingPartnerId === partner.id}
                                      >
                                        {payingPartnerId === partner.id ? text.paying : text.payOpen}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="section-title" style={{ marginBottom: 8 }}>{text.commissionsByOrg}</div>
                                {!!partner.commissions?.length ? (
                                  <div className="table-scroll">
                                    <table className="table">
                                      <thead>
                                        <tr>
                                          <th>{text.organization}</th>
                                          <th>{text.accrual}</th>
                                          <th>{text.amount}</th>
                                          <th>{text.status}</th>
                                          <th>{text.earnedAt}</th>
                                          <th>{text.paidAt}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {partner.commissions.map(item => (
                                          <tr key={item.id}>
                                            <td style={{ fontWeight: 800 }}>{item.organization?.name || text.organizationFallback}</td>
                                            <td>{item.notes || text.partnerCommission}</td>
                                            <td style={{ fontWeight: 800 }}>{money(item.amount || 0)}</td>
                                            <td>{commissionStatusLabel(item.status, text)}</td>
                                            <td>{formatDate(item.earnedAt, text.locale)}</td>
                                            <td>{formatDate(item.paidAt, text.locale)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.noCommissions}</div>
                                )}
                              </div>

                              {editingPartnerId === partner.id && (
                                <div style={{ borderTop: '1px solid var(--border)', display: 'grid', gap: 12, paddingTop: 14 }}>
                                  <div className="section-title">{text.editPartner}</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div className="form-group">
                                      <label className="label">{text.partnerName}</label>
                                      <input className="input" value={editForm(partner).name} onChange={e => setEditField(partner, 'name', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.linkCode}</label>
                                      <input className="input" value={editForm(partner).code} onChange={e => setEditField(partner, 'code', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.partnerEmail}</label>
                                      <input className="input" type="email" value={editForm(partner).contactEmail} onChange={e => setEditField(partner, 'contactEmail', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.status}</label>
                                      <select className="select" value={editForm(partner).status} onChange={e => setEditField(partner, 'status', e.target.value)}>
                                        <option value="active">{text.active}</option>
                                        <option value="paused">{text.paused}</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div className="form-group">
                                      <label className="label">{text.commissionType}</label>
                                      <select className="select" value={editForm(partner).commissionType} onChange={e => setEditField(partner, 'commissionType', e.target.value)}>
                                        <option value="percentage">{text.percentage}</option>
                                        <option value="fixed">{text.fixed}</option>
                                      </select>
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.commission}</label>
                                      <input className="input" value={editForm(partner).commissionValue} onChange={e => setEditField(partner, 'commissionValue', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.months}</label>
                                      <input className="input" value={editForm(partner).commissionMonths} onChange={e => setEditField(partner, 'commissionMonths', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                      <label className="label">{text.note}</label>
                                      <textarea className="input" value={editForm(partner).notes} onChange={e => setEditField(partner, 'notes', e.target.value)} rows={4} style={{ minHeight: 110, resize: 'vertical' }} />
                                    </div>
                                  </div>
                                  <div className="form-group">
                                    <label className="label">{text.payoutDetails}</label>
                                    <textarea className="input" value={editForm(partner).payoutDetails} onChange={e => setEditField(partner, 'payoutDetails', e.target.value)} rows={4} style={{ minHeight: 110, resize: 'vertical' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingPartnerId(null)}>{text.cancel}</button>
                                    <button type="button" className="btn btn-primary" onClick={() => savePartner(partner)} disabled={savingEditId === partner.id}>
                                      {savingEditId === partner.id ? text.saving : text.save}
                                    </button>
                                  </div>
                                </div>
                              )}
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
