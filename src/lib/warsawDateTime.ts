// Existing datetime-local reminder values are Poland wall time; explicit offsets stay exact.
export function warsawTimestamp(value: string) {
  if (/Z$|[+-]\d\d:?\d\d$/i.test(value)) return new Date(value).getTime()
  const base = Date.parse(value + 'Z')
  if (!Number.isFinite(base)) return NaN
  const represented = (candidate: number) => {
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate))
    const p = (type: string) => parts.find(part => part.type === type)?.value
    return Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`) + new Date(candidate).getUTCMilliseconds()
  }
  // Warsaw's two offsets: an autumn fold chooses the first occurrence; a spring
  // gap moves forward by its one-hour gap (02:30 -> 03:30). Never oscillate.
  const candidates = [base - 7200000, base - 3600000]
  const exact = candidates.filter(candidate => represented(candidate) === base)
  if (exact.length) return Math.min(...exact)
  return candidates.filter(candidate => represented(candidate) > base).sort((a, b) => a - b)[0] ?? NaN
}

// Existing CRM datetime-local controls use Warsaw wall time. Stored ISO/offset
// timestamps remain exact; existing date-only API values keep their old meaning.
export function parseWarsawDateTime(value: string | Date) {
  if (value instanceof Date) return new Date(value.getTime())
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value) : warsawTimestamp(value))
}
export function warsawDateTimeLocal(value?: string | Date | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const p = (type: string) => parts.find(part => part.type === type)?.value
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`
}
