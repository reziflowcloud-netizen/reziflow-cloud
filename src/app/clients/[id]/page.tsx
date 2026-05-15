'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import CollapsibleCardsBehavior from '@/components/CollapsibleCardsBehavior'
import SectionVisibilityBehavior from '@/components/SectionVisibilityBehavior'
import CustomSectionsRenderer, { type CustomSectionsHandle } from '@/components/CustomSectionsRenderer'
import PhoneListEditor, { ensurePhoneRows } from '@/components/PhoneListEditor'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый': { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе': { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено': { bg: '#dcfce7', color: '#14532d' },
  'Архив': { bg: '#f3f4f6', color: '#374151' },
  'Отказ': { bg: '#fef2f2', color: '#991b1b' },
}

const COUNTRIES = ['Украина','Россия','Беларусь','Молдова','Грузия','Армения','Казахстан','Узбекистан','Польша','Другое']
const EYE_COLORS = ['Карие','Голубые','Зелёные','Серые','Чёрные','Смешанные']
const MARITAL_STATUS = ['Холост/Не замужем','Женат/Замужем','Разведён/Разведена','Вдовец/Вдова']
const EDUCATION = ['Начальное','Среднее','Среднее специальное','Высшее','Учёная степень']
const LEGAL_TITLE = ['Wynajem (Аренда)','Własność (Собственность)','Użyczenie (Безвозмездное пользование)','Zamieszkanie u rodziny (У родственников)','Inne (Другое)']
const STAY_BASIS = ['Без основания','Виза','Карта побыту','Побыт временный','Побыт постоянный','Безвизовый режим']

const F = ({ label, children, col = false }: any) => (
  <div className="form-group" style={col ? { gridColumn: '1/-1' } : {}}>
    <label className="label">{label}</label>
    {children}
  </div>
)

const CLIENT_DETAIL_TEXT: Record<string, Record<string, string>> = {
  ru: {
    loading: 'Загрузка...',
    save: '💾 Сохранить',
    saving: 'Сохранение...',
    newCase: '+ Новое дело',
    delete: '🗑 Удалить',
    deleteConfirm: 'Удалить клиента "{name}"? Все дела этого клиента также будут удалены. Это действие нельзя отменить.',
    deleteError: 'Ошибка удаления клиента',
    customSaveError: 'Не удалось сохранить дополнительные поля',
    personalTitle: 'Данные личные',
    personalSubtitle: 'Основная информация о клиенте',
    firstName: 'Имя *',
    lastName: 'Фамилия *',
    previousFirstName: 'Предыдущее имя',
    previousLastName: 'Предыдущая фамилия',
    maidenName: 'Девичья фамилия',
    birthDate: 'Дата рождения',
    birthPlace: 'Место рождения',
    phone: 'Телефон',
    statusFamilyTitle: 'Статус и семья',
    statusFamilySubtitle: 'Гражданство, семейное положение и данные семьи',
    citizenship: 'Гражданство (Obywatelstwo)',
    nationality: 'Национальность (Narodowość)',
    maritalStatus: 'Семейное положение',
    education: 'Образование',
    chooseCountry: 'Выбрать страну',
    choose: 'Выбрать',
    statusUkrHint: 'Клиент имеет статус беженца из Украины',
    family: 'Семья',
    fatherName: 'Имя отца',
    motherName: 'Имя матери',
    motherMaidenName: 'Девичья фамилия матери',
    dependents: 'Лица на содержании',
    familyCheckbox: 'Клиент состоит в семье с другим клиентом',
    editFamily: 'Изменить состав семьи',
    familySearch: 'Поиск по имени, телефону или email...',
    familyNotFound: 'Клиенты не найдены',
    done: 'Готово',
    passportTitle: 'Паспортные данные',
    passportSeries: 'Серия и номер',
    passportIssuedBy: 'Выдан кем',
    passportIssuedAt: 'Дата выдачи',
    passportExpiresAt: 'Действует до',
    passportExpired: '⚠️ Паспорт просрочен',
    passportSoon: '⚠️ Паспорт истекает менее чем через 90 дней',
    passportValid: '✅ Паспорт действителен',
    physicalTitle: 'Физические признаки',
    height: 'Рост (см)',
    eyeColor: 'Цвет глаз',
    specialSigns: 'Особые приметы',
    specialSignsPlaceholder: 'Татуировки, шрамы и т.д.',
    originAddressTitle: 'Адрес проживания в стране происхождения',
    originAddressSubtitle: 'Адрес, где клиент проживал до переезда',
    previousAddressTitle: 'Адрес в стране предыдущего проживания',
    previousAddressSubtitle: 'При условии проживания 365 дней +',
    addressPlaceholder: 'Страна, город, улица, дом, квартира...',
    polandStayTitle: 'Пребывание в Польше',
    addressInPoland: 'Адрес в Польше',
    legalTitle: 'Правовой титул на жильё',
    rentalEndDate: 'Конец аренды',
    stayBasis: 'Основание пребывания',
    lastEntryDate: 'Дата последнего въезда',
    residenceCard: 'Карта пребывания (Karta pobytu)',
    firstResidenceCard: 'Первая карта пребывания (Pierwsza karta pobytu)',
    residenceCardExpiry: 'Срок действия карты',
    fines: 'Штрафы (Mandaty)',
    finesInPoland: 'Были штрафы в Польше (Mandaty w Polsce)',
    finesDescription: 'Опишите штрафы...',
    travelTitle: 'История путешествий',
    add: '+ Добавить',
    country: 'Страна *',
    entryDate: 'Дата въезда',
    exitDate: 'Дата выезда',
    cancel: 'Отмена',
    noTravel: 'Нет записей о путешествиях',
    addFirstTravel: 'Добавить первую запись',
    entry: 'Въезд',
    exit: 'Выезд',
    activeCases: 'Активные дела',
    noActiveCases: 'Нет активных дел',
    closedCases: 'Закрытые дела',
    info: 'Информация',
    created: 'Создано',
    updated: 'Обновлено',
    department: 'Отдел',
  },
  uk: {
    loading: 'Завантаження...',
    save: '💾 Зберегти',
    saving: 'Збереження...',
    newCase: '+ Нова справа',
    delete: '🗑 Видалити',
    deleteConfirm: 'Видалити клієнта "{name}"? Усі справи цього клієнта також буде видалено. Цю дію не можна скасувати.',
    deleteError: 'Помилка видалення клієнта',
    customSaveError: 'Не вдалося зберегти додаткові поля',
    personalTitle: 'Особисті дані',
    personalSubtitle: 'Основна інформація про клієнта',
    firstName: "Ім'я *",
    lastName: 'Прізвище *',
    previousFirstName: "Попереднє ім'я",
    previousLastName: 'Попереднє прізвище',
    maidenName: 'Дівоче прізвище',
    birthDate: 'Дата народження',
    birthPlace: 'Місце народження',
    phone: 'Телефон',
    statusFamilyTitle: 'Статус і сім’я',
    statusFamilySubtitle: 'Громадянство, сімейний стан і дані сім’ї',
    citizenship: 'Громадянство (Obywatelstwo)',
    nationality: 'Національність (Narodowość)',
    maritalStatus: 'Сімейний стан',
    education: 'Освіта',
    chooseCountry: 'Вибрати країну',
    choose: 'Вибрати',
    statusUkrHint: 'Клієнт має статус біженця з України',
    family: 'Сім’я',
    fatherName: 'Ім’я батька',
    motherName: 'Ім’я матері',
    motherMaidenName: 'Дівоче прізвище матері',
    dependents: 'Особи на утриманні',
    familyCheckbox: 'Клієнт перебуває в сім’ї з іншим клієнтом',
    editFamily: 'Змінити склад сім’ї',
    familySearch: 'Пошук за ім’ям, телефоном або email...',
    familyNotFound: 'Клієнтів не знайдено',
    done: 'Готово',
    passportTitle: 'Паспортні дані',
    passportSeries: 'Серія і номер',
    passportIssuedBy: 'Ким виданий',
    passportIssuedAt: 'Дата видачі',
    passportExpiresAt: 'Дійсний до',
    passportExpired: '⚠️ Паспорт прострочений',
    passportSoon: '⚠️ Паспорт закінчується менш ніж за 90 днів',
    passportValid: '✅ Паспорт дійсний',
    physicalTitle: 'Фізичні ознаки',
    height: 'Зріст (см)',
    eyeColor: 'Колір очей',
    specialSigns: 'Особливі прикмети',
    specialSignsPlaceholder: 'Татуювання, шрами тощо',
    originAddressTitle: 'Адреса проживання в країні походження',
    originAddressSubtitle: 'Адреса, де клієнт проживав до переїзду',
    previousAddressTitle: 'Адреса в країні попереднього проживання',
    previousAddressSubtitle: 'За умови проживання 365 днів +',
    addressPlaceholder: 'Країна, місто, вулиця, будинок, квартира...',
    polandStayTitle: 'Перебування у Польщі',
    addressInPoland: 'Адреса в Польщі',
    legalTitle: 'Правова підстава на житло',
    rentalEndDate: 'Кінець оренди',
    stayBasis: 'Підстава перебування',
    lastEntryDate: 'Дата останнього в’їзду',
    residenceCard: 'Карта перебування (Karta pobytu)',
    firstResidenceCard: 'Перша карта перебування (Pierwsza karta pobytu)',
    residenceCardExpiry: 'Строк дії карти',
    fines: 'Штрафи (Mandaty)',
    finesInPoland: 'Були штрафи в Польщі (Mandaty w Polsce)',
    finesDescription: 'Опишіть штрафи...',
    travelTitle: 'Історія подорожей',
    add: '+ Додати',
    country: 'Країна *',
    entryDate: 'Дата в’їзду',
    exitDate: 'Дата виїзду',
    cancel: 'Скасувати',
    noTravel: 'Немає записів про подорожі',
    addFirstTravel: 'Додати перший запис',
    entry: 'В’їзд',
    exit: 'Виїзд',
    activeCases: 'Активні справи',
    noActiveCases: 'Немає активних справ',
    closedCases: 'Закриті справи',
    info: 'Інформація',
    created: 'Створено',
    updated: 'Оновлено',
    department: 'Відділ',
  },
  pl: {
    loading: 'Ładowanie...',
    save: '💾 Zapisz',
    saving: 'Zapisywanie...',
    newCase: '+ Nowa sprawa',
    delete: '🗑 Usuń',
    deleteConfirm: 'Usunąć klienta "{name}"? Wszystkie sprawy tego klienta również zostaną usunięte. Tej operacji nie można cofnąć.',
    deleteError: 'Błąd usuwania klienta',
    customSaveError: 'Nie udało się zapisać pól dodatkowych',
    personalTitle: 'Dane osobowe',
    personalSubtitle: 'Podstawowe informacje o kliencie',
    firstName: 'Imię *',
    lastName: 'Nazwisko *',
    previousFirstName: 'Poprzednie imię',
    previousLastName: 'Poprzednie nazwisko',
    maidenName: 'Nazwisko panieńskie',
    birthDate: 'Data urodzenia',
    birthPlace: 'Miejsce urodzenia',
    phone: 'Telefon',
    statusFamilyTitle: 'Status i rodzina',
    statusFamilySubtitle: 'Obywatelstwo, stan cywilny i dane rodziny',
    citizenship: 'Obywatelstwo',
    nationality: 'Narodowość',
    maritalStatus: 'Stan cywilny',
    education: 'Wykształcenie',
    chooseCountry: 'Wybierz kraj',
    choose: 'Wybierz',
    statusUkrHint: 'Klient ma status uchodźcy z Ukrainy',
    family: 'Rodzina',
    fatherName: 'Imię ojca',
    motherName: 'Imię matki',
    motherMaidenName: 'Nazwisko panieńskie matki',
    dependents: 'Osoby na utrzymaniu',
    familyCheckbox: 'Klient jest w rodzinie z innym klientem',
    editFamily: 'Zmień skład rodziny',
    familySearch: 'Szukaj po imieniu, telefonie lub emailu...',
    familyNotFound: 'Nie znaleziono klientów',
    done: 'Gotowe',
    passportTitle: 'Dane paszportowe',
    passportSeries: 'Seria i numer',
    passportIssuedBy: 'Wydany przez',
    passportIssuedAt: 'Data wydania',
    passportExpiresAt: 'Ważny do',
    passportExpired: '⚠️ Paszport jest nieważny',
    passportSoon: '⚠️ Paszport wygasa za mniej niż 90 dni',
    passportValid: '✅ Paszport jest ważny',
    physicalTitle: 'Cechy fizyczne',
    height: 'Wzrost (cm)',
    eyeColor: 'Kolor oczu',
    specialSigns: 'Znaki szczególne',
    specialSignsPlaceholder: 'Tatuaże, blizny itd.',
    originAddressTitle: 'Adres zamieszkania w kraju pochodzenia',
    originAddressSubtitle: 'Adres, pod którym klient mieszkał przed przeprowadzką',
    previousAddressTitle: 'Adres w kraju poprzedniego pobytu',
    previousAddressSubtitle: 'Jeśli pobyt trwał 365 dni +',
    addressPlaceholder: 'Kraj, miasto, ulica, dom, mieszkanie...',
    polandStayTitle: 'Pobyt w Polsce',
    addressInPoland: 'Adres w Polsce',
    legalTitle: 'Tytuł prawny do lokalu',
    rentalEndDate: 'Koniec najmu',
    stayBasis: 'Podstawa pobytu',
    lastEntryDate: 'Data ostatniego wjazdu',
    residenceCard: 'Karta pobytu',
    firstResidenceCard: 'Pierwsza karta pobytu',
    residenceCardExpiry: 'Termin ważności karty',
    fines: 'Mandaty',
    finesInPoland: 'Były mandaty w Polsce',
    finesDescription: 'Opisz mandaty...',
    travelTitle: 'Historia podróży',
    add: '+ Dodaj',
    country: 'Kraj *',
    entryDate: 'Data wjazdu',
    exitDate: 'Data wyjazdu',
    cancel: 'Anuluj',
    noTravel: 'Brak zapisów o podróżach',
    addFirstTravel: 'Dodaj pierwszy wpis',
    entry: 'Wjazd',
    exit: 'Wyjazd',
    activeCases: 'Aktywne sprawy',
    noActiveCases: 'Brak aktywnych spraw',
    closedCases: 'Zamknięte sprawy',
    info: 'Informacje',
    created: 'Utworzono',
    updated: 'Zaktualizowano',
    department: 'Oddział',
  },
}

export default function ClientDetailPage() {
  const { lang } = useLanguage()
  const text = CLIENT_DETAIL_TEXT[lang] || CLIENT_DETAIL_TEXT.ru
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('backTo') || '/clients'
  const [client, setClient] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [travelHistory, setTravelHistory] = useState<any[]>([])
  const [availableClients, setAvailableClients] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [familySearch, setFamilySearch] = useState('')
  const [showFamilyPicker, setShowFamilyPicker] = useState(false)
  const [newTravel, setNewTravel] = useState({ country: '', entryDate: '', exitDate: '' })
  const [showAddTravel, setShowAddTravel] = useState(false)
  const customSectionsRef = useRef<CustomSectionsHandle>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setClient(data)
      setTravelHistory(data.travelHistory || [])
      setForm({
        firstName: data.firstName || '', lastName: data.lastName || '',
        previousFirstName: data.previousFirstName || '', previousLastName: data.previousLastName || '',
        maidenName: data.maidenName || '',
        birthDate: data.birthDate?.slice(0,10) || '',
        birthPlace: data.birthPlace || '',
        pesel: data.pesel || '',
        phone: data.phone || '', phones: ensurePhoneRows(data.phones, data.phone || ''), email: data.email || '',
        citizenship: data.citizenship || '', nationality: data.nationality || '',
        maritalStatus: data.maritalStatus || '', education: data.education || '',
        statusUKR: data.statusUKR || false,
        fatherName: data.fatherName || '', motherName: data.motherName || '',
        motherMaidenName: data.motherMaidenName || '', dependents: data.dependents || '',
        passportSeries: data.passportSeries || '', passportNumber: data.passportNumber || '',
        passportIssuedBy: data.passportIssuedBy || '',
        passportIssuedAt: data.passportIssuedAt?.slice(0,10) || '',
        passportExpiresAt: data.passportExpiresAt?.slice(0,10) || '',
        height: data.height || '', eyeColor: data.eyeColor || '', specialSigns: data.specialSigns || '',
        originCountryAddress: data.originCountryAddress || '',
        previousResidenceAddress: data.previousResidenceAddress || '',
        addressInPoland: data.addressInPoland || '',
        legalTitle: data.legalTitle || '',
        rentalEndDate: data.rentalEndDate?.slice(0,10) || '',
        stayBasis: data.stayBasis || '',
        lastEntryDate: data.lastEntryDate?.slice(0,10) || '',
        firstResidenceCard: data.firstResidenceCard || false,
        residenceCardExpiry: data.residenceCardExpiry?.slice(0,10) || '',
        finesInPoland: data.finesInPoland || false,
        finesDescription: data.finesDescription || '',
        hasFamilyClients: (data.familyLinks || []).length > 0,
        familyClientIds: (data.familyLinks || []).map((link: any) => link.relativeClientId),
      })
    })
  }, [id])

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setAvailableClients(Array.isArray(data) ? data.filter((item: any) => item.id !== id) : [])
    })
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => setCurrentUser(data))
  }, [id])

  function set(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const updated = await res.json()
      const selectedFamilyLinks = availableClients
        .filter(item => (form.familyClientIds || []).includes(item.id))
        .map(item => ({ relativeClientId: item.id, relativeClient: item }))
      setForm((prev: any) => ({ ...prev, phone: updated.phone || prev.phone || '', phones: ensurePhoneRows(updated.phones, updated.phone || prev.phone || '') }))
      setClient((prev: any) => ({ ...prev, ...updated, familyLinks: selectedFamilyLinks }))
      setShowFamilyPicker(false)
      const customOk = await customSectionsRef.current?.save()
      if (customOk === false) alert(text.customSaveError)
    } finally {
      setSaving(false)
    }
  }

  async function deleteClient() {
    if (!confirm(text.deleteConfirm.replace('{name}', `${client.firstName} ${client.lastName}`))) return
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/clients')
    } else {
      alert(text.deleteError)
    }
  }

  async function addTravel() {
    if (!newTravel.country.trim()) return
    const res = await fetch(`/api/clients/${id}/travel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTravel),
    })
    const entry = await res.json()
    setTravelHistory(p => [entry, ...p])
    setNewTravel({ country: '', entryDate: '', exitDate: '' })
    setShowAddTravel(false)
  }

  async function removeTravel(travelId: number) {
    await fetch(`/api/clients/${id}/travel/${travelId}`, { method: 'DELETE' })
    setTravelHistory(p => p.filter((t: any) => t.id !== travelId))
  }

  if (!client) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{text.loading}</div>

  const cases = client.cases || []
  const activeCases = cases.filter((c: any) => ['В работе','Ожидание документов','Новый'].includes(c.status))
  const closedCases = cases.filter((c: any) => !['В работе','Ожидание документов','Новый'].includes(c.status))

  const canDeleteClient = currentUser?.role === 'admin' || currentUser?.role === 'owner'
  const familySelectedIds = form.familyClientIds || []
  const selectedFamilyClients = availableClients.filter(item => familySelectedIds.includes(item.id))
  const filteredFamilyClients = availableClients.filter(item => {
    const text = `${item.firstName || ''} ${item.lastName || ''} ${item.phone || ''} ${item.email || ''}`.toLowerCase()
    return text.includes(familySearch.trim().toLowerCase())
  })

  function toggleFamilyClient(clientId: string) {
    const selected = familySelectedIds.includes(clientId)
      ? familySelectedIds.filter((item: string) => item !== clientId)
      : [...familySelectedIds, clientId]
    set('familyClientIds', selected)
  }

  // Helpers
  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push(backTo)} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{client.firstName[0]}{client.lastName[0]}</div>
            <div>
              <div className="page-title">{client.firstName} {client.lastName}</div>
              <div className="page-subtitle">{form.phone || client.phone}{client.email ? ` · ${client.email}` : ''}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} className="btn btn-primary" disabled={saving}>{saving ? text.saving : text.save}</button>
          <Link href={`/cases/new?clientId=${client.id}`} className="btn btn-secondary">{text.newCase}</Link>
          {canDeleteClient && (
            <button onClick={deleteClient} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#dc2626', fontWeight: 500, fontSize: 13 }}>{text.delete}</button>
          )}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div data-collapsible-scope="client-profile">
            <CollapsibleCardsBehavior scope="client-profile" />
            <SectionVisibilityBehavior scope="client" />

            {/* ── DANE OSOBOWE ── */}
            <div className="card" data-collapse-key="client-personal" data-section-scope="client" data-section-key="client-personal" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{text.personalTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{text.personalSubtitle}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label={text.firstName}>
                  <input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                </F>
                <F label={text.lastName}>
                  <input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </F>
                <F label={text.previousFirstName}>
                  <input className="input" value={form.previousFirstName} onChange={e => set('previousFirstName', e.target.value)} placeholder="Poprzednie imię" />
                </F>
                <F label={text.previousLastName}>
                  <input className="input" value={form.previousLastName} onChange={e => set('previousLastName', e.target.value)} placeholder="Poprzednie nazwisko" />
                </F>
                <F label={text.maidenName}>
                  <input className="input" value={form.maidenName} onChange={e => set('maidenName', e.target.value)} placeholder="Nazwisko panieńskie" />
                </F>
                <F label={text.birthDate}>
                  <input className="input" type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
                </F>
                <F label={text.birthPlace}>
                  <input className="input" value={form.birthPlace} onChange={e => set('birthPlace', e.target.value)} placeholder="Miasto" />
                </F>
                <F label="PESEL">
                  <input className="input" value={form.pesel} onChange={e => set('pesel', e.target.value)} placeholder="12345678901" style={{ fontFamily: 'monospace' }} />
                </F>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="label">{text.phone}</label>
                  <PhoneListEditor
                    phones={form.phones || ensurePhoneRows([], form.phone || '')}
                    onChange={phones => {
                      const primary = phones.find(item => item.isPrimary)?.phone || phones[0]?.phone || ''
                      setForm((current: any) => ({ ...current, phones, phone: primary }))
                    }}
                  />
                </div>
                <F label="E-mail">
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                </F>
              </div>
            </div>

            {/* ── СТАТУС И СЕМЬЯ ── */}
            <div className="card" data-collapse-key="client-status-family" data-section-scope="client" data-section-key="client-status-family" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👨‍👩‍👧</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{text.statusFamilyTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{text.statusFamilySubtitle}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label={text.citizenship}>
                  <select className="select" value={form.citizenship} onChange={e => set('citizenship', e.target.value)}>
                    <option value="">{text.chooseCountry}</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label={text.nationality}>
                  <select className="select" value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                    <option value="">{text.choose}</option>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label={text.maritalStatus}>
                  <select className="select" value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>
                    <option value="">{text.choose}</option>
                    {MARITAL_STATUS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <F label={text.education}>
                  <select className="select" value={form.education} onChange={e => set('education', e.target.value)}>
                    <option value="">{text.choose}</option>
                    {EDUCATION.map(e => <option key={e}>{e}</option>)}
                  </select>
                </F>
                {/* Status UKR */}
                <div style={{ gridColumn: '1/-1' }}>
                  <div
                    onClick={() => set('statusUKR', !form.statusUKR)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1px solid ${form.statusUKR ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.statusUKR ? 'rgba(37,99,235,0.06)' : 'var(--bg)', transition: 'all 0.15s' }}
                  >
                    <input type="checkbox" checked={form.statusUKR} onChange={() => {}} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Status UKR</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{text.statusUkrHint}</div>
                    </div>
                  </div>
                </div>
                {/* Семья */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>{text.family}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <F label={text.fatherName}>
                      <input className="input" value={form.fatherName} onChange={e => set('fatherName', e.target.value)} placeholder="Imię ojca" />
                    </F>
                    <F label={text.motherName}>
                      <input className="input" value={form.motherName} onChange={e => set('motherName', e.target.value)} placeholder="Imię matki" />
                    </F>
                    <F label={text.motherMaidenName} col>
                      <input className="input" value={form.motherMaidenName} onChange={e => set('motherMaidenName', e.target.value)} placeholder="Nazwisko panieńskie matki" />
                    </F>
                    <F label={text.dependents} col>
                      <textarea className="input" value={form.dependents} onChange={e => set('dependents', e.target.value)} rows={2} placeholder="Informacje o osobach na utrzymaniu..." />
                    </F>
                    <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!form.hasFamilyClients}
                          onChange={e => {
                            set('hasFamilyClients', e.target.checked)
                            setShowFamilyPicker(e.target.checked)
                            if (!e.target.checked) set('familyClientIds', [])
                          }}
                          style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                        />
                        {text.familyCheckbox}
                      </label>
                      {form.hasFamilyClients && (
                        <div style={{ marginTop: 10 }}>
                          {selectedFamilyClients.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                              {selectedFamilyClients.map(item => (
                                <Link
                                  key={item.id}
                                  href={`/clients/${item.id}`}
                                  style={{ textDecoration: 'none', color: 'var(--brand)', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}
                                >
                                  {item.firstName} {item.lastName}
                                </Link>
                              ))}
                            </div>
                          )}
                          {!showFamilyPicker && (
                            <button type="button" onClick={() => setShowFamilyPicker(true)} className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>
                              {text.editFamily}
                            </button>
                          )}
                          {(showFamilyPicker || selectedFamilyClients.length === 0) && (
                            <div style={{ marginTop: 10 }}>
                              <input
                                className="input"
                                value={familySearch}
                                onChange={e => setFamilySearch(e.target.value)}
                                placeholder={text.familySearch}
                                style={{ marginBottom: 8 }}
                              />
                              <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', maxHeight: 180, overflowY: 'auto' }}>
                                {filteredFamilyClients.length === 0 ? (
                                  <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>
                                    {text.familyNotFound}
                                  </div>
                                ) : filteredFamilyClients.map(item => {
                                  const checked = familySelectedIds.includes(item.id)
                                  return (
                                    <label
                                      key={item.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: checked ? 'rgba(37,99,235,0.06)' : 'transparent' }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleFamilyClient(item.id)}
                                        style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                                      />
                                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                                        {item.firstName} {item.lastName}
                                      </span>
                                      {(item.phone || item.email) && (
                                        <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {item.phone || item.email}
                                        </span>
                                      )}
                                    </label>
                                  )
                                })}
                              </div>
                              {selectedFamilyClients.length > 0 && (
                                <button type="button" onClick={() => setShowFamilyPicker(false)} className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>
                                  {text.done}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ПАСПОРТНЫЕ ДАННЫЕ + ФИЗИЧЕСКИЕ ПРИЗНАКИ ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="card" data-collapse-key="client-passport" data-section-scope="client" data-section-key="client-passport">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{text.passportTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Informacje z paszportu</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label={text.passportSeries}>
                    <input className="input" value={form.passportSeries} onChange={e => set('passportSeries', e.target.value)} placeholder="AB123456" style={{ fontFamily: 'monospace' }} />
                  </F>
                  <F label={text.passportIssuedBy}>
                    <input className="input" value={form.passportIssuedBy} onChange={e => set('passportIssuedBy', e.target.value)} />
                  </F>
                  <F label={text.passportIssuedAt}>
                    <input className="input" type="date" value={form.passportIssuedAt} onChange={e => set('passportIssuedAt', e.target.value)} />
                  </F>
                  <F label={text.passportExpiresAt}>
                    <input className="input" type="date" value={form.passportExpiresAt} onChange={e => set('passportExpiresAt', e.target.value)} />
                  </F>
                </div>
                {form.passportExpiresAt && (
                  <div style={{ marginTop: 8, fontSize: 12, color: new Date(form.passportExpiresAt) < new Date(Date.now() + 90*24*60*60*1000) ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                    {new Date(form.passportExpiresAt) < new Date() ? text.passportExpired :
                     new Date(form.passportExpiresAt) < new Date(Date.now() + 90*24*60*60*1000) ? text.passportSoon :
                     text.passportValid}
                  </div>
                )}
              </div>

              <div className="card" data-collapse-key="client-physical" data-section-scope="client" data-section-key="client-physical">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👁</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{text.physicalTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cechy zewnętrzne do dokumentów</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label={text.height}>
                    <input className="input" type="number" value={form.height} onChange={e => set('height', e.target.value)} placeholder="175" />
                  </F>
                  <F label={text.eyeColor}>
                    <select className="select" value={form.eyeColor} onChange={e => set('eyeColor', e.target.value)}>
                      <option value="">{text.choose}</option>
                      {EYE_COLORS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </F>
                  <F label={text.specialSigns} col>
                    <textarea className="input" value={form.specialSigns} onChange={e => set('specialSigns', e.target.value)} rows={3} placeholder={text.specialSignsPlaceholder} />
                  </F>
                </div>
              </div>
            </div>

            <div className="card" data-collapse-key="client-origin-address" data-section-scope="client" data-section-key="client-origin-address" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏠</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{text.originAddressTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{text.originAddressSubtitle}</div>
                </div>
              </div>
              <F label={text.originAddressTitle} col>
                <textarea className="input" value={form.originCountryAddress} onChange={e => set('originCountryAddress', e.target.value)} rows={3} placeholder={text.addressPlaceholder} />
              </F>
            </div>

            <div className="card" data-collapse-key="client-previous-residence-address" data-section-scope="client" data-section-key="client-previous-residence-address" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌍</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{text.previousAddressTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{text.previousAddressSubtitle}</div>
                </div>
              </div>
              <F label={`${text.previousAddressTitle} (365+)`} col>
                <textarea className="input" value={form.previousResidenceAddress} onChange={e => set('previousResidenceAddress', e.target.value)} rows={3} placeholder={text.addressPlaceholder} />
              </F>
            </div>

            {/* ── ПРЕБЫВАНИЕ В ПОЛЬШЕ ── */}
            <div className="card" data-collapse-key="client-poland-stay" data-section-scope="client" data-section-key="client-poland-stay" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📍</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{text.polandStayTitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Adres, podstawa pobytu i karta pobytu</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label={text.addressInPoland} col>
                  <textarea className="input" value={form.addressInPoland} onChange={e => set('addressInPoland', e.target.value)} rows={2} placeholder="ul. Przykładowa 1/2, 00-000 Warszawa" />
                </F>
                <F label={text.legalTitle}>
                  <select className="select" value={form.legalTitle} onChange={e => { set('legalTitle', e.target.value); if (!e.target.value.includes('Wynajem')) set('rentalEndDate', '') }}>
                    <option value="">{text.choose}</option>
                    {LEGAL_TITLE.map(l => <option key={l}>{l}</option>)}
                  </select>
                </F>
                {form.legalTitle?.includes('Wynajem') && (
                  <F label={text.rentalEndDate}>
                    <input className="input" type="date" value={form.rentalEndDate} onChange={e => set('rentalEndDate', e.target.value)} />
                  </F>
                )}
                <F label={text.stayBasis}>
                  <select className="select" value={form.stayBasis} onChange={e => set('stayBasis', e.target.value)}>
                    <option value="">{text.choose}</option>
                    {STAY_BASIS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <F label={text.lastEntryDate}>
                  <input className="input" type="date" value={form.lastEntryDate} onChange={e => set('lastEntryDate', e.target.value)} />
                </F>

                {/* Карта побыту */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{text.residenceCard}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <div
                        onClick={() => { set('firstResidenceCard', !form.firstResidenceCard); if (!form.firstResidenceCard) set('residenceCardExpiry', '') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${form.firstResidenceCard ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.firstResidenceCard ? 'rgba(37,99,235,0.06)' : 'var(--bg)' }}
                      >
                        <input type="checkbox" checked={form.firstResidenceCard} onChange={() => {}} style={{ width: 17, height: 17, accentColor: 'var(--brand)' }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{text.firstResidenceCard}</span>
                      </div>
                    </div>
                    {!form.firstResidenceCard && (
                      <F label={text.residenceCardExpiry}>
                        <input className="input" type="date" value={form.residenceCardExpiry} onChange={e => set('residenceCardExpiry', e.target.value)} />
                      </F>
                    )}
                  </div>
                </div>

                {/* Штрафы */}
                <div style={{ gridColumn: '1/-1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{text.fines}</div>
                  <div
                    onClick={() => set('finesInPoland', !form.finesInPoland)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${form.finesInPoland ? '#dc2626' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: form.finesInPoland ? '#fef2f2' : 'var(--bg)' }}
                  >
                    <input type="checkbox" checked={form.finesInPoland} onChange={() => {}} style={{ width: 17, height: 17 }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{text.finesInPoland}</span>
                  </div>
                  {form.finesInPoland && (
                    <div style={{ marginTop: 10 }}>
                      <textarea className="input" value={form.finesDescription} onChange={e => set('finesDescription', e.target.value)} rows={2} placeholder={text.finesDescription} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ИСТОРИЯ ПУТЕШЕСТВИЙ ── */}
            <div className="card" data-collapse-key="client-travel-history" data-section-scope="client" data-section-key="client-travel-history">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{text.travelTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Wyjazdy zagraniczne i pobyty</div>
                  </div>
                </div>
                <button onClick={() => setShowAddTravel(v => !v)} className="btn btn-primary" style={{ fontSize: 13 }}>{text.add}</button>
              </div>

              {showAddTravel && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 14, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="label">{text.country}</label>
                      <input className="input" value={newTravel.country} onChange={e => setNewTravel(p => ({ ...p, country: e.target.value }))} placeholder="Украина" />
                    </div>
                    <div className="form-group">
                      <label className="label">{text.entryDate}</label>
                      <input className="input" type="date" value={newTravel.entryDate} onChange={e => setNewTravel(p => ({ ...p, entryDate: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="label">{text.exitDate}</label>
                      <input className="input" type="date" value={newTravel.exitDate} onChange={e => setNewTravel(p => ({ ...p, exitDate: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addTravel} className="btn btn-primary" disabled={!newTravel.country.trim()}>{text.add}</button>
                    <button onClick={() => setShowAddTravel(false)} className="btn btn-secondary">{text.cancel}</button>
                  </div>
                </div>
              )}

              {travelHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✈️</div>
                  <div style={{ fontSize: 13 }}>{text.noTravel}</div>
                  <button onClick={() => setShowAddTravel(true)} className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>{text.addFirstTravel}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {travelHistory.map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 18 }}>🌍</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.country}</span>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                          {t.entryDate && `${text.entry}: ${new Date(t.entryDate).toLocaleDateString(lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU')}`}
                          {t.entryDate && t.exitDate && ' → '}
                          {t.exitDate && `${text.exit}: ${new Date(t.exitDate).toLocaleDateString(lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU')}`}
                        </div>
                      </div>
                      <button onClick={() => removeTravel(t.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <CustomSectionsRenderer ref={customSectionsRef} scope="client" recordId={String(id)} standaloneSave={false} />

          </div>

          {/* ── БОКОВАЯ ПАНЕЛЬ ── */}
          <div>
            {/* Активные дела */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title"><span>⚡</span>{text.activeCases} ({activeCases.length})</div>
              {activeCases.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.noActiveCases}</div>
              ) : activeCases.map((c: any) => {
                const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {c.service && <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.service.color || '#3b82f6', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{c.service?.name || c.caseNumber}</span>
                        <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{c.caseNumber}</div>
                    </div>
                  </Link>
                )
              })}
              <Link href={`/cases/new?clientId=${client.id}`} className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }}>
                {text.newCase}
              </Link>
            </div>

            {/* Закрытые дела */}
            {closedCases.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title"><span>📁</span>{text.closedCases} ({closedCases.length})</div>
                {closedCases.map((c: any) => {
                  const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <Link key={c.id} href={`/cases/${c.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', opacity: 0.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, flex: 1, color: 'var(--text)' }}>{c.service?.name || c.caseNumber}</span>
                          <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>{c.status}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Инфо */}
            <div className="card">
              <div className="section-title"><span>ℹ️</span>{text.info}</div>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  [text.created, new Date(client.createdAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU')],
                  [text.updated, new Date(client.updatedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU')],
                  client.citizenship && [text.citizenship, client.citizenship],
                  client.branch && [text.department, client.branch],
                ].filter(Boolean).map(([label, value]: any) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
