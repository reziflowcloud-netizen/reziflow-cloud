'use client'

import { useEffect, useMemo, useState } from 'react'

type Scope = 'client' | 'case'

type CustomField = {
  id: number
  label: string
  type: string
  placeholder?: string | null
  options?: string[] | null
  required: boolean
  value?: string
}

type CustomSection = {
  id: number
  title: string
  description?: string | null
  fields: CustomField[]
}

type Props = {
  scope: Scope
  recordId: string
}

function checkboxValue(value: string | undefined) {
  return value === 'true'
}

export default function CustomSectionsRenderer({ scope, recordId }: Props) {
  const [sections, setSections] = useState<CustomSection[]>([])
  const [values, setValues] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/custom-field-values?scope=${scope}&recordId=${recordId}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const loadedSections = data.sections || []
        const nextValues: Record<number, string> = {}
        loadedSections.forEach((section: CustomSection) => {
          section.fields.forEach(field => {
            nextValues[field.id] = field.value || ''
          })
        })
        setSections(loadedSections)
        setValues(nextValues)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [scope, recordId])

  const visibleSections = useMemo(() => (
    sections.filter(section => section.fields.length > 0)
  ), [sections])

  if (loading) return null
  if (visibleSections.length === 0) return null

  async function save() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/custom-field-values', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, recordId, values }),
    })
    setSaving(false)
    setMessage(res.ok ? 'Дополнительные поля сохранены' : 'Не удалось сохранить дополнительные поля')
  }

  function setValue(fieldId: number, value: string) {
    setValues(current => ({ ...current, [fieldId]: value }))
    setMessage('')
  }

  function renderField(field: CustomField) {
    const value = values[field.id] || ''
    const common = {
      id: `custom-field-${scope}-${recordId}-${field.id}`,
      className: 'input',
      value,
      required: field.required,
      placeholder: field.placeholder || '',
      onChange: (event: any) => setValue(field.id, event.target.value),
    }

    let control
    if (field.type === 'textarea') {
      control = <textarea {...common} style={{ minHeight: 84, resize: 'vertical' }} />
    } else if (field.type === 'date') {
      control = <input {...common} type="date" />
    } else if (field.type === 'number') {
      control = <input {...common} type="number" />
    } else if (field.type === 'checkbox') {
      control = (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <input
            type="checkbox"
            checked={checkboxValue(value)}
            onChange={event => setValue(field.id, event.target.checked ? 'true' : 'false')}
            style={{ width: 18, height: 18 }}
          />
          <span>{field.label}</span>
        </label>
      )
    } else if (field.type === 'select') {
      control = (
        <select {...common}>
          <option value="">Выберите</option>
          {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      )
    } else {
      control = <input {...common} type="text" />
    }

    if (field.type === 'checkbox') {
      return <div key={field.id}>{control}</div>
    }

    return (
      <div key={field.id}>
        <label htmlFor={`custom-field-${scope}-${recordId}-${field.id}`} style={{ display: 'block', marginBottom: 6, color: 'var(--muted)', fontSize: 13 }}>
          {field.label}{field.required ? ' *' : ''}
        </label>
        {control}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 18 }}>
      {visibleSections.map(section => (
        <div
          key={section.id}
          className="card"
          data-collapse-key={`custom-${scope}-${section.id}`}
          data-section-scope={scope}
          data-section-key={`custom-${scope}-${section.id}`}
          style={{ marginBottom: 16 }}
        >
          <div className="section-title" data-collapse-header style={{ marginBottom: 14 }}>
            <span>▣</span>
            <span>
              <strong style={{ display: 'block' }}>{section.title}</strong>
              {section.description && <small style={{ display: 'block', color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>{section.description}</small>}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {section.fields.map(renderField)}
          </div>
        </div>
      ))}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <span style={{ color: message.includes('Не удалось') ? '#dc2626' : 'var(--muted)' }}>{message || 'Дополнительные поля сохраняются отдельно от стандартной карточки.'}</span>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить дополнительные поля'}</button>
      </div>
    </div>
  )
}
