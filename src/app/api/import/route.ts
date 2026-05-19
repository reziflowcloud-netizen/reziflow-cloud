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
    let clientsCreated = 0
    let clientsReused = 0
    let casesCreated = 0
    let customValuesSaved = 0

    for (const row of rows) {
      const firstName = read(row, columnMap.client.firstName) || 'Без имени'
      const lastName = read(row, columnMap.client.lastName) || 'Без фамилии'
      const phone = read(row, columnMap.client.phone) || null
      const email = read(row, columnMap.client.email) || null

      const duplicateFilters = [
        email ? { email } : null,
        phone ? { phone } : null,
      ].filter(Boolean) as any[]

      let client = duplicateFilters.length > 0
        ? await prisma.client.findFirst({ where: { organizationId, OR: duplicateFilters } })
        : null

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
            pesel: read(row, columnMap.client.pesel) || null,
            birthDate: parseDate(read(row, columnMap.client.birthDate)),
            citizenship: read(row, columnMap.client.citizenship) || null,
            addressInPoland: read(row, columnMap.client.addressInPoland) || null,
          },
        })
        clientsCreated++
      }

      const importedStatus = read(row, columnMap.case.status)
      const status = await ensureCaseStatus(organizationId, importedStatus)
      const totalValue = parseMoney(read(row, columnMap.case.totalValue))
      const totalPaid = parseMoney(read(row, columnMap.case.totalPaid))

      const createdCase = await prisma.case.create({
        data: {
          organizationId,
          clientId: client.id,
          status,
          totalValue,
          totalPaid,
          notes: read(row, columnMap.case.notes) || null,
          filingDate: parseDate(read(row, columnMap.case.filingDate)),
          contractDate: parseDate(read(row, columnMap.case.contractDate)),
          contractSigned: Boolean(read(row, columnMap.case.contractDate)),
        },
      })
      casesCreated++

      await prisma.statusHistory.create({
        data: {
          caseId: createdCase.id,
          fromStatus: null,
          toStatus: status,
          changedBy: String(user?.name || user?.email || 'Import'),
        },
      })

      for (const [header, fieldId] of Array.from(customFieldIds.entries())) {
        const value = read(row, header)
        if (!value) continue
        await prisma.customFieldValue.upsert({
          where: {
            fieldId_recordType_recordId: {
              fieldId,
              recordType: 'case',
              recordId: createdCase.id,
            },
          },
          update: { value },
          create: {
            organizationId,
            fieldId,
            recordType: 'case',
            recordId: createdCase.id,
            value,
          },
        })
        customValuesSaved++
      }
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
