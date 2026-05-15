'use client'

import type { ContactPhoneInput } from '@/lib/phones'

const LABELS = [
  { value: '', label: 'Тип' },
  { value: 'main', label: 'Основной' },
  { value: 'polish', label: 'Польский' },
  { value: 'ukrainian', label: 'Украинский' },
  { value: 'work', label: 'Рабочий' },
  { value: 'other', label: 'Другой' },
]

function emptyPhone(isPrimary = false): ContactPhoneInput {
  return {
    phone: '',
    label: '',
    note: '',
    isPrimary,
    whatsapp: false,
    telegram: false,
    viber: false,
  }
}

export function ensurePhoneRows(phones: ContactPhoneInput[] | undefined, fallbackPhone?: string) {
  if (phones?.length) return phones
  if (fallbackPhone) return [{ ...emptyPhone(true), phone: fallbackPhone }]
  return [emptyPhone(true)]
}

export default function PhoneListEditor({
  phones,
  onChange,
}: {
  phones: ContactPhoneInput[]
  onChange: (phones: ContactPhoneInput[]) => void
}) {
  const rows = phones.length ? phones : [emptyPhone(true)]

  function update(index: number, patch: Partial<ContactPhoneInput>) {
    const next = rows.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    if (patch.isPrimary) {
      next.forEach((item, itemIndex) => { item.isPrimary = itemIndex === index })
    }
    if (!next.some(item => item.isPrimary)) next[0].isPrimary = true
    onChange(next)
  }

  function remove(index: number) {
    const next = rows.filter((_, itemIndex) => itemIndex !== index)
    if (!next.length) {
      onChange([emptyPhone(true)])
      return
    }
    if (!next.some(item => item.isPrimary)) next[0].isPrimary = true
    onChange(next)
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((item, index) => (
        <div
          key={item.id || index}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 10,
            background: 'var(--surface)',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 1fr) 130px auto', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="tel"
              value={item.phone || ''}
              onChange={event => update(index, { phone: event.target.value })}
              placeholder="+48..."
            />
            <select className="select" value={item.label || ''} onChange={event => update(index, { label: event.target.value })}>
              {LABELS.map(label => <option key={label.value} value={label.value}>{label.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <input type="radio" checked={Boolean(item.isPrimary)} onChange={() => update(index, { isPrimary: true })} />
              Основной
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {(['whatsapp', 'telegram', 'viber'] as const).map(channel => (
              <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(item[channel])}
                  onChange={event => update(index, { [channel]: event.target.checked } as Partial<ContactPhoneInput>)}
                />
                {channel === 'whatsapp' ? 'WhatsApp' : channel === 'telegram' ? 'Telegram' : 'Viber'}
              </label>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <input
              className="input"
              value={item.note || ''}
              onChange={event => update(index, { note: event.target.value })}
              placeholder="Примечание: кому принадлежит номер, когда звонить, нюансы связи..."
            />
            <button type="button" className="btn btn-secondary" onClick={() => remove(index)} disabled={rows.length === 1 && !item.phone}>
              Удалить
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-secondary" onClick={() => onChange([...rows, emptyPhone(false)])} style={{ justifyContent: 'center' }}>
        + Добавить телефон
      </button>
    </div>
  )
}
