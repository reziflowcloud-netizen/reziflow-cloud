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
  const appearanceDateKey = dateKey(personalAppearDate)
  const todayKey = dateKey(now)
  if (!appearanceDateKey || !todayKey || appearanceDateKey >= todayKey) return false

  return statusChanges.some(change => {
    if (!change.fromStatus) return false
    const changedDateKey = dateKey(change.changedAt)
    return !!changedDateKey && changedDateKey > appearanceDateKey
  })
}
