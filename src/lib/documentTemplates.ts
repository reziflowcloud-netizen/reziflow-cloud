export const DOCUMENT_TEMPLATE_TYPES = [
  { type: 'client_contract', label: 'Договор с клиентом' },
  { type: 'power_of_attorney', label: 'Доверенность' },
] as const

export type DocumentTemplateType = typeof DOCUMENT_TEMPLATE_TYPES[number]['type']

export const DOCUMENT_TEMPLATE_VARIABLES = [
  '{{client.firstName}}',
  '{{client.lastName}}',
  '{{client.fullName}}',
  '{{client.phone}}',
  '{{client.email}}',
  '{{client.pesel}}',
  '{{client.birthDate}}',
  '{{client.birthPlace}}',
  '{{client.citizenship}}',
  '{{client.nationality}}',
  '{{client.addressInPoland}}',
  '{{client.passportSeries}}',
  '{{client.passportNumber}}',
  '{{case.caseNumber}}',
  '{{case.status}}',
  '{{case.totalValue}}',
  '{{case.totalPaid}}',
  '{{case.debt}}',
  '{{case.contractNumber}}',
  '{{case.contractDate}}',
  '{{case.filingDate}}',
  '{{case.stayType}}',
  '{{case.stayPurpose}}',
  '{{case.serviceName}}',
  '{{organization.name}}',
  '{{today}}',
]

export function getTemplateLabel(type: string) {
  return DOCUMENT_TEMPLATE_TYPES.find(item => item.type === type)?.label || type
}

function formatDate(value: unknown) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('pl-PL').format(new Date(value as string))
  } catch {
    return ''
  }
}

function formatMoney(value: unknown) {
  const number = Number(value || 0)
  return `${number.toFixed(2)} zł`
}

export function buildDocumentTemplateData(caseRecord: any) {
  const client = caseRecord.client || {}
  const organization = caseRecord.organization || {}
  const debt = Math.max(0, Number(caseRecord.totalValue || 0) - Number(caseRecord.totalPaid || 0))

  return {
    client: {
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      fullName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
      phone: client.phone || '',
      email: client.email || '',
      pesel: client.pesel || '',
      birthDate: formatDate(client.birthDate),
      birthPlace: client.birthPlace || '',
      citizenship: client.citizenship || '',
      nationality: client.nationality || '',
      addressInPoland: client.addressInPoland || '',
      passportSeries: client.passportSeries || '',
      passportNumber: client.passportNumber || '',
    },
    case: {
      caseNumber: caseRecord.caseNumber || '',
      status: caseRecord.status || '',
      totalValue: formatMoney(caseRecord.totalValue),
      totalPaid: formatMoney(caseRecord.totalPaid),
      debt: formatMoney(debt),
      contractNumber: caseRecord.contractNumber || '',
      contractDate: formatDate(caseRecord.contractDate),
      filingDate: formatDate(caseRecord.filingDate),
      stayType: caseRecord.stayType || '',
      stayPurpose: caseRecord.stayPurpose || '',
      serviceName: caseRecord.service?.name || '',
    },
    organization: {
      name: organization.name || '',
    },
    today: formatDate(new Date()),
  }
}

export function safeGeneratedFileName(parts: string[]) {
  return parts
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁąćęłńóśźżĄĆĘŁŃÓŚŹŻ._-]+/g, '_')
    .slice(0, 120)
}
