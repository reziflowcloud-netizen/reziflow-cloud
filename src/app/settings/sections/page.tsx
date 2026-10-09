'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

type Scope = 'client' | 'case'

type SectionSetting = {
  scope: Scope
  sectionKey: string
  title: string
  description: string
  visible: boolean
  sortOrder: number
}

type CustomField = {
  id: number
  label: string
  type: string
  placeholder?: string | null
  options?: string[] | null
  required: boolean
  active: boolean
  sortOrder: number
}

type CustomSection = {
  id: number
  scope: Scope
  targetSectionKey?: string | null
  title: string
  description?: string | null
  active: boolean
  sortOrder: number
  fields: CustomField[]
}

type OrganizationSettings = {
  mosAutoRemindersEnabled: boolean
  mosEmailFieldEnabled: boolean
  tutorialVideosEnabled: boolean
  quickStartEnabled: boolean
}

const fieldTypeValues = ['text', 'email', 'textarea', 'date', 'number', 'checkbox', 'select'] as const

const pageText = {
  ru: {
    title: 'Поля и сектора',
    subtitle: 'Стандартные блоки и собственные поля для карточки клиента и дела',
    saveVisibility: 'Сохранить видимость',
    standardSaved: 'Настройки стандартных секций сохранены',
    standardSaveFailed: 'Не удалось сохранить настройки',
    autoSaved: 'Настройки автоматических напоминаний сохранены',
    autoSaveFailed: 'Не удалось сохранить настройки автоматических напоминаний',
    sectionAdded: 'Секция добавлена',
    sectionAddFailed: 'Не удалось добавить секцию',
    sectionSaved: 'Секция сохранена',
    sectionSaveFailed: 'Не удалось сохранить секцию',
    sectionDeleted: 'Секция удалена',
    sectionDeleteFailed: 'Не удалось удалить секцию',
    deleteSectionConfirm: 'Удалить секцию вместе с ее полями и заполненными значениями?',
    fieldAdded: 'Поле добавлено',
    fieldAddFailed: 'Не удалось добавить поле',
    fieldSaved: 'Поле сохранено',
    fieldSaveFailed: 'Не удалось сохранить поле',
    fieldDeleted: 'Поле удалено',
    fieldDeleteFailed: 'Не удалось удалить поле',
    deleteFieldConfirm: 'Удалить поле и все заполненные значения этого поля?',
    requiredShort: 'Обяз.',
    enabledShort: 'Вкл.',
    save: 'Сохранить',
    delete: 'Удалить',
    saveSection: 'Сохранить секцию',
    listOptionsPlaceholder: 'Варианты списка, каждый с новой строки',
    noCustomSections: 'Пользовательских секций пока нет.',
    sectionDescriptionPlaceholder: 'Описание секции',
    fieldNamePlaceholder: 'Название поля',
    fieldOptionsPlaceholder: 'Для списка: варианты с новой строки',
    accessAdminTitle: 'Доступ только для администратора фирмы',
    accessAdminDesc: 'Сотрудник может заполнять данные, но не может менять структуру секций и полей.',
    autoRemindersTitle: 'Автоматические напоминания',
    mosAutoRemindersTitle: 'Автоматические напоминания с момента передачи документов в MOS',
    mosAutoRemindersDesc: 'Если включено, при сохранении дела с датой передачи в MOS автоматически создаются 4 напоминания: донести документы, получить ID, запросить логин и пароль от кабинета, проверить статус.',
    mosFieldsTitle: 'Дополнительные поля MOS',
    mosEmailFieldTitle: 'Показывать поле «Адрес E-mail MOS»',
    mosEmailFieldDesc: 'Поле появится в секторе «MOS и корреспонденция» во всех делах этой организации.',
    mosFieldsSaved: 'Настройки полей MOS сохранены',
    mosFieldsSaveFailed: 'Не удалось сохранить настройки полей MOS',
    tutorialVideosTitle: 'Обучение и быстрый старт',
    tutorialVideosToggleTitle: 'Показывать кнопки обучающих видео в разделах CRM',
    tutorialVideosDesc: 'Если включено, в рабочих разделах меню появятся кнопки с видео-инструкциями. Раздел настроек пока без видео.',
    quickStartToggleTitle: 'Показывать блок "Быстрый старт" на Dashboard',
    quickStartDesc: 'Если включено, администратор фирмы видит первые шаги настройки CRM на главной странице.',
    tutorialVideosSaved: 'Настройки обучения сохранены',
    tutorialVideosSaveFailed: 'Не удалось сохранить настройки обучения',
    addCustomSection: 'Добавить свои поля',
    clientCard: 'Карточка клиента',
    caseCard: 'Дело клиента',
    sectionNamePlaceholder: 'Название секции',
    shortDescriptionPlaceholder: 'Короткое описание',
    addSection: '+ Секция',
    customSections: 'Свои секции и поля',
    standardSections: 'Стандартные секции',
    placementLabel: 'Расположение',
    standalonePlacement: 'Отдельная секция',
    placementHint: 'Можно показать группу полей отдельной секцией или внутри выбранного стандартного сектора.',
    saving: 'Сохранение...',
    loading: 'Загрузка...',
    addField: '+ Поле',
    fieldTypes: {
      text: 'Текст',
      email: 'E-mail',
      textarea: 'Большое поле',
      date: 'Дата',
      number: 'Число',
      checkbox: 'Чекбокс',
      select: 'Список выбора',
    },
    standardSectionText: {
      'client-personal': { title: 'Данные личные', description: 'Основная информация о клиенте' },
      'client-status-family': { title: 'Статус и семья', description: 'Гражданство, семейное положение и данные семьи' },
      'client-passport': { title: 'Паспортные данные', description: 'Серия, номер и срок действия паспорта' },
      'client-physical': { title: 'Физические признаки', description: 'Рост, цвет глаз и особые приметы' },
      'client-origin-address': { title: 'Адрес в стране происхождения', description: 'Адрес проживания до переезда' },
      'client-previous-residence-address': { title: 'Адрес предыдущего проживания', description: 'При проживании 365 дней и больше' },
      'client-poland-stay': { title: 'Пребывание в Польше', description: 'Адрес, основание пребывания и карта побыта' },
      'client-travel-history': { title: 'История путешествий', description: 'Выезды за границу и пребывание' },
      'client-previous-poland-stays': { title: 'Предыдущие пребывания в Польше', description: 'Дата въезда, выезда и основание пребывания' },
      'case-basic': { title: 'Основные данные', description: 'Статус, услуга, стоимость и ответственные' },
      'case-main-goal': { title: 'Главная цель пребывания', description: 'Тип и основание пребывания' },
      'case-work-contract': { title: 'Договор с работодателем', description: 'Данные договора с работодателем' },
      'case-agency-contract': { title: 'Договор с нашим агентством', description: 'Тип, номер, дата и подпись договора' },
      'case-mos': { title: 'MOS и корреспонденция', description: 'MOS, ID, документы и напоминания' },
      'case-important-dates': { title: 'Важные даты', description: 'Подача, явка и дополнительные даты' },
      'case-doc-updates': { title: 'Актуализация документации', description: 'История обновления документов' },
      'case-notes': { title: 'Заметки', description: 'Дополнительная информация по делу' },
    },
  },
  uk: {
    title: 'Поля і сектори',
    subtitle: 'Стандартні блоки та власні поля для картки клієнта і справи',
    saveVisibility: 'Зберегти видимість',
    standardSaved: 'Налаштування стандартних секцій збережено',
    standardSaveFailed: 'Не вдалося зберегти налаштування',
    autoSaved: 'Налаштування автоматичних нагадувань збережено',
    autoSaveFailed: 'Не вдалося зберегти налаштування автоматичних нагадувань',
    sectionAdded: 'Секцію додано',
    sectionAddFailed: 'Не вдалося додати секцію',
    sectionSaved: 'Секцію збережено',
    sectionSaveFailed: 'Не вдалося зберегти секцію',
    sectionDeleted: 'Секцію видалено',
    sectionDeleteFailed: 'Не вдалося видалити секцію',
    deleteSectionConfirm: 'Видалити секцію разом з її полями та заповненими значеннями?',
    fieldAdded: 'Поле додано',
    fieldAddFailed: 'Не вдалося додати поле',
    fieldSaved: 'Поле збережено',
    fieldSaveFailed: 'Не вдалося зберегти поле',
    fieldDeleted: 'Поле видалено',
    fieldDeleteFailed: 'Не вдалося видалити поле',
    deleteFieldConfirm: 'Видалити поле і всі заповнені значення цього поля?',
    requiredShort: 'Обов.',
    enabledShort: 'Увімк.',
    save: 'Зберегти',
    delete: 'Видалити',
    saveSection: 'Зберегти секцію',
    listOptionsPlaceholder: 'Варіанти списку, кожен з нового рядка',
    noCustomSections: 'Користувацьких секцій поки немає.',
    sectionDescriptionPlaceholder: 'Опис секції',
    fieldNamePlaceholder: 'Назва поля',
    fieldOptionsPlaceholder: 'Для списку: варіанти з нового рядка',
    accessAdminTitle: 'Доступ тільки для адміністратора фірми',
    accessAdminDesc: 'Співробітник може заповнювати дані, але не може змінювати структуру секцій і полів.',
    autoRemindersTitle: 'Автоматичні нагадування',
    mosAutoRemindersTitle: 'Автоматичні нагадування з моменту передачі документів у MOS',
    mosAutoRemindersDesc: 'Якщо увімкнено, під час збереження справи з датою передачі в MOS автоматично створюються 4 нагадування: донести документи, отримати ID, запросити логін і пароль від кабінету, перевірити статус.',
    mosFieldsTitle: 'Додаткові поля MOS',
    mosEmailFieldTitle: 'Показувати поле «Адреса E-mail MOS»',
    mosEmailFieldDesc: 'Поле зʼявиться в секторі «MOS і кореспонденція» у всіх справах цієї організації.',
    mosFieldsSaved: 'Налаштування полів MOS збережено',
    mosFieldsSaveFailed: 'Не вдалося зберегти налаштування полів MOS',
    tutorialVideosTitle: 'Навчання і швидкий старт',
    tutorialVideosToggleTitle: 'Показувати кнопки навчальних відео в розділах CRM',
    tutorialVideosDesc: 'Якщо увімкнено, у робочих розділах меню зʼявляться кнопки з відео-інструкціями. Розділ налаштувань поки без відео.',
    quickStartToggleTitle: 'Показувати блок "Швидкий старт" на Dashboard',
    quickStartDesc: 'Якщо увімкнено, адміністратор фірми бачить перші кроки налаштування CRM на головній сторінці.',
    tutorialVideosSaved: 'Налаштування навчання збережено',
    tutorialVideosSaveFailed: 'Не вдалося зберегти налаштування навчання',
    addCustomSection: 'Додати власні поля',
    clientCard: 'Картка клієнта',
    caseCard: 'Справа клієнта',
    sectionNamePlaceholder: 'Назва секції',
    shortDescriptionPlaceholder: 'Короткий опис',
    addSection: '+ Секція',
    customSections: 'Власні секції та поля',
    standardSections: 'Стандартні секції',
    placementLabel: 'Розташування',
    standalonePlacement: 'Окрема секція',
    placementHint: 'Групу полів можна показати окремою секцією або всередині вибраного стандартного сектора.',
    saving: 'Збереження...',
    loading: 'Завантаження...',
    addField: '+ Поле',
    fieldTypes: {
      text: 'Текст',
      email: 'E-mail',
      textarea: 'Велике поле',
      date: 'Дата',
      number: 'Число',
      checkbox: 'Чекбокс',
      select: 'Список вибору',
    },
    standardSectionText: {
      'client-personal': { title: 'Особисті дані', description: 'Основна інформація про клієнта' },
      'client-status-family': { title: 'Статус і сім’я', description: 'Громадянство, сімейний стан і дані сім’ї' },
      'client-passport': { title: 'Паспортні дані', description: 'Серія, номер і строк дії паспорта' },
      'client-physical': { title: 'Фізичні ознаки', description: 'Зріст, колір очей та особливі прикмети' },
      'client-origin-address': { title: 'Адреса в країні походження', description: 'Адреса проживання до переїзду' },
      'client-previous-residence-address': { title: 'Адреса попереднього проживання', description: 'При проживанні 365 днів і більше' },
      'client-poland-stay': { title: 'Перебування в Польщі', description: 'Адреса, підстава перебування і карта побиту' },
      'client-travel-history': { title: 'Історія подорожей', description: 'Виїзди за кордон і перебування' },
      'client-previous-poland-stays': { title: 'Попередні перебування в Польщі', description: 'Дата в’їзду, виїзду і підстава перебування' },
      'case-basic': { title: 'Основні дані', description: 'Статус, послуга, вартість і відповідальні' },
      'case-main-goal': { title: 'Головна мета перебування', description: 'Тип і підстава перебування' },
      'case-work-contract': { title: 'Договір з роботодавцем', description: 'Дані договору з роботодавцем' },
      'case-agency-contract': { title: 'Договір з нашим агентством', description: 'Тип, номер, дата і підпис договору' },
      'case-mos': { title: 'MOS і кореспонденція', description: 'MOS, ID, документи і нагадування' },
      'case-important-dates': { title: 'Важливі дати', description: 'Подача, явка і додаткові дати' },
      'case-doc-updates': { title: 'Актуалізація документації', description: 'Історія оновлення документів' },
      'case-notes': { title: 'Нотатки', description: 'Додаткова інформація по справі' },
    },
  },
  pl: {
    title: 'Pola i sektory',
    subtitle: 'Standardowe bloki i własne pola dla karty klienta i sprawy',
    saveVisibility: 'Zapisz widoczność',
    standardSaved: 'Ustawienia standardowych sekcji zapisane',
    standardSaveFailed: 'Nie udało się zapisać ustawień',
    autoSaved: 'Ustawienia automatycznych przypomnień zapisane',
    autoSaveFailed: 'Nie udało się zapisać ustawień automatycznych przypomnień',
    sectionAdded: 'Sekcja dodana',
    sectionAddFailed: 'Nie udało się dodać sekcji',
    sectionSaved: 'Sekcja zapisana',
    sectionSaveFailed: 'Nie udało się zapisać sekcji',
    sectionDeleted: 'Sekcja usunięta',
    sectionDeleteFailed: 'Nie udało się usunąć sekcji',
    deleteSectionConfirm: 'Usunąć sekcję razem z jej polami i wypełnionymi wartościami?',
    fieldAdded: 'Pole dodane',
    fieldAddFailed: 'Nie udało się dodać pola',
    fieldSaved: 'Pole zapisane',
    fieldSaveFailed: 'Nie udało się zapisać pola',
    fieldDeleted: 'Pole usunięte',
    fieldDeleteFailed: 'Nie udało się usunąć pola',
    deleteFieldConfirm: 'Usunąć pole i wszystkie wypełnione wartości tego pola?',
    requiredShort: 'Wym.',
    enabledShort: 'Wł.',
    save: 'Zapisz',
    delete: 'Usuń',
    saveSection: 'Zapisz sekcję',
    listOptionsPlaceholder: 'Opcje listy, każda od nowej linii',
    noCustomSections: 'Nie ma jeszcze własnych sekcji.',
    sectionDescriptionPlaceholder: 'Opis sekcji',
    fieldNamePlaceholder: 'Nazwa pola',
    fieldOptionsPlaceholder: 'Dla listy: opcje od nowej linii',
    accessAdminTitle: 'Dostęp tylko dla administratora firmy',
    accessAdminDesc: 'Pracownik może uzupełniać dane, ale nie może zmieniać struktury sekcji i pól.',
    autoRemindersTitle: 'Automatyczne przypomnienia',
    mosAutoRemindersTitle: 'Automatyczne przypomnienia od momentu przekazania dokumentów do MOS',
    mosAutoRemindersDesc: 'Jeśli włączone, przy zapisie sprawy z datą przekazania do MOS automatycznie powstaną 4 przypomnienia: donieść dokumenty, otrzymać ID, poprosić o login i hasło do konta, sprawdzić status.',
    mosFieldsTitle: 'Dodatkowe pola MOS',
    mosEmailFieldTitle: 'Pokazuj pole „Adres e-mail MOS”',
    mosEmailFieldDesc: 'Pole pojawi się w sekcji „MOS i korespondencja” we wszystkich sprawach tej organizacji.',
    mosFieldsSaved: 'Ustawienia pól MOS zapisane',
    mosFieldsSaveFailed: 'Nie udało się zapisać ustawień pól MOS',
    tutorialVideosTitle: 'Szkolenie i szybki start',
    tutorialVideosToggleTitle: 'Pokazuj przyciski filmów szkoleniowych w sekcjach CRM',
    tutorialVideosDesc: 'Jeśli włączone, w roboczych sekcjach menu pojawią się przyciski z instrukcjami wideo. Sekcja ustawień na razie bez filmu.',
    quickStartToggleTitle: 'Pokazuj blok "Szybki start" na Dashboard',
    quickStartDesc: 'Jeśli włączone, administrator firmy widzi pierwsze kroki konfiguracji CRM na stronie głównej.',
    tutorialVideosSaved: 'Ustawienia szkolenia zapisane',
    tutorialVideosSaveFailed: 'Nie udało się zapisać ustawień szkolenia',
    addCustomSection: 'Dodaj własne pola',
    clientCard: 'Karta klienta',
    caseCard: 'Sprawa klienta',
    sectionNamePlaceholder: 'Nazwa sekcji',
    shortDescriptionPlaceholder: 'Krótki opis',
    addSection: '+ Sekcja',
    customSections: 'Własne sekcje i pola',
    standardSections: 'Standardowe sekcje',
    placementLabel: 'Umiejscowienie',
    standalonePlacement: 'Osobna sekcja',
    placementHint: 'Grupę pól można wyświetlić jako osobną sekcję lub wewnątrz wybranej standardowej sekcji.',
    saving: 'Zapisywanie...',
    loading: 'Ładowanie...',
    addField: '+ Pole',
    fieldTypes: {
      text: 'Tekst',
      email: 'E-mail',
      textarea: 'Duże pole',
      date: 'Data',
      number: 'Liczba',
      checkbox: 'Checkbox',
      select: 'Lista wyboru',
    },
    standardSectionText: {
      'client-personal': { title: 'Dane osobowe', description: 'Podstawowe informacje o kliencie' },
      'client-status-family': { title: 'Status i rodzina', description: 'Obywatelstwo, stan cywilny i dane rodziny' },
      'client-passport': { title: 'Dane paszportowe', description: 'Seria, numer i ważność paszportu' },
      'client-physical': { title: 'Cechy fizyczne', description: 'Wzrost, kolor oczu i znaki szczególne' },
      'client-origin-address': { title: 'Adres w kraju pochodzenia', description: 'Adres zamieszkania przed przeprowadzką' },
      'client-previous-residence-address': { title: 'Adres poprzedniego pobytu', description: 'Przy pobycie 365 dni i dłużej' },
      'client-poland-stay': { title: 'Pobyt w Polsce', description: 'Adres, podstawa pobytu i karta pobytu' },
      'client-travel-history': { title: 'Historia podróży', description: 'Wyjazdy za granicę i pobyty' },
      'client-previous-poland-stays': { title: 'Poprzednie pobyty w Polsce', description: 'Data wjazdu, wyjazdu i podstawa pobytu' },
      'case-basic': { title: 'Dane podstawowe', description: 'Status, usługa, koszt i odpowiedzialni' },
      'case-main-goal': { title: 'Główny cel pobytu', description: 'Typ i podstawa pobytu' },
      'case-work-contract': { title: 'Umowa z pracodawcą', description: 'Dane umowy z pracodawcą' },
      'case-agency-contract': { title: 'Umowa z naszym biurem', description: 'Typ, numer, data i podpis umowy' },
      'case-mos': { title: 'MOS i korespondencja', description: 'MOS, ID, dokumenty i przypomnienia' },
      'case-important-dates': { title: 'Ważne daty', description: 'Złożenie, wizyta i dodatkowe daty' },
      'case-doc-updates': { title: 'Aktualizacja dokumentacji', description: 'Historia aktualizacji dokumentów' },
      'case-notes': { title: 'Notatki', description: 'Dodatkowe informacje o sprawie' },
    },
  },
}

function optionsToText(options: unknown) {
  return Array.isArray(options) ? options.map(String).join('\n') : ''
}

export default function SectionSettingsPage() {
  const { lang, t } = useLanguage()
  const text = pageText[lang] || pageText.ru
  const [settings, setSettings] = useState<SectionSetting[]>([])
  const [sections, setSections] = useState<CustomSection[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingOrganizationSettings, setSavingOrganizationSettings] = useState(false)
  const [message, setMessage] = useState('')
  const [newSection, setNewSection] = useState({
    scope: 'client' as Scope,
    targetSectionKey: '',
    title: '',
    description: '',
  })
  const [newFields, setNewFields] = useState<Record<number, any>>({})
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings>({
    mosAutoRemindersEnabled: true,
    mosEmailFieldEnabled: false,
    tutorialVideosEnabled: false,
    quickStartEnabled: true,
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [uiRes, customRes, organizationRes] = await Promise.all([
      fetch('/api/ui-section-settings', { cache: 'no-store' }),
      fetch('/api/custom-sections', { cache: 'no-store' }),
      fetch('/api/organization-settings', { cache: 'no-store' }),
    ])
    const ui = await uiRes.json()
    const custom = await customRes.json()
    const organization = await organizationRes.json()
    setSettings(ui.settings || [])
    setSections(custom.sections || [])
    setOrganizationSettings({
      mosAutoRemindersEnabled: organization?.settings?.mosAutoRemindersEnabled !== false,
      mosEmailFieldEnabled: organization?.settings?.mosEmailFieldEnabled === true,
      tutorialVideosEnabled: organization?.settings?.tutorialVideosEnabled === true,
      quickStartEnabled: organization?.settings?.quickStartEnabled !== false,
    })
    setCanManage(Boolean(ui.canManage || custom.canManage || organization.canManage))
    setLoading(false)
  }

  const grouped = useMemo(() => ({
    client: settings.filter(item => item.scope === 'client'),
    case: settings.filter(item => item.scope === 'case'),
  }), [settings])

  const customGrouped = useMemo(() => ({
    client: sections.filter(item => item.scope === 'client'),
    case: sections.filter(item => item.scope === 'case'),
  }), [sections])

  function toggle(scope: Scope, sectionKey: string) {
    setSettings(current => current.map(item => (
      item.scope === scope && item.sectionKey === sectionKey
        ? { ...item, visible: !item.visible }
        : item
    )))
    setMessage('')
  }

  async function saveStandard() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/ui-section-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    setSaving(false)
    setMessage(res.ok ? text.standardSaved : text.standardSaveFailed)
  }

  async function saveOrganizationSettings(
    nextSettings = organizationSettings,
    successMessage = text.autoSaved,
    failureMessage = text.autoSaveFailed,
  ) {
    setSavingOrganizationSettings(true)
    setMessage('')
    const res = await fetch('/api/organization-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: nextSettings }),
    })
    setSavingOrganizationSettings(false)
    if (res.ok) {
      const data = await res.json()
      setOrganizationSettings({
        mosAutoRemindersEnabled: data?.settings?.mosAutoRemindersEnabled !== false,
        mosEmailFieldEnabled: data?.settings?.mosEmailFieldEnabled === true,
        tutorialVideosEnabled: data?.settings?.tutorialVideosEnabled === true,
        quickStartEnabled: data?.settings?.quickStartEnabled !== false,
      })
      setMessage(successMessage)
    } else {
      setMessage(failureMessage)
    }
  }

  async function createSection() {
    if (!newSection.title.trim()) return
    const res = await fetch('/api/custom-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSection),
    })
    if (res.ok) {
      setNewSection({ scope: 'client', targetSectionKey: '', title: '', description: '' })
      setMessage(text.sectionAdded)
      await loadAll()
    } else {
      setMessage(text.sectionAddFailed)
    }
  }

  async function updateSection(section: CustomSection) {
    const res = await fetch(`/api/custom-sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section),
    })
    setMessage(res.ok ? text.sectionSaved : text.sectionSaveFailed)
    if (res.ok) await loadAll()
  }

  async function deleteSection(id: number) {
    if (!confirm(text.deleteSectionConfirm)) return
    const res = await fetch(`/api/custom-sections/${id}`, { method: 'DELETE' })
    setMessage(res.ok ? text.sectionDeleted : text.sectionDeleteFailed)
    if (res.ok) await loadAll()
  }

  async function createField(sectionId: number) {
    const draft = newFields[sectionId] || {}
    if (!String(draft.label || '').trim()) return
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, ...draft }),
    })
    if (res.ok) {
      setNewFields(current => ({ ...current, [sectionId]: {} }))
      setMessage(text.fieldAdded)
      await loadAll()
    } else {
      setMessage(text.fieldAddFailed)
    }
  }

  async function updateField(field: CustomField) {
    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
    setMessage(res.ok ? text.fieldSaved : text.fieldSaveFailed)
    if (res.ok) await loadAll()
  }

  async function deleteField(id: number) {
    if (!confirm(text.deleteFieldConfirm)) return
    const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setMessage(res.ok ? text.fieldDeleted : text.fieldDeleteFailed)
    if (res.ok) await loadAll()
  }

  function patchSection(id: number, patch: Partial<CustomSection>) {
    setSections(current => current.map(section => section.id === id ? { ...section, ...patch } : section))
  }

  function patchField(sectionId: number, fieldId: number, patch: Partial<CustomField>) {
    setSections(current => current.map(section => section.id !== sectionId ? section : {
      ...section,
      fields: section.fields.map(field => field.id === fieldId ? { ...field, ...patch } : field),
    }))
  }

  function standardLabel(item: SectionSetting) {
    return text.standardSectionText[item.sectionKey as keyof typeof text.standardSectionText] || {
      title: item.title,
      description: item.description,
    }
  }

  function placementOptions(scope: Scope) {
    return (
      <>
        <option value="">{text.standalonePlacement}</option>
        {grouped[scope].map(item => {
          const label = standardLabel(item)
          return <option key={item.sectionKey} value={item.sectionKey}>{label.title}</option>
        })}
      </>
    )
  }

  function renderStandardGroup(title: string, items: SectionSetting[]) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 14 }}><span>▦</span>{title}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(item => {
            const label = standardLabel(item)
            return (
              <label key={`${item.scope}:${item.sectionKey}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: item.visible ? 'var(--card)' : 'var(--bg)' }}>
                <span>
                  <strong style={{ display: 'block', marginBottom: 3 }}>{label.title}</strong>
                  <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13 }}>{label.description}</span>
                </span>
                <input type="checkbox" checked={item.visible} disabled={!canManage} onChange={() => toggle(item.scope, item.sectionKey)} style={{ width: 20, height: 20 }} />
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  function renderFieldEditor(section: CustomSection, field: CustomField) {
    return (
      <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 150px 100px 90px 90px auto auto', gap: 8, alignItems: 'start', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
        <input className="input" value={field.label} disabled={!canManage} onChange={e => patchField(section.id, field.id, { label: e.target.value })} />
        <select className="input" value={field.type} disabled={!canManage} onChange={e => patchField(section.id, field.id, { type: e.target.value })}>
          {fieldTypeValues.map(type => <option key={type} value={type}>{text.fieldTypes[type]}</option>)}
        </select>
        <input className="input" type="number" value={field.sortOrder} disabled={!canManage} onChange={e => patchField(section.id, field.id, { sortOrder: Number(e.target.value) })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <input type="checkbox" checked={field.required} disabled={!canManage} onChange={e => patchField(section.id, field.id, { required: e.target.checked })} />
          {text.requiredShort}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <input type="checkbox" checked={field.active} disabled={!canManage} onChange={e => patchField(section.id, field.id, { active: e.target.checked })} />
          {text.enabledShort}
        </label>
        <button className="btn btn-light" disabled={!canManage} onClick={() => updateField(field)}>{text.save}</button>
        <button className="btn btn-danger" disabled={!canManage} onClick={() => deleteField(field.id)}>{text.delete}</button>
        {field.type === 'select' && (
          <textarea
            className="input"
            style={{ gridColumn: '1 / -1', minHeight: 70 }}
            placeholder={text.listOptionsPlaceholder}
            value={optionsToText(field.options)}
            disabled={!canManage}
            onChange={e => patchField(section.id, field.id, { options: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
          />
        )}
      </div>
    )
  }

  function renderCustomGroup(title: string, items: CustomSection[]) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 14 }}><span>▣</span>{title}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>{text.noCustomSections}</div>}
          {items.map(section => {
            const draft = newFields[section.id] || {}
            return (
              <div key={section.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(240px, 1fr)', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 13 }}>{text.placementLabel}</strong>
                  <select
                    className="input"
                    disabled={!canManage}
                    value={section.targetSectionKey || ''}
                    onChange={e => patchSection(section.id, { targetSectionKey: e.target.value || null })}
                  >
                    {placementOptions(section.scope)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 90px 90px auto auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input className="input" value={section.title} disabled={!canManage} onChange={e => patchSection(section.id, { title: e.target.value })} />
                  <input className="input" value={section.description || ''} disabled={!canManage} placeholder={text.sectionDescriptionPlaceholder} onChange={e => patchSection(section.id, { description: e.target.value })} />
                  <input className="input" type="number" value={section.sortOrder} disabled={!canManage} onChange={e => patchSection(section.id, { sortOrder: Number(e.target.value) })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={section.active} disabled={!canManage} onChange={e => patchSection(section.id, { active: e.target.checked })} />
                    {text.enabledShort}
                  </label>
                  <button className="btn btn-light" disabled={!canManage} onClick={() => updateSection(section)}>{text.saveSection}</button>
                  <button className="btn btn-danger" disabled={!canManage} onClick={() => deleteSection(section.id)}>{text.delete}</button>
                </div>
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {section.fields.map(field => renderFieldEditor(section, field))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 150px 1fr auto', gap: 8, alignItems: 'start' }}>
                  <input className="input" placeholder={text.fieldNamePlaceholder} disabled={!canManage} value={draft.label || ''} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, label: e.target.value } }))} />
                  <select className="input" disabled={!canManage} value={draft.type || 'text'} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, type: e.target.value } }))}>
                    {fieldTypeValues.map(type => <option key={type} value={type}>{text.fieldTypes[type]}</option>)}
                  </select>
                  <textarea className="input" style={{ minHeight: 38 }} placeholder={text.fieldOptionsPlaceholder} disabled={!canManage || (draft.type || 'text') !== 'select'} value={draft.options || ''} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, options: e.target.value } }))} />
                  <button className="btn btn-primary" disabled={!canManage} onClick={() => createField(section.id)}>{text.addField}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{text.title}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" href="/settings">{t('back')}</Link>
          {canManage && <button className="btn btn-primary" onClick={saveStandard} disabled={saving}>{saving ? text.saving : text.saveVisibility}</button>}
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 1120 }}>
        {message && <div className="card" style={{ marginBottom: 16 }}>{message}</div>}
        {!canManage && !loading && (
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>{text.accessAdminTitle}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>{text.accessAdminDesc}</div>
          </div>
        )}
        {loading ? (
          <div className="card">{text.loading}</div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>
                <span>🔔</span>{text.autoRemindersTitle}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={organizationSettings.mosAutoRemindersEnabled}
                    disabled={!canManage}
                    onChange={e => {
                      setOrganizationSettings(current => ({
                        ...current,
                        mosAutoRemindersEnabled: e.target.checked,
                      }))
                      setMessage('')
                    }}
                    style={{ width: 20, height: 20, marginTop: 2 }}
                  />
                  <span>
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      {text.mosAutoRemindersTitle}
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                      {text.mosAutoRemindersDesc}
                    </span>
                  </span>
                </label>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingOrganizationSettings}
                    onClick={() => saveOrganizationSettings()}
                  >
                    {savingOrganizationSettings ? text.saving : text.save}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>
                <span>✉</span>{text.mosFieldsTitle}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={organizationSettings.mosEmailFieldEnabled}
                    disabled={!canManage}
                    onChange={e => {
                      setOrganizationSettings(current => ({
                        ...current,
                        mosEmailFieldEnabled: e.target.checked,
                      }))
                      setMessage('')
                    }}
                    style={{ width: 20, height: 20, marginTop: 2 }}
                  />
                  <span>
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      {text.mosEmailFieldTitle}
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                      {text.mosEmailFieldDesc}
                    </span>
                  </span>
                </label>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingOrganizationSettings}
                    onClick={() => saveOrganizationSettings(
                      organizationSettings,
                      text.mosFieldsSaved,
                      text.mosFieldsSaveFailed,
                    )}
                  >
                    {savingOrganizationSettings ? text.saving : text.save}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>
                <span>▶</span>{text.tutorialVideosTitle}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={organizationSettings.tutorialVideosEnabled}
                    disabled={!canManage}
                    onChange={e => {
                      setOrganizationSettings(current => ({
                        ...current,
                        tutorialVideosEnabled: e.target.checked,
                      }))
                      setMessage('')
                    }}
                    style={{ width: 20, height: 20, marginTop: 2 }}
                  />
                  <span>
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      {text.tutorialVideosToggleTitle}
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                      {text.tutorialVideosDesc}
                    </span>
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={organizationSettings.quickStartEnabled}
                    disabled={!canManage}
                    onChange={e => {
                      setOrganizationSettings(current => ({
                        ...current,
                        quickStartEnabled: e.target.checked,
                      }))
                      setMessage('')
                    }}
                    style={{ width: 20, height: 20, marginTop: 2 }}
                  />
                  <span>
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      {text.quickStartToggleTitle}
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                      {text.quickStartDesc}
                    </span>
                  </span>
                </label>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingOrganizationSettings}
                    style={{ gridColumn: '2', gridRow: '1 / span 2' }}
                    onClick={() => saveOrganizationSettings(
                      organizationSettings,
                      text.tutorialVideosSaved,
                      text.tutorialVideosSaveFailed,
                    )}
                  >
                    {savingOrganizationSettings ? text.saving : text.save}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}><span>＋</span>{text.addCustomSection}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>{text.placementHint}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.3fr) auto', gap: 10 }}>
                <select
                  className="input"
                  disabled={!canManage}
                  value={newSection.scope}
                  onChange={e => setNewSection(current => ({
                    ...current,
                    scope: e.target.value as Scope,
                    targetSectionKey: '',
                  }))}
                >
                  <option value="client">{text.clientCard}</option>
                  <option value="case">{text.caseCard}</option>
                </select>
                <select className="input" disabled={!canManage} value={newSection.targetSectionKey} onChange={e => setNewSection(current => ({ ...current, targetSectionKey: e.target.value }))}>
                  {placementOptions(newSection.scope)}
                </select>
                <input className="input" disabled={!canManage} placeholder={text.sectionNamePlaceholder} value={newSection.title} onChange={e => setNewSection(current => ({ ...current, title: e.target.value }))} />
                <input className="input" disabled={!canManage} placeholder={text.shortDescriptionPlaceholder} value={newSection.description} onChange={e => setNewSection(current => ({ ...current, description: e.target.value }))} />
                <button className="btn btn-primary" disabled={!canManage || !newSection.title.trim()} onClick={createSection}>{text.addSection}</button>
              </div>
            </div>

            <h3 style={{ margin: '8px 0 12px' }}>{text.customSections}</h3>
            {renderCustomGroup(text.clientCard, customGrouped.client)}
            {renderCustomGroup(text.caseCard, customGrouped.case)}

            <h3 style={{ margin: '22px 0 12px' }}>{text.standardSections}</h3>
            {renderStandardGroup(text.clientCard, grouped.client)}
            {renderStandardGroup(text.caseCard, grouped.case)}
          </>
        )}
      </div>
    </div>
  )
}
