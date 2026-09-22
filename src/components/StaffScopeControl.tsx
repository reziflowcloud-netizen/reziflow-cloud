'use client'

import { useEffect, useState } from 'react'
import type { StaffScopeValue } from '@/lib/staffScope'
import type { Lang } from '@/lib/translations'

type EmployeeOption = { id: number; name: string }

const COPY = {
  ru: { label: 'Ответственный', all: 'Все', mine: 'Мои', link: 'Чтобы использовать «Мои», привяжите ваш CRM-аккаунт к сотруднику в Настройках.', settings: 'Настройки сотрудников' },
  uk: { label: 'Відповідальний', all: 'Усі', mine: 'Мої', link: 'Щоб використовувати «Мої», прив’яжіть ваш CRM-акаунт до співробітника в Налаштуваннях.', settings: 'Налаштування співробітників' },
  pl: { label: 'Odpowiedzialny', all: 'Wszyscy', mine: 'Moje', link: 'Aby korzystać z „Moje”, powiąż konto CRM z pracownikiem w Ustawieniach.', settings: 'Ustawienia pracowników' },
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
  const [mineAvailable, setMineAvailable] = useState(restricted)

  useEffect(() => {
    if (restricted) { setMineAvailable(true); return }
    let active = true
    fetch('/api/staff-scope', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!active) return
        const available = data?.mineAvailable === true
        setMineAvailable(available)
        if (!available && value === 'mine') onChange('all')
      })
      .catch(() => { if (active) setMineAvailable(false) })
    return () => { active = false }
  }, [restricted, value, onChange])

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
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
        <option value="mine" disabled={!restricted && !mineAvailable}>{copy.mine}</option>
        {!restricted && employees.map(employee => (
          <option key={employee.id} value={`employee:${employee.id}`}>{employee.name}</option>
        ))}
      </select>
    </label>
    {!restricted && !mineAvailable && (
      <span role="note" style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--muted)', maxWidth: compact ? 270 : 390 }}>
        {copy.link} <a href="/settings/employees" style={{ color: 'var(--brand)' }}>{copy.settings}</a>
      </span>
    )}
    </div>
  )
}
