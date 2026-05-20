import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

type ColumnMap = {
  client: Record<string, string>
  case: Record<string, string>
  unknown: string[]
}

const clientColumnAliases: Record<string, string[]> = {
  firstName: ['імя', 'імʼя', 'імя', 'имя', 'name', 'first name', 'imię', 'imie'],
  lastName: ['прізвище', 'фамилия', 'surname', 'last name', 'nazwisko'],
  phone: ['контактний номер', 'телефон', 'phone', 'kontakt', 'numer telefonu', 'telefon'],
  email: ['e-mail', 'email', 'mail'],
  pesel: ['pesel'],
  birthDate: ['дата народження', 'дата рождения', 'data urodzenia'],
  citizenship: ['громадянство', 'гражданство', 'obywatelstwo'],
  addressInPoland: ['адрес в польше', 'адреса в польщі', 'adres w polsce'],
}

const caseColumnAliases: Record<string, string[]> = {
  status: ['status sprawy', 'статус дела', 'статус справи'],
  totalValue: ['вартість послуги', 'стоимость услуги', 'wartość usługi', 'wartosc uslugi'],
  totalPaid: ['передоплата', 'оплата', 'oplata', 'opłata', 'paid'],
  notes: ['нотатки', 'заметки', 'notes', 'notatki'],
  filingDate: ['дата подачи', 'дата подачі', 'data złożenia', 'data zlozenia'],
  contractDate: ['дата договора', 'дата договору', 'data umowy'],
}

Object.assign(clientColumnAliases, {
  city: ['city', 'miasto', 'город', 'місто'],
  previousFirstName: ['previous first name', 'poprzednie imie', 'poprzednie imię', 'предыдущее имя'],
  previousLastName: ['previous last name', 'poprzednie nazwisko', 'предыдущая фамилия'],
  maidenName: ['maiden name', 'nazwisko panienskie', 'nazwisko panieńskie', 'девичья фамилия'],
  birthPlace: ['miejsce urodzenia', 'birth place', 'место рождения'],
  nationality: ['narodowosc', 'narodowość', 'nationality', 'национальность'],
  maritalStatus: ['stan cywilny', 'marital status', 'семейное положение'],
  education: ['wyksztalcenie', 'wykształcenie', 'education', 'образование'],
  fatherName: ['imie ojca', 'imię ojca', 'father name', 'имя отца'],
  motherName: ['imie matki', 'imię matki', 'mother name', 'имя матери'],
  motherMaidenName: ['nazwisko panienskie matki', 'nazwisko panieńskie matki', 'mother maiden name', 'девичья фамилия матери'],
  passportSeries: ['passport series', 'seria paszportu', 'серия паспорта'],
  passportNumber: ['passport number', 'numer paszportu', 'номер паспорта', 'паспорт'],
  passportIssuedBy: ['passport issued by', 'wydany przez', 'выдан кем'],
  passportIssuedAt: ['passport issued at', 'data wydania paszportu', 'дата выдачи паспорта'],
  passportExpiresAt: ['passport expires at', 'wazny do', 'ważny do', 'действует до', 'срок паспорта'],
  originCountryAddress: ['adres w kraju pochodzenia', 'origin country address', 'адрес в стране происхождения'],
  previousResidenceAddress: ['previous residence address', 'poprzedni adres pobytu', 'предыдущий адрес проживания'],
  legalTitle: ['tytul prawny', 'tytuł prawny', 'legal title', 'правовой титул'],
  rentalEndDate: ['koniec najmu', 'rental end date', 'конец аренды'],
  stayBasis: ['podstawa pobytu', 'stay basis', 'основание пребывания'],
  lastEntryDate: ['data ostatniego wjazdu', 'last entry date', 'дата последнего въезда'],
  residenceCardExpiry: ['termin waznosci karty', 'termin ważności karty', 'residence card expiry', 'срок карты'],
  finesInPoland: ['mandaty', 'fines in poland', 'штрафы'],
  finesDescription: ['opis mandatow', 'opis mandatów', 'fines description', 'описание штрафов'],
  height: ['wzrost', 'height', 'рост'],
  eyeColor: ['kolor oczu', 'eye color', 'цвет глаз'],
  specialSigns: ['znaki szczegolne', 'znaki szczególne', 'special signs', 'особые приметы'],
})

Object.assign(caseColumnAliases, {
  caseNumber: ['numer sprawy', 'case number', 'номер дела'],
  service: ['usluga', 'usługa', 'service', 'услуга', 'послуги'],
  stayPurpose: ['cel pobytu', 'stay purpose', 'главная цель пребывания', 'тип пребывания'],
  stayType: ['typ pobytu', 'stay type', 'тип дела', 'тип разрешения'],
  trustee: ['pelnomocnik', 'pełnomocnik', 'trustee', 'доверитель', 'osoba upowazniona', 'osoba upoważniona'],
  personalAppearDate: ['osobiste stawiennictwo', 'личная явка', 'personal appear date'],
  legalStayDeadline: ['termin legalnego pobytu', 'legal stay deadline', 'срок легального пребывания'],
  fingerprintsDate: ['odciski palcow', 'odciski palców', 'fingerprints', 'отпечатки пальцев', 'прийти на отпечатки пальцев'],
  predictedDecisionDate: ['przewidywana data wydania decyzji', 'predicted decision date', 'ожидаемая дата решения'],
  mosNumber: ['mos', 'numer mos', 'mos number', 'номер mos'],
  mosSentAt: ['data przekazania w mos', 'mos sent at', 'дата передачи в mos'],
  cabinetLogin: ['login', 'логин', 'cabinet login'],
  cabinetPassword: ['haslo', 'hasło', 'password', 'пароль', 'cabinet password'],
  contractType: ['typ umowy', 'contract type', 'тип договора'],
  contractNumber: ['numer umowy', 'contract number', 'номер договора'],
  contractSigned: ['umowa podpisana', 'contract signed', 'договор подписан'],
  workContractType: ['typ zatrudnienia', 'work contract type', 'тип занятости'],
  workContractNumber: ['numer umowy pracy', 'work contract number'],
  workContractDate: ['data umowy pracy', 'work contract date'],
  workContractSigned: ['umowa pracy podpisana', 'work contract signed'],
})

function canImportData(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'owner'
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function normalizeHeader(value: string) {
  return stripBom(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’'`]/g, '')
}

function baseHeader(value: string) {
  return value.replace(/\s+\(\d+\)$/, '')
}

function makeUniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>()
  return headers.map(raw => {
    const clean = stripBom(raw).trim() || 'Без названия'
    const count = seen.get(clean) || 0
    seen.set(clean, count + 1)
    return count === 0 ? clean : `${clean} (${count + 1})`
  })
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || ''
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  return semicolonCount > commaCount ? ';' : ','
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text)
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = makeUniqueHeaders(parseCsvLine(lines[0], delimiter))
  const rows = lines.slice(1).map(line => {
    const cells = parseCsvLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() || ''
    })
    return row
  }).filter(row => Object.values(row).some(Boolean))

  return { headers, rows }
}

function findHeader(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader)
  const normalized = headers.map(header => ({ header, normalized: normalizeHeader(baseHeader(header)) }))
  return normalized.find(item => normalizedAliases.includes(item.normalized))?.header || ''
}

function buildColumnMap(headers: string[]): ColumnMap {
  const used = new Set<string>()
  const client: Record<string, string> = {}
  const caseMap: Record<string, string> = {}

  for (const [field, aliases] of Object.entries(clientColumnAliases)) {
    const header = findHeader(headers, aliases)
    if (header) {
      client[field] = header
      used.add(header)
    }
  }

  for (const [field, aliases] of Object.entries(caseColumnAliases)) {
    const header = findHeader(headers.filter(header => !used.has(header)), aliases)
    if (header) {
      caseMap[field] = header
      used.add(header)
    }
  }

  return {
    client,
    case: caseMap,
    unknown: headers.filter(header => !used.has(header)),
  }
}

function normalizeSubmittedColumnMap(value: FormDataEntryValue | null, headers: string[], fallback: ColumnMap): ColumnMap {
  if (typeof value !== 'string' || !value.trim()) return fallback

  const headerSet = new Set(headers)
  const allowedClientFields = new Set(Object.keys(clientColumnAliases))
  const allowedCaseFields = new Set(Object.keys(caseColumnAliases))
  const selected = new Set<string>()
  const client: Record<string, string> = {}
  const caseMap: Record<string, string> = {}

  try {
    const parsed = JSON.parse(value)
    const submittedClient = parsed?.client && typeof parsed.client === 'object' ? parsed.client : {}
    const submittedCase = parsed?.case && typeof parsed.case === 'object' ? parsed.case : {}

    for (const [field, header] of Object.entries(submittedClient)) {
      if (!allowedClientFields.has(field) || typeof header !== 'string' || !headerSet.has(header)) continue
      client[field] = header
      selected.add(header)
    }

    for (const [field, header] of Object.entries(submittedCase)) {
      if (!allowedCaseFields.has(field) || typeof header !== 'string' || !headerSet.has(header)) continue
      caseMap[field] = header
      selected.add(header)
    }

    return {
      client,
      case: caseMap,
      unknown: headers.filter(header => !selected.has(header)),
    }
  } catch {
    return fallback
  }
}

function read(row: Record<string, string>, header?: string) {
  return header ? (row[header] || '').trim() : ''
}

function parseDate(value: string) {
  const clean = value.trim()
  if (!clean) return null
  const dot = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (dot) {
    const year = dot[3].length === 2 ? `20${dot[3]}` : dot[3]
    const date = new Date(Number(year), Number(dot[2]) - 1, Number(dot[1]))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const iso = new Date(clean)
  return Number.isNaN(iso.getTime()) ? null : iso
}

function parseMoney(value: string) {
  const clean = value.replace(/\s/g, '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const number = Number(clean)
  return Number.isFinite(number) ? number : 0
}

function uniqueFilled(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function parseBoolean(value: string) {
  const clean = normalizeHeader(value)
  return ['1', 'true', 'yes', 'y', 'tak', 'да', 'так', 'x', '+'].includes(clean)
}

async function ensureService(organizationId: string, name: string) {
  const clean = name.trim()
  if (!clean) return null
  const existing = await prisma.service.findFirst({ where: { organizationId, name: clean } })
  if (existing) return existing
  return prisma.service.create({
    data: {
      organizationId,
      name: clean,
      description: null,
      price: 0,
      color: '#06b6d4',
      active: true,
    },
  })
}

function customFieldType(header: string, values: string[]) {
  const normalized = normalizeHeader(header)
  if (normalized.includes('data') || normalized.includes('дата') || normalized.includes('термін') || normalized.includes('termin')) {
    return 'date'
  }
  const filled = values.filter(Boolean)
  if (filled.length > 0 && filled.every(value => parseDate(value))) return 'date'
  if (filled.length > 0 && filled.every(value => value.length < 30 && /^-?[\d\s,.]+$/.test(value))) return 'number'
  return 'text'
}

async function ensureImportFields(organizationId: string, headers: string[], rows: Record<string, string>[]) {
  const usefulHeaders = headers.filter(header => rows.some(row => read(row, header)))
  if (usefulHeaders.length === 0) return new Map<string, number>()

  let section = await prisma.customSection.findFirst({
    where: { organizationId, scope: 'case', title: 'Импортированные данные' },
  })

  if (section) {
    section = await prisma.customSection.update({
      where: { id: section.id },
      data: { active: true },
    })
  } else {
    section = await prisma.customSection.create({
      data: {
        organizationId,
        scope: 'case',
        title: 'Импортированные данные',
        description: 'Поля, автоматически созданные при импорте CSV',
        sortOrder: 10000,
      },
    })
  }

  const existingFields = await prisma.customField.findMany({
    where: { sectionId: section.id },
  })
  const byLabel = new Map(existingFields.map(field => [normalizeHeader(field.label), field]))
  const result = new Map<string, number>()

  for (let index = 0; index < usefulHeaders.length; index++) {
    const header = usefulHeaders[index]
    const key = normalizeHeader(header)
    const existing = byLabel.get(key)
    if (existing) {
      result.set(header, existing.id)
      continue
    }

    const field = await prisma.customField.create({
      data: {
        sectionId: section.id,
        label: header,
        type: customFieldType(header, rows.map(row => read(row, header))),
        sortOrder: (existingFields.length + index + 1) * 10,
      },
    })
    result.set(header, field.id)
  }

  return result
}

async function defaultCaseStatus(organizationId: string) {
  const status = await prisma.caseStatus.findFirst({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
  return status?.name || 'Новый'
}

async function ensureCaseStatus(organizationId: string, name: string) {
  const clean = name.trim()
  if (!clean) return defaultCaseStatus(organizationId)
  const existing = await prisma.caseStatus.findFirst({ where: { organizationId, name: clean } })
  if (existing) return existing.name
  await prisma.caseStatus.create({
    data: {
      organizationId,
      name: clean,
      color: '#3b82f6',
      order: 999,
    },
  })
  return clean
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canImportData(user)) {
      return NextResponse.json({ error: 'Импорт доступен только администратору организации' }, { status: 403 })
    }

    const organizationId = getOrganizationId(user)
    const formData = await request.formData()
    const file = formData.get('file')
    const confirm = String(formData.get('confirm') || '') === 'true'
    const limit = Math.max(1, Math.min(10000, Number(formData.get('limit') || 5) || 5))

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Нужно выбрать CSV-файл' }, { status: 400 })
    }

    const parsed = parseCsv(await file.text())
    const autoColumnMap = buildColumnMap(parsed.headers)
    const previewRows = parsed.rows.slice(0, 5)

    if (!confirm) {
      return NextResponse.json({
        headers: parsed.headers,
        rowCount: parsed.rows.length,
        previewRows,
        columnMap: autoColumnMap,
      })
    }

    const columnMap = normalizeSubmittedColumnMap(formData.get('columnMap'), parsed.headers, autoColumnMap)
    const rows = parsed.rows.slice(0, limit)
    const customFieldIds = await ensureImportFields(organizationId, columnMap.unknown, rows)
    const fallbackStatus = await defaultCaseStatus(organizationId)
    const importedStatusNames = uniqueFilled(rows.map(row => read(row, columnMap.case.status)))
    const existingStatuses = importedStatusNames.length
      ? await prisma.caseStatus.findMany({ where: { organizationId, name: { in: importedStatusNames } } })
      : []
    const statusByName = new Map(existingStatuses.map(status => [status.name, status.name]))

    for (const name of importedStatusNames) {
      if (statusByName.has(name)) continue
      try {
        await prisma.caseStatus.create({
          data: {
            organizationId,
            name,
            color: '#3b82f6',
            order: 999,
          },
        })
      } catch {
        // The status may have been created by another import running at the same time.
      }
      statusByName.set(name, name)
    }

    const serviceNames = uniqueFilled(rows.map(row => read(row, columnMap.case.service)))
    const existingServices = serviceNames.length
      ? await prisma.service.findMany({ where: { organizationId, name: { in: serviceNames } } })
      : []
    const serviceByName = new Map(existingServices.map(service => [service.name, service]))

    for (const name of serviceNames) {
      if (serviceByName.has(name)) continue
      try {
        const service = await prisma.service.create({
          data: {
            organizationId,
            name,
            description: null,
            price: 0,
            color: '#06b6d4',
            active: true,
          },
        })
        serviceByName.set(name, service)
      } catch {
        const service = await prisma.service.findFirst({ where: { organizationId, name } })
        if (service) serviceByName.set(name, service)
      }
    }

    const emails = uniqueFilled(rows.map(row => read(row, columnMap.client.email)))
    const phones = uniqueFilled(rows.map(row => read(row, columnMap.client.phone)))
    const duplicateFilters = [
      emails.length ? { email: { in: emails } } : null,
      phones.length ? { phone: { in: phones } } : null,
    ].filter(Boolean) as any[]
    const existingClients = duplicateFilters.length
      ? await prisma.client.findMany({ where: { organizationId, OR: duplicateFilters } })
      : []
    const clientByEmail = new Map(existingClients.filter(client => client.email).map(client => [client.email as string, client]))
    const clientByPhone = new Map(existingClients.filter(client => client.phone).map(client => [client.phone as string, client]))
    const statusHistoryRows: any[] = []
    const customValueRows: any[] = []
    let clientsCreated = 0
    let clientsReused = 0
    let casesCreated = 0
    let customValuesSaved = 0

    for (const row of rows) {
      const firstName = read(row, columnMap.client.firstName) || 'Без имени'
      const lastName = read(row, columnMap.client.lastName) || 'Без фамилии'
      const phone = read(row, columnMap.client.phone) || null
      const email = read(row, columnMap.client.email) || null

      let client = email ? clientByEmail.get(email) : null
      if (!client && phone) client = clientByPhone.get(phone)

      if (client) {
        clientsReused++
      } else {
        client = await prisma.client.create({
          data: {
            organizationId,
            firstName,
            lastName,
            phone,
            email,
            city: read(row, columnMap.client.city) || null,
            pesel: read(row, columnMap.client.pesel) || null,
            previousFirstName: read(row, columnMap.client.previousFirstName) || null,
            previousLastName: read(row, columnMap.client.previousLastName) || null,
            maidenName: read(row, columnMap.client.maidenName) || null,
            birthDate: parseDate(read(row, columnMap.client.birthDate)),
            birthPlace: read(row, columnMap.client.birthPlace) || null,
            citizenship: read(row, columnMap.client.citizenship) || null,
            nationality: read(row, columnMap.client.nationality) || null,
            maritalStatus: read(row, columnMap.client.maritalStatus) || null,
            education: read(row, columnMap.client.education) || null,
            fatherName: read(row, columnMap.client.fatherName) || null,
            motherName: read(row, columnMap.client.motherName) || null,
            motherMaidenName: read(row, columnMap.client.motherMaidenName) || null,
            passportSeries: read(row, columnMap.client.passportSeries) || null,
            passportNumber: read(row, columnMap.client.passportNumber) || null,
            passportIssuedBy: read(row, columnMap.client.passportIssuedBy) || null,
            passportIssuedAt: parseDate(read(row, columnMap.client.passportIssuedAt)),
            passportExpiresAt: parseDate(read(row, columnMap.client.passportExpiresAt)),
            addressInPoland: read(row, columnMap.client.addressInPoland) || null,
            originCountryAddress: read(row, columnMap.client.originCountryAddress) || null,
            previousResidenceAddress: read(row, columnMap.client.previousResidenceAddress) || null,
            legalTitle: read(row, columnMap.client.legalTitle) || null,
            rentalEndDate: parseDate(read(row, columnMap.client.rentalEndDate)),
            stayBasis: read(row, columnMap.client.stayBasis) || null,
            lastEntryDate: parseDate(read(row, columnMap.client.lastEntryDate)),
            residenceCardExpiry: parseDate(read(row, columnMap.client.residenceCardExpiry)),
            finesInPoland: parseBoolean(read(row, columnMap.client.finesInPoland)),
            finesDescription: read(row, columnMap.client.finesDescription) || null,
            height: read(row, columnMap.client.height) || null,
            eyeColor: read(row, columnMap.client.eyeColor) || null,
            specialSigns: read(row, columnMap.client.specialSigns) || null,
          },
        })
        if (email) clientByEmail.set(email, client)
        if (phone) clientByPhone.set(phone, client)
        clientsCreated++
      }

      const importedStatus = read(row, columnMap.case.status)
      const status = importedStatus.trim() ? (statusByName.get(importedStatus.trim()) || importedStatus.trim()) : fallbackStatus
      const totalValue = parseMoney(read(row, columnMap.case.totalValue))
      const totalPaid = parseMoney(read(row, columnMap.case.totalPaid))
      const serviceName = read(row, columnMap.case.service)
      const service = serviceName ? serviceByName.get(serviceName) : null

      const createdCase = await prisma.case.create({
        data: {
          organizationId,
          clientId: client.id,
          caseNumber: read(row, columnMap.case.caseNumber) || null,
          status,
          serviceId: service?.id || null,
          stayPurpose: read(row, columnMap.case.stayPurpose) || null,
          stayType: read(row, columnMap.case.stayType) || null,
          trustee: read(row, columnMap.case.trustee) || null,
          totalValue,
          totalPaid,
          notes: read(row, columnMap.case.notes) || null,
          filingDate: parseDate(read(row, columnMap.case.filingDate)),
          personalAppearDate: parseDate(read(row, columnMap.case.personalAppearDate)),
          legalStayDeadline: parseDate(read(row, columnMap.case.legalStayDeadline)),
          fingerprintsDate: parseDate(read(row, columnMap.case.fingerprintsDate)),
          predictedDecisionDate: parseDate(read(row, columnMap.case.predictedDecisionDate)),
          mosNumber: read(row, columnMap.case.mosNumber) || null,
          mosSentAt: parseDate(read(row, columnMap.case.mosSentAt)),
          cabinetLogin: read(row, columnMap.case.cabinetLogin) || null,
          cabinetPassword: read(row, columnMap.case.cabinetPassword) || null,
          contractDate: parseDate(read(row, columnMap.case.contractDate)),
          contractType: read(row, columnMap.case.contractType) || null,
          contractNumber: read(row, columnMap.case.contractNumber) || null,
          contractSigned: read(row, columnMap.case.contractSigned) ? parseBoolean(read(row, columnMap.case.contractSigned)) : Boolean(read(row, columnMap.case.contractDate)),
          workContractType: read(row, columnMap.case.workContractType) || null,
          workContractNumber: read(row, columnMap.case.workContractNumber) || null,
          workContractDate: parseDate(read(row, columnMap.case.workContractDate)),
          workContractSigned: parseBoolean(read(row, columnMap.case.workContractSigned)),
        },
      })
      casesCreated++

      statusHistoryRows.push({
        caseId: createdCase.id,
        fromStatus: null,
        toStatus: status,
        changedBy: String(user?.name || user?.email || 'Import'),
      })

      for (const [header, fieldId] of Array.from(customFieldIds.entries())) {
        const value = read(row, header)
        if (!value) continue
        customValueRows.push({
          organizationId,
          fieldId,
          recordType: 'case',
          recordId: createdCase.id,
          value,
        })
      }
    }

    if (statusHistoryRows.length) {
      await prisma.statusHistory.createMany({ data: statusHistoryRows })
    }

    if (customValueRows.length) {
      const result = await prisma.customFieldValue.createMany({
        data: customValueRows,
        skipDuplicates: true,
      })
      customValuesSaved = result.count
    }

    return NextResponse.json({
      ok: true,
      importedRows: rows.length,
      clientsCreated,
      clientsReused,
      casesCreated,
      customFieldsCreatedOrUsed: customFieldIds.size,
      customValuesSaved,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed', details: error?.message || String(error) }, { status: 500 })
  }
}
