export const LEAD_STATUSES = [
  'Новый',
  'Первый контакт',
  'Квалификация',
  'Прогрев',
  'Готов к сделке',
  'Не подходит',
  'Переведён в клиента',
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
