export const LEAD_AUTOSAVE_FIELDS = new Set('status source firstName lastName fullName phone phones email instagram facebook city voivodeship country language serviceInterest budget urgency statusReason statusReasonComment notes employeeId assignedToId deadlineAt nextContactAt nextContactNote lastContactAt lastContactNote'.split(' '))
export const CLIENT_AUTOSAVE_FIELDS = new Set('firstName lastName previousFirstName previousLastName maidenName birthDate birthPlace pesel gender phone phones email city citizenship nationality maritalStatus education profession statusUKR fatherName motherName motherMaidenName dependents branch passportSeries passportNumber passportIssuedBy passportIssuedAt passportExpiresAt height eyeColor specialSigns originCountryAddress previousResidenceAddress addressInPoland legalTitle rentalEndDate stayBasis lastEntryDate previousPolandEntryDate previousPolandExitDate previousPolandBasis previousPolandStays firstResidenceCard residenceCardExpiry finesInPoland finesDescription'.split(' '))
export const TASK_AUTOSAVE_FIELDS = new Set('title description priority status dueDate assignedToId clientName clientId reminderAt reminderNote'.split(' '))
export const entityFieldPolicy = (fields: Set<string>) => (key: string) => fields.has(key) || /^custom:\d+$/.test(key)
export function customFormValues(values: Record<string, unknown> = {}) { return Object.fromEntries(Object.entries(values).map(([id, value]) => [`custom:${id}`, value])) }
export async function patchEntity(url: string, patch: Record<string, unknown>, version: string) {
  if (!version) throw new Error('Version unavailable')
  const body: Record<string, unknown> = { expectedUpdatedAt: version }
  const custom: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('custom:')) custom[key.slice(7)] = value
    else body[key] = value
  }
  if (Object.keys(custom).length) body.customFieldValues = custom
  const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-LegalHub-Entity-Write': 'versioned' }, body: JSON.stringify(body) })
  if (!response.ok) throw Object.assign(new Error('Save failed'), { status: response.status })
  const record = await response.json()
  if (!record.updatedAt) throw new Error('Version unavailable')
  return record
}
