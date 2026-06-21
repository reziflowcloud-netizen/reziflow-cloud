// src/app/settings/case-options/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

type OptionType = 'stayPurpose' | 'stayType' | 'contractType' | 'mosDocument'

const MOS_DOCUMENT_SUGGESTIONS = [
  'Действующий заграничный паспорт',
  'Профиль зауфаны / Profil Zaufany',
  'Цифровая фотография в формате JPG, 684×893 px',
  'Квитанция об оплате гербового сбора: 440, 340 или 640 PLN',
  'Квитанция об оплате за изготовление пластиковой карты: 100 PLN',
  'Договор аренды жилья / Umowa najmu',
  'Свидетельство о праве собственности на недвижимость',
  'Справка о прописке / Meldunek',
  'Трудовой договор / Umowa o pracę, Umowa zlecenie или Umowa o dzieło',
  'Приложение №1 / Załącznik nr 1 — от работодателя',
  'Приложение №5 / Załącznik nr 5 — от учебного заведения',
  'Справка из ZUS о страховании и отсутствии задолженности / ZUS RCA, ZUS ZUA',
  'Полис частного медицинского страхования',
  'Договор страхования с NFZ / Narodowy Fundusz Zdrowia',
  'Выписка из польского банковского счёта о наличии денежных средств',
  'Справка о доходах / подтверждение регулярного стабильного дохода',
  'Налоговая декларация за прошлый год / PIT-37, PIT-36 или PIT-11',
  'Справка об отсутствии налоговой задолженности / Zaświadczenie o niezaleganiu w podatkach',
  'Свидетельство о браке с присяжным переводом',
  'Свидетельство о рождении ребёнка с присяжным переводом',
  'Копия карты побыта или паспорта супруга / родителя',
  'Свидетельство о зачислении в вуз или полицеальную школу',
  'Справка о продолжении обучения и табель успеваемости',
  'Квитанция об оплате семестра или года обучения в вузе',
  'Выписка из судебного реестра компаний / KRS',
  'Выписка из реестра индивидуальных предпринимателей / CEIDG',
  'Устав компании / Umowa spółki',
  'Финансовый баланс компании и отчёт о прибылях и убытках / декларация CIT-8',
  'Справка о несудимости из страны происхождения с присяжным переводом',
  'Справка о несудимости в Польше / KRK',
  'Карта Поляка',
  'Решение о предоставлении международной защиты или статуса беженца',
  'Документы, подтверждающие польское происхождение, например архивные справки',
  'Присяжный перевод / Tłumaczenie przysięgłe любого документа, составленного не на польском языке',
]

const OPTION_TYPES: OptionType[] = ['stayPurpose', 'stayType', 'contractType', 'mosDocument']

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
    ...MOS_DOCUMENT_SUGGESTIONS,
  ],
}

interface CaseOption {
  id: number
  type: string
  value: string
  order: number
}

interface Service {
  id: number
  name: string
  active?: boolean
}

const caseOptionText = {
  ru: {
    title: 'Варианты полей дела',
    subtitle: 'Управление выпадающими списками при создании дела',
    loadError: 'Ошибка загрузки: {message}. Возможно таблица ещё не создана — подождите деплой.',
    addFailed: 'Не удалось добавить: {message}',
    defaultsFailed: 'Ошибка загрузки стандартных: {message}',
    saveFailed: 'Не удалось сохранить: {message}',
    deleteFailed: 'Не удалось удалить: {message}',
    deleteConfirm: 'Удалить этот вариант?',
    labels: {
      stayPurpose: 'Цель пребывания',
      stayType: 'Тип занятости',
      contractType: 'Тип договора',
      mosDocument: 'Документы для MOS',
    },
    variantsCount: '{count} вариантов',
    loadingDefaults: '⏳ Загрузка...',
    loadDefaults: '📥 Загрузить стандартные',
    service: 'Услуга',
    generalList: 'Общий список',
    empty: 'Нет вариантов. Добавьте или нажмите «Загрузить стандартные» ↑',
    newPlaceholder: 'Новый вариант...',
    add: '+ Добавить',
  },
  uk: {
    title: 'Варіанти полів справи',
    subtitle: 'Керування випадаючими списками під час створення справи',
    loadError: 'Помилка завантаження: {message}. Можливо, таблиця ще не створена — дочекайтеся деплою.',
    addFailed: 'Не вдалося додати: {message}',
    defaultsFailed: 'Помилка завантаження стандартних: {message}',
    saveFailed: 'Не вдалося зберегти: {message}',
    deleteFailed: 'Не вдалося видалити: {message}',
    deleteConfirm: 'Видалити цей варіант?',
    labels: {
      stayPurpose: 'Мета перебування',
      stayType: 'Тип зайнятості',
      contractType: 'Тип договору',
      mosDocument: 'Документи для MOS',
    },
    variantsCount: '{count} варіантів',
    loadingDefaults: '⏳ Завантаження...',
    loadDefaults: '📥 Завантажити стандартні',
    service: 'Послуга',
    generalList: 'Загальний список',
    empty: 'Варіантів немає. Додайте або натисніть «Завантажити стандартні» ↑',
    newPlaceholder: 'Новий варіант...',
    add: '+ Додати',
  },
  pl: {
    title: 'Opcje pól sprawy',
    subtitle: 'Zarządzanie listami rozwijanymi podczas tworzenia sprawy',
    loadError: 'Błąd ładowania: {message}. Możliwe, że tabela nie została jeszcze utworzona — poczekaj na deploy.',
    addFailed: 'Nie udało się dodać: {message}',
    defaultsFailed: 'Błąd ładowania standardowych opcji: {message}',
    saveFailed: 'Nie udało się zapisać: {message}',
    deleteFailed: 'Nie udało się usunąć: {message}',
    deleteConfirm: 'Usunąć tę opcję?',
    labels: {
      stayPurpose: 'Cel pobytu',
      stayType: 'Typ zatrudnienia',
      contractType: 'Typ umowy',
      mosDocument: 'Dokumenty do MOS',
    },
    variantsCount: '{count} opcji',
    loadingDefaults: '⏳ Ładowanie...',
    loadDefaults: '📥 Załaduj standardowe',
    service: 'Usługa',
    generalList: 'Lista ogólna',
    empty: 'Brak opcji. Dodaj albo kliknij „Załaduj standardowe” ↑',
    newPlaceholder: 'Nowa opcja...',
    add: '+ Dodaj',
  },
}

export default function CaseOptionsPage() {
  const { lang, t } = useLanguage()
  const text = caseOptionText[lang] || caseOptionText.ru
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/settings'
  const initialMosServiceId = searchParams.get('mosServiceId') || ''
  const [options, setOptions] = useState<CaseOption[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedMosServiceId, setSelectedMosServiceId] = useState(initialMosServiceId)
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
      .catch(e => setFetchError(text.loadError.replace('{message}', e.message)))
    fetch('/api/services')
      .then(r => r.ok ? r.json() : [])
      .then(d => setServices(Array.isArray(d) ? d.filter((s: Service) => s.active !== false) : []))
      .catch(() => setServices([]))
  }, [])

  function mosDocumentType(serviceId = selectedMosServiceId) {
    return serviceId ? `mosDocument:${serviceId}` : 'mosDocument'
  }

  function optionTypeFor(type: OptionType) {
    return type === 'mosDocument' ? mosDocumentType() : type
  }

  function optionsByType(type: OptionType) {
    const storedType = optionTypeFor(type)
    return options.filter(o => o.type === storedType).sort((a, b) => a.order - b.order)
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
        body: JSON.stringify({ type: optionTypeFor(type), value, order: existing.length }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const created = await res.json()
      setOptions(prev => [...prev, created])
      setNewValues(prev => ({ ...prev, [type]: '' }))
    } catch (e: any) {
      setError(text.addFailed.replace('{message}', e.message))
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
          body: JSON.stringify({ type: optionTypeFor(type), value, order: existing.length + i }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const created = await res.json()
        setOptions(prev => [...prev, created])
      }
    } catch (e: any) {
      setError(text.defaultsFailed.replace('{message}', e.message))
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
      setError(text.saveFailed.replace('{message}', e.message))
    }
  }

  async function remove(id: number) {
    if (!confirm(text.deleteConfirm)) return
    setError(null)
    try {
      const res = await fetch(`/api/case-options/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOptions(prev => prev.filter(o => o.id !== id))
    } catch (e: any) {
      setError(text.deleteFailed.replace('{message}', e.message))
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
          <div className="page-title">{text.title}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <Link href={returnTo} className="btn btn-secondary">{t('back')}</Link>
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

        <datalist id="mos-document-suggestions">
          {MOS_DOCUMENT_SUGGESTIONS.map(item => <option key={item} value={item} />)}
        </datalist>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {OPTION_TYPES.map(type => {
            const items = optionsByType(type)
            const hasMissingDefaults = DEFAULTS[type].some(value => !items.some(item => item.value === value))
            return (
              <div key={type} className="card">
                {/* Заголовок */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{TYPE_ICONS[type]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{text.labels[type]}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{text.variantsCount.replace('{count}', String(items.length))}</div>
                    </div>
                  </div>
                  {/* Кнопка загрузки стандартных */}
                  {(items.length === 0 || (type === 'mosDocument' && hasMissingDefaults)) && (
                    <button
                      onClick={() => loadDefaults(type)}
                      disabled={seeding === type}
                      style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--muted)', whiteSpace: 'nowrap' }}
                    >
                      {seeding === type ? text.loadingDefaults : text.loadDefaults}
                    </button>
                  )}
                </div>

                {type === 'mosDocument' && (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="label">{text.service}</label>
                    <select
                      className="select"
                      value={selectedMosServiceId}
                      onChange={e => {
                        setSelectedMosServiceId(e.target.value)
                        setEditingId(null)
                      }}
                    >
                      <option value="">{text.generalList}</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id.toString()}>{service.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Список */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, minHeight: 40 }}>
                  {items.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>
                      {text.empty}
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
                    list={type === 'mosDocument' ? 'mos-document-suggestions' : undefined}
                    value={newValues[type]}
                    onChange={e => setNewValues(prev => ({ ...prev, [type]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') add(type) }}
                    placeholder={text.newPlaceholder}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    onClick={() => add(type)}
                    className="btn btn-primary"
                    disabled={loading || !newValues[type].trim()}
                    style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {text.add}
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
