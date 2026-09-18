'use client'

import type { StaffScopeValue } from '@/lib/staffScope'
import type { Lang } from '@/lib/translations'

type EmployeeOption = { id: number; name: string }

const COPY = {
  ru: { label: 'Ответственный', all: 'Все', mine: 'Мои' },
  uk: { label: 'Відповідальний', all: 'Усі', mine: 'Мої' },
  pl: { label: 'Odpowiedzialny', all: 'Wszyscy', mine: 'Moje' },
} as const

export default function StaffScopeControl({
  value,
  onChange,
  employees,
  restricted = false,
  lang,
  compact = false,
}: {
  value: StaffScopeValue
  onChange: (value: StaffScopeValue) => void
  employees: EmployeeOption[]
  restricted?: boolean
  lang: Lang
  compact?: boolean
}) {
  const copy = COPY[lang] || COPY.ru
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minWidth: compact ? 0 : 220,
        color: 'var(--muted)',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span aria-hidden="true">👤</span>
      {!compact && <span>{copy.label}:</span>}
      <select
        className="input"
        aria-label={copy.label}
        value={restricted ? 'mine' : value}
        disabled={restricted}
        onChange={event => onChange(event.target.value as StaffScopeValue)}
        style={{ minWidth: compact ? 128 : 145, padding: '7px 30px 7px 9px', fontWeight: 700 }}
      >
        {!restricted && <option value="all">{copy.all}</option>}
        <option value="mine">{copy.mine}</option>
        {!restricted && employees.map(employee => (
          <option key={employee.id} value={`employee:${employee.id}`}>{employee.name}</option>
        ))}
      </select>
    </label>
  )
}
