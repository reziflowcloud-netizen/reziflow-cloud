import { randomBytes, timingSafeEqual } from 'crypto'

export type LeadWebhookSettings = {
  leadWebhookEnabled?: boolean
  leadWebhookKey?: string
  leadWebhookFieldMap?: LeadWebhookFieldMapping[]
  leadWebhookAssignmentMode?: LeadWebhookAssignmentMode
  leadWebhookAssignmentUserId?: number | null
  leadWebhookAssignmentUserIds?: number[]
  leadWebhookAssignmentCursor?: number
  facebookLeadEnabled?: boolean
  facebookLeadVerifyToken?: string
  facebookLeadPageAccessToken?: string
  facebookLeadApiVersion?: string
}

export type LeadWebhookAssignmentMode = 'off' | 'single' | 'round_robin'

export type LeadWebhookFieldMapping = {
  external: string
  target: string
}

export const LEAD_WEBHOOK_TARGET_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'phone',
  'email',
  'instagram',
  'facebook',
  'messengerId',
  'city',
  'country',
  'language',
  'serviceInterest',
  'budget',
  'urgency',
  'notes',
  'source',
  'nextContactAt',
  'nextContactNote',
]

const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['firstName', 'first_name', 'firstname', 'imie', 'imię', 'name_first', 'имя', 'імя'],
  lastName: ['lastName', 'last_name', 'lastname', 'nazwisko', 'surname', 'family_name', 'фамилия', 'прізвище'],
  fullName: ['fullName', 'full_name', 'fullname', 'name', 'lead_name', 'client_name', 'fio', 'pib', 'фио', 'пиб', 'піб', 'имя фамилия', 'імя прізвище'],
  phone: ['phone', 'telefon', 'telephone', 'mobile', 'contact_phone', 'phone_number', 'tel', 'номер телефона', 'телефон'],
  email: ['email', 'e-mail', 'mail', 'contact_email', 'почта', 'пошта'],
  instagram: ['instagram', 'insta', 'ig', 'instagram_username'],
  facebook: ['facebook', 'fb', 'facebook_profile'],
  messengerId: ['messengerId', 'messenger_id', 'psid', 'sender_id', 'subscriber_id'],
  city: ['city', 'miasto', 'город', 'місто'],
  country: ['country', 'citizenship', 'obywatelstwo', 'kraj', 'страна', 'гражданство', 'країна', 'громадянство'],
  language: ['language', 'lang', 'język', 'jezyk', 'язык', 'мова'],
  serviceInterest: ['serviceInterest', 'service_interest', 'service', 'usluga', 'usługa', 'interest', 'quiz_result', 'product', 'услуга', 'послуга', 'интерес', 'інтерес'],
  budget: ['budget', 'budzet', 'budżet', 'бюджет'],
  urgency: ['urgency', 'pilnosc', 'pilność', 'срочность', 'терміновість'],
  notes: ['notes', 'note', 'comment', 'message', 'question', 'opis', 'uwagi', 'комментарий', 'заметка', 'повідомлення'],
  source: ['source', 'utm_source', 'lead_source', 'источник', 'джерело'],
  nextContactAt: ['nextContactAt', 'next_contact_at', 'next_contact', 'callback_at', 'call_at', 'дата контакта', 'наступний контакт'],
  nextContactNote: ['nextContactNote', 'next_contact_note', 'callback_note', 'contact_note', 'о чем сконтактироваться', 'про що сконтактуватися'],
}

export function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function getLeadWebhookSettings(value: unknown): LeadWebhookSettings {
  const raw = settingsObject(value)
  const fieldMap = Array.isArray(raw.leadWebhookFieldMap)
    ? raw.leadWebhookFieldMap
        .map((item: any) => ({
          external: String(item?.external || '').trim(),
          target: String(item?.target || '').trim(),
        }))
        .filter(item => item.external && LEAD_WEBHOOK_TARGET_FIELDS.includes(item.target))
    : []
  const assignmentMode = ['single', 'round_robin'].includes(String(raw.leadWebhookAssignmentMode))
    ? String(raw.leadWebhookAssignmentMode) as LeadWebhookAssignmentMode
    : 'off'
  const assignmentUserId = raw.leadWebhookAssignmentUserId ? Number(raw.leadWebhookAssignmentUserId) : null
  const assignmentUserIds = Array.isArray(raw.leadWebhookAssignmentUserIds)
    ? raw.leadWebhookAssignmentUserIds.map(Number).filter(Number.isFinite)
    : []
  return {
    leadWebhookEnabled: raw.leadWebhookEnabled !== false,
    leadWebhookKey: typeof raw.leadWebhookKey === 'string' ? raw.leadWebhookKey : '',
    leadWebhookFieldMap: fieldMap,
    leadWebhookAssignmentMode: assignmentMode,
    leadWebhookAssignmentUserId: Number.isFinite(assignmentUserId) ? assignmentUserId : null,
    leadWebhookAssignmentUserIds: assignmentUserIds,
    leadWebhookAssignmentCursor: Number.isFinite(Number(raw.leadWebhookAssignmentCursor)) ? Number(raw.leadWebhookAssignmentCursor) : 0,
    facebookLeadEnabled: raw.facebookLeadEnabled === true,
    facebookLeadVerifyToken: typeof raw.facebookLeadVerifyToken === 'string' ? raw.facebookLeadVerifyToken : '',
    facebookLeadPageAccessToken: typeof raw.facebookLeadPageAccessToken === 'string' ? raw.facebookLeadPageAccessToken : '',
    facebookLeadApiVersion: typeof raw.facebookLeadApiVersion === 'string' && raw.facebookLeadApiVersion ? raw.facebookLeadApiVersion : 'v23.0',
  }
}

export function generateLeadWebhookKey() {
  return `rzf_${randomBytes(24).toString('hex')}`
}

export function generateFacebookVerifyToken() {
  return `rzfb_${randomBytes(24).toString('hex')}`
}

export function keyMatches(expected: string, received: string) {
  if (!expected || !received) return false
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function sanitizeLeadWebhookPayload(value: unknown) {
  const raw = settingsObject(value)
  const blocked = new Set(['key', 'apikey', 'apiKey', 'token', 'password', 'secret', 'authorization'])
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => !blocked.has(key) && !blocked.has(key.toLowerCase()))
      .map(([key, item]) => [key, typeof item === 'string' && item.length > 1000 ? `${item.slice(0, 1000)}...` : item])
  )
}

function normalizeFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._\-:;()[\]{}]+/g, '')
}

function stringifyWebhookValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const raw = settingsObject(value)
    if (typeof raw.url === 'string' && typeof raw.fileName === 'string') return `${raw.fileName}: ${raw.url}`
    return Object.values(raw).filter(Boolean).map(String).join(', ') || JSON.stringify(value)
  }
  return String(value)
}

function flattenWebhookPayload(value: unknown) {
  const raw = settingsObject(value)
  const flattened: Record<string, unknown> = { ...raw }
  const fieldData = Array.isArray(raw.field_data) ? raw.field_data : Array.isArray(raw.fieldData) ? raw.fieldData : []
  const webliumFields = settingsObject(raw.fields)

  for (const field of fieldData as any[]) {
    const name = String(field?.name || '').trim()
    if (!name) continue
    flattened[name] = Array.isArray(field?.values) ? field.values.join(', ') : field?.value
  }

  for (const [key, field] of Object.entries(webliumFields)) {
    const item = settingsObject(field)
    const title = String(item.title || key).trim()
    const type = String(item.type || '').trim().toLowerCase()
    const value = item.value
    const textValue = stringifyWebhookValue(value)
    if (title) flattened[title] = stringifyWebhookValue(value)
    if (key) flattened[key] = textValue
    if (key === 'short_text' && !flattened.fullName) flattened.fullName = textValue
    if (key === 'contactForm_phoneNumber' && !flattened.phone) flattened.phone = textValue
    if (type === 'phone' && !flattened.phone) flattened.phone = textValue
    if (type === 'email' && !flattened.email) flattened.email = textValue
    if (type === 'dropdown' && !flattened.serviceInterest) flattened.serviceInterest = textValue
  }

  return flattened
}

export function applyLeadWebhookMapping(value: unknown, mappings: LeadWebhookFieldMapping[] = []) {
  const raw = flattenWebhookPayload(value)
  const normalizedEntries = new Map<string, unknown>()

  for (const [key, item] of Object.entries(raw)) {
    normalizedEntries.set(normalizeFieldKey(key), item)
  }

  const mapped: Record<string, unknown> = { ...raw }

  for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
    if (mapped[target]) continue
    for (const alias of aliases) {
      const match = normalizedEntries.get(normalizeFieldKey(alias))
      const text = stringifyWebhookValue(match).trim()
      if (text) {
        mapped[target] = text
        break
      }
    }
  }

  for (const mapping of mappings) {
    if (!mapping.external || !LEAD_WEBHOOK_TARGET_FIELDS.includes(mapping.target)) continue
    const match = normalizedEntries.get(normalizeFieldKey(mapping.external))
    const text = stringifyWebhookValue(match).trim()
    if (text) mapped[mapping.target] = text
  }

  return mapped
}
