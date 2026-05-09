// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function esc(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function toDate(val: any): string {
  if (!val) return ''
  try { return new Date(val).toLocaleDateString('ru') } catch { return '' }
}

function customHeader(scopeLabel: string, sectionTitle: string, fieldLabel: string): string {
  return `${scopeLabel}: ${sectionTitle} / ${fieldLabel}`
}

function canExportData(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canExportData(user)) {
      return NextResponse.json({ error: 'Export is available only to organization administrators' }, { status: 403 })
    }
    const organizationId = getOrganizationId(user)

    const type = request.nextUrl.searchParams.get('type') || 'all'

    if (type === 'import-template') {
      const headers = [
        'first name',
        'last name',
        'phone',
        'email',
        'pesel',
        'data urodzenia',
        'obywatelstwo',
        'adres w polsce',
        'status sprawy',
        'wartosc uslugi',
        'oplata',
        'notes',
        'filing date',
        'contract date',
        'employer',
        'position',
        'passport number',
        'import comment',
      ]
      const sample = [
        'Ivan',
        'Ivanov',
        '+48111222333',
        'ivan@example.com',
        '12345678901',
        '01.01.1990',
        'Ukraine',
        'Warszawa, ul. Przykladowa 1',
        'New',
        '2500',
        '500',
        'Sample row. Delete it before real import.',
        '15.05.2026',
        '10.05.2026',
        'Example Sp. z o.o.',
        'Pracownik',
        'AB123456',
        'Extra columns will be saved as custom case fields',
      ]
      const csv = '\uFEFF' + headers.map(esc).join(',') + '\n' + sample.map(esc).join(',') + '\n'

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="ReziFlowCloud_import_template.csv"',
        }
      })
    }

    if (type === 'all') {
      // Step 1: get all clients
      const clients = await prisma.client.findMany({ where: { organizationId }, orderBy: { lastName: 'asc' } })

      // Step 2: get all cases (simple, no nested includes)
      const allCases = await prisma.case.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })

      // Step 3: get all payments
      const allPayments = await prisma.payment.findMany({ where: { case: { organizationId } }, orderBy: { date: 'asc' } })

      // Step 4: get all users for assignedTo name
      const allUsers = await prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true } })
      const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]))

      const customSections = await prisma.customSection.findMany({
        where: { organizationId, active: true },
        include: {
          fields: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })
      const customValues = await prisma.customFieldValue.findMany({
        where: { organizationId },
        select: { fieldId: true, recordType: true, recordId: true, value: true },
      })
      const customValueMap = new Map(customValues.map(v => [`${v.recordType}:${v.recordId}:${v.fieldId}`, v.value || '']))
      const clientCustomFields = customSections
        .filter(section => section.scope === 'client')
        .flatMap(section => section.fields.map(field => ({ section, field })))
      const caseCustomFields = customSections
        .filter(section => section.scope === 'case')
        .flatMap(section => section.fields.map(field => ({ section, field })))
      const readCustomValues = (recordType: string, recordId: string, fields: any[]) => (
        fields.map(({ field }) => customValueMap.get(`${recordType}:${recordId}:${field.id}`) || '')
      )

      const headers = [
        'Фамилия', 'Имя', 'Телефон', 'Email', 'Город', 'PESEL',
        'Серия паспорта', 'Номер паспорта', 'Паспорт выдан', 'Дата выдачи', 'Действителен до',
        'Адрес в Польше', 'Основание пребывания',
        'Номер дела', 'Статус дела', 'Тип договора', 'Номер договора',
        'Договор подписан', 'Стоимость (zł)', 'Оплачено (zł)', 'Долг (zł)',
        'Номер MOS', 'Дата подачи в MOS', 'Логин кабинета', 'Пароль кабинета', 'Прийти на отпечатки пальцев', 'Przewidywana data wydania decyzji',
        'Дата подачи', 'Личная явка', 'Срок пребывания',
        'Ответственный',
        'Оплата 1 (дата)', 'Оплата 1 (zł)',
        'Оплата 2 (дата)', 'Оплата 2 (zł)',
        'Оплата 3 (дата)', 'Оплата 3 (zł)',
        'Оплата 4 (дата)', 'Оплата 4 (zł)',
        'Оплата 5 (дата)', 'Оплата 5 (zł)',
        ...clientCustomFields.map(({ section, field }) => customHeader('Client custom field', section.title, field.label)),
        ...caseCustomFields.map(({ section, field }) => customHeader('Case custom field', section.title, field.label)),
        'Клиент добавлен', 'Дело создано',
      ]

      let csv = '\uFEFF' + headers.join(',') + '\n'

      for (const client of clients) {
        const clientCases = allCases.filter(c => c.clientId === client.id)

        if (clientCases.length === 0) {
          const row = [
            client.lastName, client.firstName, client.phone, client.email, client.city, client.pesel,
            client.passportSeries, client.passportNumber, client.passportIssuedBy,
            toDate(client.passportIssuedAt), toDate(client.passportExpiresAt),
            client.addressInPoland, client.stayBasis,
            '', '', '', '', '', '', '', '',
            '', '', '', '', '', '', '', '', '', '',
            '', '', '', '', '', '', '', '', '', '',
            ...readCustomValues('client', client.id, clientCustomFields),
            ...caseCustomFields.map(() => ''),
            toDate(client.createdAt), '',
          ].map(esc).join(',')
          csv += row + '\n'
        } else {
          for (const c of clientCases) {
            const debt = Math.max(0, c.totalValue - c.totalPaid)
            const pays = allPayments.filter(p => p.caseId === c.id).slice(0, 5)
            const assignedName = c.assignedToId ? (userMap[c.assignedToId] || '') : ''

            const payFields: string[] = []
            for (let i = 0; i < 5; i++) {
              payFields.push(pays[i] ? toDate(pays[i].date) : '')
              payFields.push(pays[i] ? String(pays[i].amount.toFixed(2)) : '')
            }

            const row = [
              client.lastName, client.firstName, client.phone, client.email, client.city, client.pesel,
              client.passportSeries, client.passportNumber, client.passportIssuedBy,
              toDate(client.passportIssuedAt), toDate(client.passportExpiresAt),
              client.addressInPoland, client.stayBasis,
              c.caseNumber, c.status, c.contractType, c.contractNumber,
              c.contractSigned ? 'Да' : 'Нет',
              c.totalValue.toFixed(2), c.totalPaid.toFixed(2), debt.toFixed(2),
              c.mosNumber, toDate(c.mosSentAt), c.cabinetLogin, c.cabinetPassword, toDate(c.fingerprintsDate), toDate(c.predictedDecisionDate),
              toDate(c.filingDate), toDate(c.personalAppearDate), toDate(c.legalStayDeadline),
              assignedName,
              ...payFields,
              ...readCustomValues('client', client.id, clientCustomFields),
              ...readCustomValues('case', c.id, caseCustomFields),
              toDate(client.createdAt), toDate(c.createdAt),
            ].map(esc).join(',')
            csv += row + '\n'
          }
        }
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ReziFlowCloud_baza_${new Date().toISOString().slice(0,10)}.csv"`,
        }
      })
    }

    // --- Отдельные экспорты ---

    if (type === 'clients') {
      const clients = await prisma.client.findMany({ where: { organizationId }, orderBy: { lastName: 'asc' } })
      const headers = ['Фамилия','Имя','Телефон','Email','Город','PESEL','Адрес в Польше','Основание пребывания','Добавлен']
      let csv = '\uFEFF' + headers.join(',') + '\n'
      for (const c of clients) {
        csv += [c.lastName,c.firstName,c.phone,c.email,c.city,c.pesel,c.addressInPoland,c.stayBasis,toDate(c.createdAt)].map(esc).join(',') + '\n'
      }
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ReziFlowCloud_clients_${new Date().toISOString().slice(0,10)}.csv"`,
        }
      })
    }

    if (type === 'cases') {
      const cases = await prisma.case.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })
      const clients = await prisma.client.findMany({ where: { organizationId }, select: { id: true, firstName: true, lastName: true, phone: true } })
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
      const headers = ['Номер дела','Клиент','Телефон','Статус','Стоимость','Оплачено','Долг','Номер MOS','Дата подачи в MOS','Логин кабинета','Пароль кабинета','Прийти на отпечатки пальцев','Przewidywana data wydania decyzji','Создано']
      let csv = '\uFEFF' + headers.join(',') + '\n'
      for (const c of cases) {
        const cl = clientMap[c.clientId]
        const debt = Math.max(0, c.totalValue - c.totalPaid)
        csv += [
          c.caseNumber,
          cl ? `${cl.lastName} ${cl.firstName}` : '',
          cl?.phone || '',
          c.status,
          c.totalValue.toFixed(2),
          c.totalPaid.toFixed(2),
          debt.toFixed(2),
          c.mosNumber || '',
          toDate(c.mosSentAt),
          c.cabinetLogin || '',
          c.cabinetPassword || '',
          toDate(c.fingerprintsDate),
          toDate(c.predictedDecisionDate),
          toDate(c.createdAt)
        ].map(esc).join(',') + '\n'
      }
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ReziFlowCloud_cases_${new Date().toISOString().slice(0,10)}.csv"`,
        }
      })
    }

    if (type === 'payments') {
      const payments = await prisma.payment.findMany({ where: { case: { organizationId } }, orderBy: { date: 'desc' } })
      const cases = await prisma.case.findMany({ where: { organizationId }, select: { id: true, caseNumber: true, clientId: true } })
      const clients = await prisma.client.findMany({ where: { organizationId }, select: { id: true, firstName: true, lastName: true } })
      const caseMap = Object.fromEntries(cases.map(c => [c.id, c]))
      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
      const headers = ['Дата','Клиент','Номер дела','Сумма (zł)','Заметка']
      let csv = '\uFEFF' + headers.join(',') + '\n'
      for (const p of payments) {
        const c = caseMap[p.caseId]
        const cl = c ? clientMap[c.clientId] : null
        csv += [
          toDate(p.date),
          cl ? `${cl.lastName} ${cl.firstName}` : '',
          c?.caseNumber || '',
          p.amount.toFixed(2),
          p.note || ''
        ].map(esc).join(',') + '\n'
      }
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ReziFlowCloud_payments_${new Date().toISOString().slice(0,10)}.csv"`,
        }
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })

  } catch (e: any) {
    console.error('Export error details:', e?.message, e?.stack)
    return NextResponse.json({
      error: 'Ошибка экспорта',
      details: e?.message || String(e)
    }, { status: 500 })
  }
}
