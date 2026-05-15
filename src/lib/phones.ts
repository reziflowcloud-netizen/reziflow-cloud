export type ContactPhoneInput = {
  id?: string
  phone?: string
  label?: string | null
  note?: string | null
  isPrimary?: boolean
  whatsapp?: boolean
  telegram?: boolean
  viber?: boolean
}

export const EMPTY_PHONE: ContactPhoneInput = {
  phone: '',
  label: '',
  note: '',
  isPrimary: true,
  whatsapp: false,
  telegram: false,
  viber: false,
}

export function normalizePhones(input: any, fallbackPhone?: string | null) {
  const raw = Array.isArray(input) ? input : []
  const phones = raw
    .map((item: any) => ({
      phone: String(item?.phone || '').trim(),
      label: String(item?.label || '').trim() || null,
      note: String(item?.note || '').trim() || null,
      isPrimary: Boolean(item?.isPrimary),
      whatsapp: Boolean(item?.whatsapp),
      telegram: Boolean(item?.telegram),
      viber: Boolean(item?.viber),
    }))
    .filter(item => item.phone)

  if (!phones.length && fallbackPhone) {
    phones.push({
      phone: String(fallbackPhone).trim(),
      label: null,
      note: null,
      isPrimary: true,
      whatsapp: false,
      telegram: false,
      viber: false,
    })
  }

  if (phones.length && !phones.some(item => item.isPrimary)) {
    phones[0].isPrimary = true
  }

  let primarySeen = false
  return phones.map(item => {
    const isPrimary = item.isPrimary && !primarySeen
    if (isPrimary) primarySeen = true
    return { ...item, isPrimary }
  })
}

export function primaryPhone(phones: ContactPhoneInput[], fallbackPhone?: string | null) {
  return phones.find(item => item.isPrimary)?.phone || phones[0]?.phone || fallbackPhone || null
}

export function phonesWithLegacy(record: any) {
  if (Array.isArray(record?.phones) && record.phones.length > 0) return record.phones
  if (!record?.phone) return []
  return [{
    id: `legacy-${record.id || 'phone'}`,
    phone: record.phone,
    label: '',
    note: '',
    isPrimary: true,
    whatsapp: false,
    telegram: false,
    viber: false,
    legacy: true,
  }]
}
