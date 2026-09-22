'use client'

import { useEffect, useState } from 'react'
import type { StaffScopeValue } from '@/lib/staffScope'
import type { Lang } from '@/lib/translations'

type EmployeeOption = { id: number; name: string }

const COPY = {
  ru: { label: 'Ответственный', all: 'Все', mine: 'Мои', link: 'Чтобы использовать «Мои», привяжите ваш CRM-аккаунт к сотруднику в Настройках.' },
  uk: { label: 'Відповідальний', all: 'Усі', mine: 'Мої', link: 'Щоб використовувати «Мої», прив’яжіть ваш CRM-акаунт до співробітника в Налаштуваннях.' },
  pl: { label: 'Odpowiedzialny', all: 'Wszyscy', mine: 'Moje', link: 'Aby korzystać z „Moje”, powiąż konto CRM z pracownikiem w Ustawieniach.' },
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
  const [controlVisible, setControlVisible] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/staff-scope', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!active) return
        setMineAvailable(restricted || data?.mineAvailable === true)
        setControlVisible(data?.controlVisible !== false)
      })
      .catch(() => {
        if (!active) return
        setMineAvailable(restricted)
        setControlVisible(true)
      })
    return () => { active = false }
  }, [restricted])

  useEffect(() => {
    if (restricted) return
    if (controlVisible === false && value !== 'all') onChange('all')
    else if (!mineAvailable && value === 'mine') onChange('all')
  }, [controlVisible, mineAvailable, onChange, restricted, value])

  if (controlVisible !== true) return null

  return (
    <label
      title={!restricted && !mineAvailable ? copy.link : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        color: 'var(--muted)',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
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
        style={{ minWidth: compact ? 116 : 128, width: 'auto', padding: '5px 28px 5px 8px', fontSize: 12, fontWeight: 600 }}
      >
        {!restricted && <option value="all">{copy.all}</option>}
        <option value="mine" disabled={!restricted && !mineAvailable}>{copy.mine}</option>
        {!restricted && employees.map(employee => (
          <option key={employee.id} value={`employee:${employee.id}`}>{employee.name}</option>
        ))}
      </select>
      {!restricted && !mineAvailable && <span aria-label={copy.link} style={{ cursor: 'help', fontSize: 11 }}>ⓘ</span>}
    </label>
  )
}
