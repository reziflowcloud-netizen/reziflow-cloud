'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

type PreviewData = {
  headers: string[]
  rowCount: number
  previewRows: Record<string, string>[]
  columnMap: ImportColumnMap
}

type ImportColumnMap = {
  client: Record<string, string>
  case: Record<string, string>
  unknown: string[]
}

type ImportResult = {
  importedRows: number
  clientsCreated: number
  clientsReused: number
  casesCreated: number
  customFieldsCreatedOrUsed: number
  customValuesSaved: number
}

const clientLabels: Record<string, string> = {
  firstName: 'Имя',
  lastName: 'Фамилия',
  phone: 'Телефон',
  email: 'Email',
  pesel: 'PESEL',
  birthDate: 'Дата рождения',
  citizenship: 'Гражданство',
  addressInPoland: 'Адрес в Польше',
}

const caseLabels: Record<string, string> = {
  status: 'Статус дела',
  totalValue: 'Стоимость',
  totalPaid: 'Оплачено',
  notes: 'Заметки',
  filingDate: 'Дата подачи',
  contractDate: 'Дата договора',
}

Object.assign(clientLabels, {
  city: 'Город',
  previousFirstName: 'Предыдущее имя',
  previousLastName: 'Предыдущая фамилия',
  maidenName: 'Девичья фамилия',
  birthPlace: 'Место рождения',
  nationality: 'Национальность',
  maritalStatus: 'Семейное положение',
  education: 'Образование',
  fatherName: 'Имя отца',
  motherName: 'Имя матери',
  motherMaidenName: 'Девичья фамилия матери',
  passportSeries: 'Серия паспорта',
  passportNumber: 'Номер паспорта',
  passportIssuedBy: 'Паспорт выдан кем',
  passportIssuedAt: 'Дата выдачи паспорта',
  passportExpiresAt: 'Паспорт действует до',
  originCountryAddress: 'Адрес в стране происхождения',
  previousResidenceAddress: 'Предыдущий адрес проживания',
  legalTitle: 'Правовой титул на жилье',
  rentalEndDate: 'Конец аренды',
  stayBasis: 'Основание пребывания',
  lastEntryDate: 'Дата последнего въезда',
  residenceCardExpiry: 'Срок действия карты',
  finesInPoland: 'Штрафы в Польше',
  finesDescription: 'Описание штрафов',
  height: 'Рост',
  eyeColor: 'Цвет глаз',
  specialSigns: 'Особые приметы',
})

Object.assign(caseLabels, {
  caseNumber: 'Номер дела',
  service: 'Услуга',
  stayPurpose: 'Главная цель пребывания',
  stayType: 'Тип пребывания',
  trustee: 'Доверитель',
  personalAppearDate: 'Личная явка',
  legalStayDeadline: 'Срок легального пребывания',
  fingerprintsDate: 'Отпечатки пальцев',
  predictedDecisionDate: 'Ожидаемая дата решения',
  mosNumber: 'Номер MOS',
  mosSentAt: 'Дата передачи в MOS',
  cabinetLogin: 'Логин кабинета',
  cabinetPassword: 'Пароль кабинета',
  contractType: 'Тип договора',
  contractNumber: 'Номер договора',
  contractSigned: 'Договор подписан',
  workContractType: 'Тип занятости',
  workContractNumber: 'Номер договора работы',
  workContractDate: 'Дата договора работы',
  workContractEndDate: 'Дата окончания договора',
  workContractSigned: 'Договор работы подписан',
})

const clientFieldOrder = Object.keys(clientLabels)
const caseFieldOrder = Object.keys(caseLabels)

const exportText = {
  ru: {
    title: 'Экспорт и импорт данных',
    subtitle: 'CSV-файлы для переноса клиентов, дел и резервной копии LegalHub',
    error: 'Ошибка:',
    unknownError: 'Неизвестная ошибка',
    chooseFile: 'Выберите CSV-файл для импорта',
    readFailed: 'Не удалось прочитать файл',
    previewFirst: 'Сначала сделайте предпросмотр файла',
    importFailed: 'Не удалось импортировать файл',
    techError: 'Сервер вернул техническую ошибку: {message}',
    emptyResponse: 'Сервер вернул пустой ответ ({status})',
    importResult: 'Импортировано строк: {rows}. Клиентов создано: {created}, найдено существующих: {reused}, дел создано: {cases}. Дополнительных значений сохранено: {custom}.',
    importTitle: 'Импорт клиентов и дел из CSV',
    importHint: 'Сначала файл только проверяется. Распознанные колонки попадут в клиента и дело, а неизвестные колонки автоматически создадут поля в деле в секции',
    importedData: 'Импортированные данные',
    downloading: 'Скачиваю...',
    downloadTemplate: 'Скачать бланк CSV',
    checking: 'Проверяю...',
    preview: 'Предпросмотр',
    importing: 'Импортирую...',
    import: 'Импортировать',
    fileRows: 'Строк в файле',
    columns: 'Колонок',
    recognized: 'Распознано',
    extraFields: 'Доп. поля',
    clientCardTarget: 'Что попадет в карточку клиента',
    caseTarget: 'Что попадет в дело',
    notRecognized: 'Пока не распознано',
    manualMapping: 'Ручное сопоставление колонок',
    manualMappingHint: 'Если CRM распознала колонку неправильно, выберите нужный столбец вручную. Пустое значение означает, что поле не будет заполняться напрямую.',
    clientFields: 'Поля клиента',
    caseFields: 'Поля дела',
    doNotImport: '— Не импортировать —',
    unknownColumns: 'Неизвестные колонки',
    unknownColumnsHint: 'Эти колонки будут сохранены в деле как настраиваемые поля. Например,',
    willStay: 'не потеряется.',
    rowsNow: 'Сколько строк импортировать сейчас',
    testHint: 'Для теста лучше начать с 3-5 строк.',
    fullDb: 'Полная база данных',
    fullDbDesc: 'Один файл: клиенты, дела, оплаты и дополнительные поля.',
    preparing: 'Подготовка...',
    downloadAll: 'Скачать все',
    downloadSeparately: 'Или скачать отдельно:',
    onlyClients: 'Только клиенты',
    personalData: 'Личные данные',
    onlyCases: 'Только дела',
    casesAndSums: 'Дела и суммы',
    onlyPayments: 'Только оплаты',
    paymentHistory: 'История платежей',
    onlyLeads: 'Только лиды',
    leadsPipeline: 'Лиды и контакты',
    back: 'Назад',
  },
  uk: {
    title: 'Експорт та імпорт даних',
    subtitle: 'CSV-файли для перенесення клієнтів, справ і резервної копії LegalHub',
    error: 'Помилка:',
    unknownError: 'Невідома помилка',
    chooseFile: 'Виберіть CSV-файл для імпорту',
    readFailed: 'Не вдалося прочитати файл',
    previewFirst: 'Спочатку зробіть попередній перегляд файлу',
    importFailed: 'Не вдалося імпортувати файл',
    techError: 'Сервер повернув технічну помилку: {message}',
    emptyResponse: 'Сервер повернув порожню відповідь ({status})',
    importResult: 'Імпортовано рядків: {rows}. Клієнтів створено: {created}, знайдено наявних: {reused}, справ створено: {cases}. Додаткових значень збережено: {custom}.',
    importTitle: 'Імпорт клієнтів і справ із CSV',
    importHint: 'Спочатку файл тільки перевіряється. Розпізнані колонки потраплять у клієнта і справу, а невідомі колонки автоматично створять поля у справі в секції',
    importedData: 'Імпортовані дані',
    downloading: 'Завантажую...',
    downloadTemplate: 'Завантажити бланк CSV',
    checking: 'Перевіряю...',
    preview: 'Попередній перегляд',
    importing: 'Імпортую...',
    import: 'Імпортувати',
    fileRows: 'Рядків у файлі',
    columns: 'Колонок',
    recognized: 'Розпізнано',
    extraFields: 'Дод. поля',
    clientCardTarget: 'Що потрапить у картку клієнта',
    caseTarget: 'Що потрапить у справу',
    notRecognized: 'Поки не розпізнано',
    manualMapping: 'Ручне зіставлення колонок',
    manualMappingHint: 'Якщо CRM розпізнала колонку неправильно, виберіть потрібний стовпець вручну. Порожнє значення означає, що поле не буде заповнюватися напряму.',
    clientFields: 'Поля клієнта',
    caseFields: 'Поля справи',
    doNotImport: '— Не імпортувати —',
    unknownColumns: 'Невідомі колонки',
    unknownColumnsHint: 'Ці колонки будуть збережені у справі як налаштовувані поля. Наприклад,',
    willStay: 'не загубиться.',
    rowsNow: 'Скільки рядків імпортувати зараз',
    testHint: 'Для тесту краще почати з 3-5 рядків.',
    fullDb: 'Повна база даних',
    fullDbDesc: 'Один файл: клієнти, справи, оплати та додаткові поля.',
    preparing: 'Підготовка...',
    downloadAll: 'Завантажити все',
    downloadSeparately: 'Або завантажити окремо:',
    onlyClients: 'Тільки клієнти',
    personalData: 'Особисті дані',
    onlyCases: 'Тільки справи',
    casesAndSums: 'Справи і суми',
    onlyPayments: 'Тільки оплати',
    paymentHistory: 'Історія платежів',
    onlyLeads: 'Тільки ліди',
    leadsPipeline: 'Ліди та контакти',
    back: 'Назад',
  },
  pl: {
    title: 'Eksport i import danych',
    subtitle: 'Pliki CSV do migracji klientów, spraw i kopii zapasowej LegalHub',
    error: 'Błąd:',
    unknownError: 'Nieznany błąd',
    chooseFile: 'Wybierz plik CSV do importu',
    readFailed: 'Nie udało się odczytać pliku',
    previewFirst: 'Najpierw wykonaj podgląd pliku',
    importFailed: 'Nie udało się zaimportować pliku',
    techError: 'Serwer zwrócił błąd techniczny: {message}',
    emptyResponse: 'Serwer zwrócił pustą odpowiedź ({status})',
    importResult: 'Zaimportowano wierszy: {rows}. Utworzono klientów: {created}, znaleziono istniejących: {reused}, utworzono spraw: {cases}. Zapisano dodatkowych wartości: {custom}.',
    importTitle: 'Import klientów i spraw z CSV',
    importHint: 'Najpierw plik jest tylko sprawdzany. Rozpoznane kolumny trafią do klienta i sprawy, a nieznane kolumny automatycznie utworzą pola w sprawie w sekcji',
    importedData: 'Dane importowane',
    downloading: 'Pobieram...',
    downloadTemplate: 'Pobierz szablon CSV',
    checking: 'Sprawdzam...',
    preview: 'Podgląd',
    importing: 'Importuję...',
    import: 'Importuj',
    fileRows: 'Wierszy w pliku',
    columns: 'Kolumn',
    recognized: 'Rozpoznano',
    extraFields: 'Dodatkowe pola',
    clientCardTarget: 'Co trafi do karty klienta',
    caseTarget: 'Co trafi do sprawy',
    notRecognized: 'Jeszcze nie rozpoznano',
    manualMapping: 'Ręczne mapowanie kolumn',
    manualMappingHint: 'Jeśli CRM rozpoznała kolumnę nieprawidłowo, wybierz właściwą kolumnę ręcznie. Pusta wartość oznacza, że pole nie będzie uzupełniane bezpośrednio.',
    clientFields: 'Pola klienta',
    caseFields: 'Pola sprawy',
    doNotImport: '— Nie importować —',
    unknownColumns: 'Nieznane kolumny',
    unknownColumnsHint: 'Te kolumny zostaną zapisane w sprawie jako pola konfigurowalne. Na przykład',
    willStay: 'nie zginie.',
    rowsNow: 'Ile wierszy zaimportować teraz',
    testHint: 'Do testu najlepiej zacząć od 3-5 wierszy.',
    fullDb: 'Pełna baza danych',
    fullDbDesc: 'Jeden plik: klienci, sprawy, płatności i dodatkowe pola.',
    preparing: 'Przygotowanie...',
    downloadAll: 'Pobierz wszystko',
    downloadSeparately: 'Albo pobierz osobno:',
    onlyClients: 'Tylko klienci',
    personalData: 'Dane osobowe',
    onlyCases: 'Tylko sprawy',
    casesAndSums: 'Sprawy i kwoty',
    onlyPayments: 'Tylko płatności',
    paymentHistory: 'Historia płatności',
    onlyLeads: 'Tylko leady',
    leadsPipeline: 'Leady i kontakty',
    back: 'Wstecz',
  },
}

const fieldLabelOverrides: Record<'uk' | 'pl', { client: Record<string, string>; case: Record<string, string> }> = {
  uk: {
    client: {
      firstName: 'Ім’я', lastName: 'Прізвище', phone: 'Телефон', email: 'Email', pesel: 'PESEL',
      birthDate: 'Дата народження', citizenship: 'Громадянство', addressInPoland: 'Адреса в Польщі',
      city: 'Місто', previousFirstName: 'Попереднє ім’я', previousLastName: 'Попереднє прізвище',
      maidenName: 'Дівоче прізвище', birthPlace: 'Місце народження', nationality: 'Національність',
      maritalStatus: 'Сімейний стан', education: 'Освіта', fatherName: 'Ім’я батька', motherName: 'Ім’я матері',
      motherMaidenName: 'Дівоче прізвище матері', passportSeries: 'Серія паспорта', passportNumber: 'Номер паспорта',
      passportIssuedBy: 'Ким виданий паспорт', passportIssuedAt: 'Дата видачі паспорта', passportExpiresAt: 'Паспорт дійсний до',
      originCountryAddress: 'Адреса в країні походження', previousResidenceAddress: 'Попередня адреса проживання',
      legalTitle: 'Правовий титул на житло', rentalEndDate: 'Кінець оренди', stayBasis: 'Підстава перебування',
      lastEntryDate: 'Дата останнього в’їзду', residenceCardExpiry: 'Строк дії карти', finesInPoland: 'Штрафи в Польщі',
      finesDescription: 'Опис штрафів', height: 'Зріст', eyeColor: 'Колір очей', specialSigns: 'Особливі прикмети',
    },
    case: {
      status: 'Статус справи', totalValue: 'Вартість', totalPaid: 'Оплачено', notes: 'Нотатки',
      filingDate: 'Дата подачі', contractDate: 'Дата договору', caseNumber: 'Номер справи', service: 'Послуга',
      stayPurpose: 'Головна мета перебування', stayType: 'Тип перебування', trustee: 'Довіритель',
      personalAppearDate: 'Особиста явка', legalStayDeadline: 'Строк легального перебування',
      fingerprintsDate: 'Відбитки пальців', predictedDecisionDate: 'Очікувана дата рішення', mosNumber: 'Номер MOS',
      mosSentAt: 'Дата передачі в MOS', cabinetLogin: 'Логін кабінету', cabinetPassword: 'Пароль кабінету',
      contractType: 'Тип договору', contractNumber: 'Номер договору', contractSigned: 'Договір підписано',
      workContractType: 'Тип зайнятості', workContractNumber: 'Номер робочого договору',
      workContractDate: 'Дата робочого договору', workContractEndDate: 'Дата закінчення договору',
      workContractSigned: 'Робочий договір підписано',
    },
  },
  pl: {
    client: {
      firstName: 'Imię', lastName: 'Nazwisko', phone: 'Telefon', email: 'Email', pesel: 'PESEL',
      birthDate: 'Data urodzenia', citizenship: 'Obywatelstwo', addressInPoland: 'Adres w Polsce',
      city: 'Miasto', previousFirstName: 'Poprzednie imię', previousLastName: 'Poprzednie nazwisko',
      maidenName: 'Nazwisko panieńskie', birthPlace: 'Miejsce urodzenia', nationality: 'Narodowość',
      maritalStatus: 'Stan cywilny', education: 'Wykształcenie', fatherName: 'Imię ojca', motherName: 'Imię matki',
      motherMaidenName: 'Nazwisko panieńskie matki', passportSeries: 'Seria paszportu', passportNumber: 'Numer paszportu',
      passportIssuedBy: 'Paszport wydany przez', passportIssuedAt: 'Data wydania paszportu', passportExpiresAt: 'Paszport ważny do',
      originCountryAddress: 'Adres w kraju pochodzenia', previousResidenceAddress: 'Poprzedni adres zamieszkania',
      legalTitle: 'Tytuł prawny do lokalu', rentalEndDate: 'Koniec najmu', stayBasis: 'Podstawa pobytu',
      lastEntryDate: 'Data ostatniego wjazdu', residenceCardExpiry: 'Ważność karty pobytu', finesInPoland: 'Mandaty w Polsce',
      finesDescription: 'Opis mandatów', height: 'Wzrost', eyeColor: 'Kolor oczu', specialSigns: 'Znaki szczególne',
    },
    case: {
      status: 'Status sprawy', totalValue: 'Wartość', totalPaid: 'Opłacono', notes: 'Notatki',
      filingDate: 'Data złożenia', contractDate: 'Data umowy', caseNumber: 'Numer sprawy', service: 'Usługa',
      stayPurpose: 'Główny cel pobytu', stayType: 'Typ pobytu', trustee: 'Pełnomocnik',
      personalAppearDate: 'Stawiennictwo osobiste', legalStayDeadline: 'Termin legalnego pobytu',
      fingerprintsDate: 'Odciski palców', predictedDecisionDate: 'Przewidywana data decyzji', mosNumber: 'Numer MOS',
      mosSentAt: 'Data przekazania do MOS', cabinetLogin: 'Login do konta', cabinetPassword: 'Hasło do konta',
      contractType: 'Typ umowy', contractNumber: 'Numer umowy', contractSigned: 'Umowa podpisana',
      workContractType: 'Typ zatrudnienia', workContractNumber: 'Numer umowy pracy',
      workContractDate: 'Data umowy pracy', workContractEndDate: 'Data zakończenia umowy',
      workContractSigned: 'Umowa pracy podpisana',
    },
  },
}

function recalculateUnknown(headers: string[], columnMap: ImportColumnMap): string[] {
  const selected = new Set([
    ...Object.values(columnMap.client || {}),
    ...Object.values(columnMap.case || {}),
  ].filter(Boolean))
  return headers.filter(header => !selected.has(header))
}

async function readApiJson(res: Response, text: typeof exportText.ru) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()

  const responseText = await res.text()
  const message = responseText.trim()
  throw new Error(message
    ? text.techError.replace('{message}', message.slice(0, 220))
    : text.emptyResponse.replace('{status}', String(res.status)))
}

export default function ExportPage() {
  const { lang } = useLanguage()
  const text = exportText[lang] || exportText.ru
  const [loading, setLoading] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [limit, setLimit] = useState(5)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  async function doExport(type: string, filename: string) {
    setLoading(type)
    setLastError(null)
    try {
      const res = await fetch(`/api/export?type=${type}`)
      const contentType = res.headers.get('content-type') || ''

      if (!res.ok || contentType.includes('json')) {
        const data = await res.json()
        setLastError(data.details || data.error || text.unknownError)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  async function doPreview() {
    if (!file) {
      setLastError(text.chooseFile)
      return
    }
    setLoading('import-preview')
    setLastError(null)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await readApiJson(res, text)
      if (!res.ok) {
        setLastError(data.details || data.error || text.readFailed)
        return
      }
      setPreview(data)
      setLimit(Math.min(5, Math.max(1, data.rowCount || 1)))
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  async function doImport() {
    if (!file || !preview) {
      setLastError(text.previewFirst)
      return
    }
    setLoading('import-confirm')
    setLastError(null)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('confirm', 'true')
      formData.append('limit', String(limit))
      formData.append('columnMap', JSON.stringify({
        client: preview.columnMap.client,
        case: preview.columnMap.case,
      }))
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await readApiJson(res, text)
      if (!res.ok) {
        setLastError(data.details || data.error || text.importFailed)
        return
      }
      setImportResult(data)
    } catch (e: any) {
      setLastError(String(e))
    } finally {
      setLoading(null)
    }
  }

  const mappedClient = preview ? Object.entries(preview.columnMap.client) : []
  const mappedCase = preview ? Object.entries(preview.columnMap.case) : []
  const clientFieldLabel = (field: string) => fieldLabelOverrides[lang as 'uk' | 'pl']?.client[field] || clientLabels[field] || field
  const caseFieldLabel = (field: string) => fieldLabelOverrides[lang as 'uk' | 'pl']?.case[field] || caseLabels[field] || field

  function updateColumnMap(scope: 'client' | 'case', field: string, header: string) {
    setPreview(current => {
      if (!current) return current
      const nextMap: ImportColumnMap = {
        client: { ...current.columnMap.client },
        case: { ...current.columnMap.case },
        unknown: [],
      }

      if (header) nextMap[scope][field] = header
      else delete nextMap[scope][field]

      nextMap.unknown = recalculateUnknown(current.headers, nextMap)
      return { ...current, columnMap: nextMap }
    })
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
        {lastError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
            <strong>{text.error}</strong> {lastError}
          </div>
        )}

        {importResult && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#166534', fontSize: 13 }}>
            {text.importResult
              .replace('{rows}', String(importResult.importedRows))
              .replace('{created}', String(importResult.clientsCreated))
              .replace('{reused}', String(importResult.clientsReused))
              .replace('{cases}', String(importResult.casesCreated))
              .replace('{custom}', String(importResult.customValuesSaved))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--brand)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{text.importTitle}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 760 }}>
                {text.importHint} <strong>{text.importedData}</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => doExport('import-template', 'LegalHubCRM_import_template')}
                disabled={loading === 'import-template'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading === 'import-template' ? text.downloading : text.downloadTemplate}
              </button>
              <span style={{ fontSize: 28 }}>📥</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto auto', gap: 10, alignItems: 'center' }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={event => {
                setFile(event.target.files?.[0] || null)
                setPreview(null)
                setImportResult(null)
                setLastError(null)
              }}
            />
            <button className="btn btn-secondary" onClick={doPreview} disabled={loading === 'import-preview'}>
              {loading === 'import-preview' ? text.checking : text.preview}
            </button>
            <button className="btn btn-primary" onClick={doImport} disabled={!preview || loading === 'import-confirm'}>
              {loading === 'import-confirm' ? text.importing : text.import}
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{text.fileRows}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.rowCount}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{text.columns}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.headers.length}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{text.recognized}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{mappedClient.length + mappedCase.length}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{text.extraFields}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.columnMap.unknown.length}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.clientCardTarget}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mappedClient.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{text.notRecognized}</span>}
                    {mappedClient.map(([field, header]) => (
                      <span key={field} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>
                        {clientFieldLabel(field)}: <strong>{header}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.caseTarget}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mappedCase.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{text.notRecognized}</span>}
                    {mappedCase.map(([field, header]) => (
                      <span key={field} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>
                        {caseFieldLabel(field)}: <strong>{header}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 14, background: 'var(--surface)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{text.manualMapping}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  {text.manualMappingHint}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.clientFields}</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {clientFieldOrder.map(field => (
                        <label key={field} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'center', fontSize: 13 }}>
                          <span>{clientFieldLabel(field)}</span>
                          <select
                            className="select"
                            value={preview.columnMap.client[field] || ''}
                            onChange={event => updateColumnMap('client', field, event.target.value)}
                          >
                            <option value="">{text.doNotImport}</option>
                            {preview.headers.map(header => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.caseFields}</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {caseFieldOrder.map(field => (
                        <label key={field} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'center', fontSize: 13 }}>
                          <span>{caseFieldLabel(field)}</span>
                          <select
                            className="select"
                            value={preview.columnMap.case[field] || ''}
                            onChange={event => updateColumnMap('case', field, event.target.value)}
                          >
                            <option value="">{text.doNotImport}</option>
                            {preview.headers.map(header => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.unknownColumns}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                  {text.unknownColumnsHint} <strong>pracodawca</strong> {text.willStay}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preview.columnMap.unknown.slice(0, 80).map(header => (
                    <span key={header} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12 }}>{header}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>{text.rowsNow}</label>
                <input
                  type="number"
                  min={1}
                  max={preview.rowCount}
                  value={limit}
                  onChange={event => setLimit(Math.max(1, Math.min(preview.rowCount, Number(event.target.value) || 1)))}
                  style={{ width: 110 }}
                />
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{text.testHint}</span>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {preview.headers.slice(0, 10).map(header => (
                        <th key={header} style={{ textAlign: 'left', padding: 8, background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {preview.headers.slice(0, 10).map(header => (
                          <td key={header} style={{ padding: 8, borderBottom: '1px solid var(--border)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[header]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{text.fullDb}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                {text.fullDbDesc}
              </div>
            </div>
            <button onClick={() => doExport('all', 'LegalHubCRM_baza')}
              className="btn btn-primary" disabled={loading === 'all'}
              style={{ padding: '12px 24px', fontSize: 15, flexShrink: 0 }}>
              {loading === 'all' ? text.preparing : text.downloadAll}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontWeight: 500 }}>{text.downloadSeparately}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { id: 'clients', icon: '👥', title: text.onlyClients, desc: text.personalData, filename: 'LegalHubCRM_clients', color: '#eff6ff' },
            { id: 'cases', icon: '📋', title: text.onlyCases, desc: text.casesAndSums, filename: 'LegalHubCRM_cases', color: '#fef3c7' },
            { id: 'payments', icon: '💳', title: text.onlyPayments, desc: text.paymentHistory, filename: 'LegalHubCRM_payments', color: '#dcfce7' },
            { id: 'leads', icon: '🎯', title: text.onlyLeads, desc: text.leadsPipeline, filename: 'LegalHubCRM_leads', color: '#ede9fe' },
          ].map(exp => (
            <div key={exp.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: exp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{exp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{exp.desc}</div>
              </div>
              <button onClick={() => doExport(exp.id, exp.filename)} className="btn btn-secondary"
                disabled={loading === exp.id} style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}>
                {loading === exp.id ? '...' : 'CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
