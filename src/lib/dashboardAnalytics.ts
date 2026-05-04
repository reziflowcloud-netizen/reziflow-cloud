export type MonthOption = {
  key: string
  label: string
  start: Date
  end: Date
}

export function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function getMonthBounds(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!year || !month || month < 1 || month > 12) {
    const now = new Date()
    return getMonthBounds(getMonthKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))))
  }

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

export function formatMonthLabel(monthKey: string) {
  const { start } = getMonthBounds(monthKey)
  return start.toLocaleDateString('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function formatShortMonth(date: Date) {
  return date.toLocaleDateString('ru', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('ru', { timeZone: 'UTC' })
}

export function formatMoney(value: number) {
  return `${value.toFixed(2)} zł`
}

export function buildMonthOptions(dates: Date[], fallbackMonths = 6): MonthOption[] {
  const keys = new Set<string>()
  for (const date of dates) keys.add(getMonthKey(new Date(date)))

  if (keys.size === 0) {
    const now = new Date()
    for (let i = fallbackMonths - 1; i >= 0; i--) {
      keys.add(getMonthKey(new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))))
    }
  }

  return Array.from(keys)
    .sort()
    .reverse()
    .map((key) => {
      const { start, end } = getMonthBounds(key)
      return { key, label: formatMonthLabel(key), start, end }
    })
}

export function selectedMonth(searchValue: string | string[] | undefined, options: MonthOption[]) {
  const value = Array.isArray(searchValue) ? searchValue[0] : searchValue
  if (value && options.some((month) => month.key === value)) return value
  return options[0]?.key || getMonthKey(new Date())
}
