import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DEFAULT_LEAD_STATUSES } from '@/lib/leads'
import { normalizePhones, primaryPhone } from '@/lib/phones'
import { assertBillingLimit, billingLimitResponsePayload, isBillingLimitError } from '@/lib/billing'

export const dynamic = 'force-dynamic'

type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

type LeadColumnMap = {
  lead: Record<string, string>
  unknown: string[]
}

const leadColumnAliases: Record<string, string[]> = {
  fullName: ['fullName', 'full name', 'fullname', 'name', 'lead name', 'client name', 'fio', 'pib', 'имя фамилия', 'імя прізвище', 'лид', 'лід', 'lead'],
  firstName: ['firstName', 'first name', 'firstname', 'name first', 'имя', 'імя', "ім'я", 'imie', 'imię'],
  lastName: ['lastName', 'last name', 'lastname', 'surname', 'family name', 'фамилия', 'прізвище', 'nazwisko'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'tel', 'kontakt', 'telefon', 'numer telefonu', 'телефон', 'контактный номер', 'контактний номер', 'телефоны', 'телефони'],
  email: ['email', 'e-mail', 'mail', 'contact email', 'почта', 'пошта'],
  instagram: ['instagram', 'insta', 'ig', 'instagram username'],
  facebook: ['facebook', 'fb', 'facebook profile'],
  messengerId: ['messengerId', 'messenger id', 'psid', 'sender id', 'subscriber id'],
  city: ['city', 'miasto', 'город', 'місто'],
  voivodeship: ['voivodeship', 'wojewodztwo', 'województwo', 'region', 'province', 'воеводство', 'воєводство'],
  country: ['country', 'citizenship', 'obywatelstwo', 'kraj', 'страна', 'гражданство', 'країна', 'громадянство'],
  language: ['language', 'lang', 'język', 'jezyk', 'язык', 'мова'],
  serviceInterest: ['serviceInterest', 'service interest', 'service', 'usluga', 'usługa', 'interest', 'quiz result', 'product', 'услуга', 'послуга', 'интерес', 'інтерес', 'интерес / услуга'],
  budget: ['budget', 'budzet', 'budżet', 'бюджет'],
  urgency: ['urgency', 'temperature', 'pilnosc', 'pilność', 'срочность', 'терміновість'],
  status: ['status', 'lead status', 'статус', 'статус лида', 'статус ліда'],
  source: ['source', 'utm source', 'lead source', 'источник', 'джерело', 'źródło'],
  notes: ['notes', 'note', 'comment', 'message', 'question', 'opis', 'uwagi', 'комментарий', 'заметка', 'заметки', 'нотатки', 'повідомлення'],
  statusReason: ['status reason', 'причина статуса', 'причина статусу'],
  statusReasonComment: ['status reason comment', 'комментарий причины', 'коментар причини'],
  lastContactAt: ['lastContactAt', 'last contact', 'последний контакт', 'останній контакт'],
  lastContactNote: ['lastContactNote', 'last contact note', 'заметка последнего контакта', 'нотатка останнього контакту'],
  nextContactAt: ['nextContactAt', 'next contact', 'callback at', 'call at', 'дата контакта', 'следующий контакт', 'наступний контакт'],
  nextContactNote: ['nextContactNote', 'next contact note', 'callback note', 'contact note', 'о чем сконтактироваться', 'про що сконтактуватися'],
  deadlineAt: ['deadlineAt', 'deadline', 'legalization deadline', 'legalisation deadline', 'дедлайн', 'дата окончания легализации', 'дата закінчення легалізації'],
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

function buildColumnMap(headers: string[]): LeadColumnMap {
  const used = new Set<string>()
  const lead: Record<string, string> = {}

  for (const [field, aliases] of Object.entries(leadColumnAliases)) {
    const header = findHeader(headers.filter(item => !used.has(item)), aliases)
    if (header) {
      lead[field] = header
      used.add(header)
    }
  }

  return {
    lead,
    unknown: headers.filter(header => !used.has(header)),
  }
}

function normalizeSubmittedColumnMap(value: FormDataEntryValue | null, headers: string[], fallback: LeadColumnMap): LeadColumnMap {
  if (typeof value !== 'string' || !value.trim()) return fallback

  const headerSet = new Set(headers)
  const allowedLeadFields = new Set(Object.keys(leadColumnAliases))
  const selected = new Set<string>()
  const lead: Record<string, string> = {}

  try {
    const parsed = JSON.parse(value)
    const submittedLead = parsed?.lead && typeof parsed.lead === 'object' ? parsed.lead : {}

    for (const [field, header] of Object.entries(submittedLead)) {
      if (!allowedLeadFields.has(field) || typeof header !== 'string' || !headerSet.has(header)) continue
      lead[field] = header
      selected.add(header)
    }

    return {
      lead,
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

  const local = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?$/)
  if (local) {
    const year = local[3].length === 2 ? `20${local[3]}` : local[3]
    const date = new Date(
      Number(year),
      Number(local[2]) - 1,
      Number(local[1]),
      Number(local[4] || 0),
      Number(local[5] || 0),
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  const iso = new Date(clean)
  return Number.isNaN(iso.getTime()) ? null : iso
}

function leadName(lead: any) {
  return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || 'Лид'
}

async function createNextContactTask(lead: any, organizationId: string, assignedToId?: number | null) {
  if (!lead.nextContactAt) return
  const note = lead.nextContactNote || 'Следующий контакт'
  await prisma.task.create({
    data: {
      organizationId,
      title: `Следующий контакт: ${leadName(lead)}`,
      description: JSON.stringify({
        reminderAt: new Date(lead.nextContactAt).toISOString(),
        reminderNote: note,
        leadReminder: {
          leadId: lead.id,
          kind: 'nextContact',
          note,
        },
      }),
      priority: 'Нормально',
      dueDate: new Date(lead.nextContactAt),
      clientName: leadName(lead),
      assignedToId: assignedToId || lead.assignedToId || null,
    },
  })
}

async function defaultLeadStatus(organizationId: string) {
  let status = await (prisma as any).leadStatus.findFirst({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
  if (status) return status.name

  await (prisma as any).leadStatus.createMany({
    data: DEFAULT_LEAD_STATUSES.map(item => ({ ...item, organizationId })),
    skipDuplicates: true,
  })
  status = await (prisma as any).leadStatus.findFirst({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
  return status?.name || 'Новый'
}

async function ensureLeadStatus(organizationId: string, name: string, fallback: string) {
  const clean = name.trim()
  if (!clean) return { name: fallback, created: false }
  const existing = await (prisma as any).leadStatus.findFirst({ where: { organizationId, name: clean } })
  if (existing) return { name: existing.name, created: false }
  await (prisma as any).leadStatus.create({
    data: {
      organizationId,
      name: clean,
      color: '#2563eb',
      order: 999,
    },
  })
  return { name: clean, created: true }
}

function leadPayload(row: Record<string, string>, columnMap: LeadColumnMap, status: string) {
  const firstName = read(row, columnMap.lead.firstName)
  const lastName = read(row, columnMap.lead.lastName)
  const fullName = read(row, columnMap.lead.fullName) || `${firstName} ${lastName}`.trim()
  const phone = read(row, columnMap.lead.phone)
  const phones = normalizePhones([], phone)

  return {
    status,
    source: read(row, columnMap.lead.source) || 'manual',
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fullName || null,
    phone: primaryPhone(phones, phone),
    email: read(row, columnMap.lead.email) || null,
    instagram: read(row, columnMap.lead.instagram) || null,
    facebook: read(row, columnMap.lead.facebook) || null,
    messengerId: read(row, columnMap.lead.messengerId) || null,
    city: read(row, columnMap.lead.city) || null,
    voivodeship: read(row, columnMap.lead.voivodeship) || null,
    country: read(row, columnMap.lead.country) || null,
    language: read(row, columnMap.lead.language) || null,
    serviceInterest: read(row, columnMap.lead.serviceInterest) || null,
    budget: read(row, columnMap.lead.budget) || null,
    urgency: read(row, columnMap.lead.urgency) || null,
    statusReason: read(row, columnMap.lead.statusReason) || null,
    statusReasonComment: read(row, columnMap.lead.statusReasonComment) || null,
    notes: read(row, columnMap.lead.notes) || null,
    lastContactAt: parseDate(read(row, columnMap.lead.lastContactAt)),
    lastContactNote: read(row, columnMap.lead.lastContactNote) || null,
    nextContactAt: parseDate(read(row, columnMap.lead.nextContactAt)),
    nextContactNote: read(row, columnMap.lead.nextContactNote) || null,
    deadlineAt: parseDate(read(row, columnMap.lead.deadlineAt)),
    phones,
  }
}

function hasLeadIdentity(data: any) {
  return Boolean(data.fullName || data.firstName || data.lastName || data.phone || data.email || data.instagram || data.facebook)
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
    const fallbackStatus = await defaultLeadStatus(organizationId)

    const importedRows = []
    const duplicateKeys = new Set<string>()
    let skippedRows = 0
    let duplicatesSkipped = 0
    let emptyRows = 0
    let statusesCreated = 0

    const candidatePayloads = []
    for (const row of rows) {
      const statusResult = await ensureLeadStatus(organizationId, read(row, columnMap.lead.status), fallbackStatus)
      if (statusResult.created) statusesCreated++
      const data = leadPayload(row, columnMap, statusResult.name)
      if (!hasLeadIdentity(data)) {
        emptyRows++
        skippedRows++
        continue
      }
      candidatePayloads.push(data)
    }

    const phoneValues = Array.from(new Set(candidatePayloads.map(item => item.phone).filter(Boolean)))
    const emailValues = Array.from(new Set(candidatePayloads.map(item => item.email).filter(Boolean)))
    const existingWhere: any[] = []
    if (phoneValues.length) existingWhere.push({ phone: { in: phoneValues } })
    if (emailValues.length) existingWhere.push({ email: { in: emailValues } })
    const existingLeads = existingWhere.length
      ? await (prisma as any).lead.findMany({
          where: { organizationId, OR: existingWhere },
          select: { phone: true, email: true },
        })
      : []
    const existingKeys = new Set<string>()
    for (const lead of existingLeads) {
      if (lead.phone) existingKeys.add(`phone:${lead.phone}`)
      if (lead.email) existingKeys.add(`email:${lead.email}`)
    }

    const previewDuplicateKeys = new Set<string>()
    let leadsToCreate = 0
    for (const data of candidatePayloads) {
      const keys = [data.phone ? `phone:${data.phone}` : '', data.email ? `email:${data.email}` : ''].filter(Boolean)
      if (keys.some(key => existingKeys.has(key) || previewDuplicateKeys.has(key))) continue
      keys.forEach(key => previewDuplicateKeys.add(key))
      leadsToCreate++
    }

    await assertBillingLimit(organizationId, 'leads', leadsToCreate)

    for (const data of candidatePayloads) {
      const keys = [data.phone ? `phone:${data.phone}` : '', data.email ? `email:${data.email}` : ''].filter(Boolean)
      if (keys.some(key => existingKeys.has(key) || duplicateKeys.has(key))) {
        duplicatesSkipped++
        skippedRows++
        continue
      }

      const created = await (prisma as any).lead.create({
        data: {
          organizationId,
          status: data.status,
          source: data.source,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          instagram: data.instagram,
          facebook: data.facebook,
          messengerId: data.messengerId,
          city: data.city,
          voivodeship: data.voivodeship,
          country: data.country,
          language: data.language,
          serviceInterest: data.serviceInterest,
          budget: data.budget,
          urgency: data.urgency,
          statusReason: data.statusReason,
          statusReasonComment: data.statusReasonComment,
          notes: data.notes,
          lastContactAt: data.lastContactAt,
          lastContactNote: data.lastContactNote,
          nextContactAt: data.nextContactAt,
          nextContactNote: data.nextContactNote,
          deadlineAt: data.deadlineAt,
          phones: data.phones.length ? { create: data.phones.map((phone: any) => ({ organizationId, ...phone })) } : undefined,
        },
      })

      keys.forEach(key => duplicateKeys.add(key))
      importedRows.push(created)
      await createNextContactTask(created, organizationId, Number(user.id))
    }

    return NextResponse.json({
      importedRows: importedRows.length,
      skippedRows,
      duplicatesSkipped,
      emptyRows,
      statusesCreated,
    })
  } catch (error: any) {
    console.error('Lead import error:', error)
    if (isBillingLimitError(error)) {
      return NextResponse.json(billingLimitResponsePayload(error), { status: 402 })
    }
    return NextResponse.json({
      error: 'Ошибка импорта лидов',
      details: error?.message || String(error),
    }, { status: 500 })
  }
}
