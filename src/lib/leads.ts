export const LEAD_STATUSES = [
  'Новый',
  'Первый контакт',
  'Квалификация',
  'Прогрев',
  'Готов к сделке',
  'Не подходит',
  'Переведён в клиента',
]

export const DEFAULT_LEAD_STATUSES = [
  { name: LEAD_STATUSES[0], color: '#2563eb', order: 0 },
  { name: LEAD_STATUSES[1], color: '#0369a1', order: 1 },
  { name: LEAD_STATUSES[2], color: '#d97706', order: 2 },
  { name: LEAD_STATUSES[3], color: '#7c3aed', order: 3 },
  { name: LEAD_STATUSES[4], color: '#15803d', order: 4 },
  { name: LEAD_STATUSES[5], color: '#dc2626', order: 5 },
  { name: LEAD_STATUSES[6], color: '#4b5563', order: 6 },
]

export const LEAD_SOURCES = [
  { value: 'manual', label: 'Вручную' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'quiz', label: 'Квиз' },
  { value: 'target', label: 'Таргет' },
  { value: 'website', label: 'Сайт' },
]

export function leadDisplayName(lead: any) {
  return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Лид без имени'
}

export function normalizeLeadBody(body: any) {
  const fullName = String(body.fullName || '').trim()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const fallbackName = `${firstName} ${lastName}`.trim() || fullName

  return {
    status: body.status || 'Новый',
    source: body.source || 'manual',
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fallbackName || null,
    phone: body.phone || null,
    email: body.email || null,
    instagram: body.instagram || null,
    facebook: body.facebook || null,
    messengerId: body.messengerId || null,
    city: body.city || null,
    country: body.country || null,
    language: body.language || null,
    serviceInterest: body.serviceInterest || null,
    budget: body.budget || null,
    urgency: body.urgency || null,
    notes: body.notes || null,
    assignedToId: body.assignedToId ? Number(body.assignedToId) : null,
    nextContactAt: body.nextContactAt ? new Date(body.nextContactAt) : null,
    nextContactNote: body.nextContactNote || null,
    lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : null,
    lastContactNote: body.lastContactNote || null,
  }
}
