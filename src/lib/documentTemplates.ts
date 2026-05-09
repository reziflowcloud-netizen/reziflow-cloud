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
  '{{case.totalValueNetto}}',
  '{{case.totalValueBrutto}}',
  '{{case.totalValueVat}}',
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
  '{{paymentPlan.count}}',
  '{{paymentPlan.totalAmount}}',
  '{{paymentPlan.totalAmountBrutto}}',
  '{{plannedPayment1.amount}}',
  '{{plannedPayment1.amountBrutto}}',
  '{{plannedPayment1.dueDate}}',
  '{{plannedPayment2.amount}}',
  '{{plannedPayment2.amountBrutto}}',
  '{{plannedPayment2.dueDate}}',
  '{{plannedPayment3.amount}}',
  '{{plannedPayment3.amountBrutto}}',
  '{{plannedPayment3.dueDate}}',
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

function formatPlainMoney(value: unknown) {
  const number = Number(value || 0)
  return number.toFixed(2)
}

function plannedPaymentData(payment?: any) {
  const amount = Number(payment?.amount || 0)
  return {
    amount: payment ? formatMoney(amount) : '',
    amountNetto: payment ? formatPlainMoney(amount) : '',
    amountBrutto: payment ? formatMoney(amount * 1.23) : '',
    dueDate: payment ? formatDate(payment.dueDate) : '',
    note: payment?.note || '',
  }
}

export function buildDocumentTemplateData(caseRecord: any, plannedPayments: any[] = []) {
  const client = caseRecord.client || {}
  const organization = caseRecord.organization || {}
  const debt = Math.max(0, Number(caseRecord.totalValue || 0) - Number(caseRecord.totalPaid || 0))
  const totalValue = Number(caseRecord.totalValue || 0)
  const plannedTotal = plannedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

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
      totalValue: formatMoney(totalValue),
      totalValueNetto: formatPlainMoney(totalValue),
      totalValueBrutto: formatMoney(totalValue * 1.23),
      totalValueVat: formatMoney(totalValue * 0.23),
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
    paymentPlan: {
      count: String(plannedPayments.length),
      totalAmount: formatMoney(plannedTotal),
      totalAmountBrutto: formatMoney(plannedTotal * 1.23),
    },
    plannedPayment1: plannedPaymentData(plannedPayments[0]),
    plannedPayment2: plannedPaymentData(plannedPayments[1]),
    plannedPayment3: plannedPaymentData(plannedPayments[2]),
    plannedPayment4: plannedPaymentData(plannedPayments[3]),
    plannedPayment5: plannedPaymentData(plannedPayments[4]),
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
