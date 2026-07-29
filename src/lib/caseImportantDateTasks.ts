export type CaseImportantDateTaskRef = {
  caseId: string
  kind: string
}

type StatusChange = {
  fromStatus?: string | null
  changedAt: string | Date
}

const POLAND_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const DAY_MS = 24 * 60 * 60 * 1000
const PERSONAL_APPEAR_STATUS_GRACE_DAYS = 2

function dateKey(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = POLAND_DATE_FORMATTER.formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : ''
}

function calendarDay(value: string | Date | null | undefined) {
  const key = dateKey(value)
  if (!key) return null
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

export function getCaseImportantDateTaskRef(description?: string | null): CaseImportantDateTaskRef | null {
  try {
    const ref = JSON.parse(description || '{}')?.caseImportantDate
    const caseId = String(ref?.caseId || '').trim()
    const kind = String(ref?.kind || '').trim()
    return caseId && kind ? { caseId, kind } : null
  } catch {
    return null
  }
}

export function shouldRetirePersonalAppearTask(
  personalAppearDate: string | Date | null | undefined,
  statusChanges: StatusChange[],
  now = new Date()
) {
  const appearanceDay = calendarDay(personalAppearDate)
  const todayDay = calendarDay(now)
  if (appearanceDay === null || todayDay === null || appearanceDay > todayDay) return false

  return statusChanges.some(change => {
    if (!change.fromStatus) return false
    const changedDay = calendarDay(change.changedAt)
    return changedDay !== null
      && changedDay >= appearanceDay
      && changedDay <= appearanceDay + PERSONAL_APPEAR_STATUS_GRACE_DAYS
  })
}
