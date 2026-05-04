// src/app/settings/case-options/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type OptionType = 'stayPurpose' | 'stayType' | 'contractType' | 'mosDocument'

const TYPE_LABELS: Record<OptionType, string> = {
  stayPurpose: 'Цель пребывания',
  stayType: 'Тип занятости',
  contractType: 'Тип договора',
  mosDocument: 'Документы для MOS',
}

const TYPE_ICONS: Record<OptionType, string> = {
  stayPurpose: '🏠',
  stayType: '💼',
  contractType: '📄',
  mosDocument: '📄',
}

// Стандартные варианты — загружаются одной кнопкой если база пустая
const DEFAULTS: Record<OptionType, string[]> = {
  stayPurpose: [
    'Побыт часовый (Временный)',
    'Побыт сталый (Постоянный)',
    'Побыт длуготорминовы (Долгосрочный)',
  ],
  stayType: [
    'Выконывание пацы (Работа)',
    'Обучение',
    'Воссоединение семьи',
    'Бизнес',
    'Другое',
  ],
  contractType: [
    'Умова злецения (Договор подряда)',
    'Умова о працу (Трудовой)',
    'Умова о дзело (Договор)',
  ],
  mosDocument: [
    'Заявление',
    'Копия паспорта',
    'Фото',
    'Подтверждение оплаты',
    'Договор',
    'Подтверждение адреса',
  ],
}

interface CaseOption {
  id: number
  type: OptionType
  value: string
  order: number
}

export default function CaseOptionsPage() {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/settings'
  const [options, setOptions] = useState<CaseOption[]>([])
  const [newValues, setNewValues] = useState<Record<OptionType, string>>({
    stayPurpose: '', stayType: '', contractType: '', mosDocument: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState<OptionType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/case-options')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setOptions(Array.isArray(d) ? d : []))
      .catch(e => setFetchError(`Ошибка загрузки: ${e.message}. Возможно таблица ещё не создана — подождите деплой.`))
  }, [])

  function optionsByType(type: OptionType) {
    return options.filter(o => o.type === type).sort((a, b) => a.order - b.order)
  }

  async function add(type: OptionType) {
    const value = newValues[type].trim()
    if (!value) return
    setLoading(true)
    setError(null)
    try {
      const existing = optionsByType(type)
      const res = await fetch('/api/case-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value, order: existing.length }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const created = await res.json()
      setOptions(prev => [...prev, created])
      setNewValues(prev => ({ ...prev, [type]: '' }))
    } catch (e: any) {
      setError(`Не удалось добавить: ${e.message}`)
    }
    setLoading(false)
  }

  async function loadDefaults(type: OptionType) {
    setSeeding(type)
    setError(null)
    const defaults = DEFAULTS[type]
    const existing = optionsByType(type)
    try {
      for (let i = 0; i < defaults.length; i++) {
        const value = defaults[i]
        // Не дублировать если уже есть
        if (existing.find(o => o.value === value)) continue
        const res = await fetch('/api/case-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, value, order: existing.length + i }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const created = await res.json()
        setOptions(prev => [...prev, created])
      }
    } catch (e: any) {
      setError(`Ошибка загрузки стандартных: ${e.message}`)
    }
    setSeeding(null)
  }

  async function save(id: number) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setError(null)
    const opt = options.find(o => o.id === id)
    try {
      const res = await fetch(`/api/case-options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: trimmed, order: opt?.order ?? 0 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setOptions(prev => prev.map(o => o.id === id ? updated : o))
      setEditingId(null)
    } catch (e: any) {
      setError(`Не удалось сохранить: ${e.message}`)
    }
  }

  async function remove(id: number) {
    if (!confirm('Удалить этот вариант?')) return
    setError(null)
    try {
      const res = await fetch(`/api/case-options/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOptions(prev => prev.filter(o => o.id !== id))
    } catch (e: any) {
      setError(`Не удалось удалить: ${e.message}`)
    }
  }

  function startEdit(opt: CaseOption) {
    setEditingId(opt.id)
    setEditValue(opt.value)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Варианты полей дела</div>
          <div className="page-subtitle">Управление выпадающими списками при создании дела</div>
        </div>
        <Link href={returnTo} className="btn btn-secondary">← Назад</Link>
      </div>

      <div className="page-body">

        {/* Ошибка загрузки */}
        {fetchError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            ⚠️ {fetchError}
          </div>
        )}

        {/* Ошибка операции */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>✕</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {(Object.keys(TYPE_LABELS) as OptionType[]).map(type => {
            const items = optionsByType(type)
            return (
              <div key={type} className="card">
                {/* Заголовок */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{TYPE_ICONS[type]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{TYPE_LABELS[type]}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} вариантов</div>
                    </div>
                  </div>
                  {/* Кнопка загрузки стандартных */}
                  {items.length === 0 && (
                    <button
                      onClick={() => loadDefaults(type)}
                      disabled={seeding === type}
                      style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--muted)', whiteSpace: 'nowrap' }}
                    >
                      {seeding === type ? '⏳ Загрузка...' : '📥 Загрузить стандартные'}
                    </button>
                  )}
                </div>

                {/* Список */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, minHeight: 40 }}>
                  {items.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>
                      Нет вариантов. Добавьте или нажмите «Загрузить стандартные» ↑
                    </div>
                  )}
                  {items.map(opt => (
                    <div key={opt.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', background: 'var(--bg)',
                      borderRadius: 8, border: '1px solid var(--border)',
                    }}>
                      {editingId === opt.id ? (
                        <>
                          <input
                            className="input"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') save(opt.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                            style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                          />
                          <button onClick={() => save(opt.id)} className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: 12 }}>💾</button>
                          <button onClick={() => setEditingId(null)} className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{opt.value}</span>
                          <button onClick={() => startEdit(opt)}
                            style={{ background: 'var(--border)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                            ✏️
                          </button>
                          <button onClick={() => remove(opt.id)}
                            style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Форма добавления */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={newValues[type]}
                    onChange={e => setNewValues(prev => ({ ...prev, [type]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') add(type) }}
                    placeholder="Новый вариант..."
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    onClick={() => add(type)}
                    className="btn btn-primary"
                    disabled={loading || !newValues[type].trim()}
                    style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    + Добавить
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
