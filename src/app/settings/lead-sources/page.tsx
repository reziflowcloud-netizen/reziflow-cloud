'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { LeadSourceOption } from '@/lib/leads'
import { useLanguage } from '@/context/LanguageContext'

type SourceDraft = LeadSourceOption & { isNew?: boolean }

const sourceText = {
  ru: {
    loadFailed: 'Не удалось загрузить источники',
    saveFailed: 'Не удалось сохранить источники',
    deleteConfirm: 'Удалить источник? Старые лиды с этим источником останутся, но источник исчезнет из новых списков.',
    addTitle: 'Добавить источник',
    name: 'Название',
    placeholder: 'Например: TikTok, Рекомендация, OLX',
    saving: 'Сохраняю...',
    add: '+ Добавить',
    listTitle: 'Список источников',
    loading: 'Загрузка...',
    empty: 'Источников пока нет',
    willBeCreated: 'будет создан',
    save: 'Сохранить',
    delete: 'Удалить',
  },
  uk: {
    loadFailed: 'Не вдалося завантажити джерела',
    saveFailed: 'Не вдалося зберегти джерела',
    deleteConfirm: 'Видалити джерело? Старі ліди з цим джерелом залишаться, але джерело зникне з нових списків.',
    addTitle: 'Додати джерело',
    name: 'Назва',
    placeholder: 'Наприклад: TikTok, Рекомендація, OLX',
    saving: 'Зберігаю...',
    add: '+ Додати',
    listTitle: 'Список джерел',
    loading: 'Завантаження...',
    empty: 'Джерел поки немає',
    willBeCreated: 'буде створено',
    save: 'Зберегти',
    delete: 'Видалити',
  },
  pl: {
    loadFailed: 'Nie udało się załadować źródeł',
    saveFailed: 'Nie udało się zapisać źródeł',
    deleteConfirm: 'Usunąć źródło? Stare leady z tym źródłem zostaną, ale źródło zniknie z nowych list.',
    addTitle: 'Dodaj źródło',
    name: 'Nazwa',
    placeholder: 'Na przykład: TikTok, Polecenie, OLX',
    saving: 'Zapisuję...',
    add: '+ Dodaj',
    listTitle: 'Lista źródeł',
    loading: 'Ładowanie...',
    empty: 'Nie ma jeszcze źródeł',
    willBeCreated: 'zostanie utworzone',
    save: 'Zapisz',
    delete: 'Usuń',
  },
}

export default function LeadSourcesSettingsPage() {
  const { lang, t } = useLanguage()
  const text = sourceText[lang] || sourceText.ru
  const [sources, setSources] = useState<SourceDraft[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  useEffect(() => {
    loadSources()
  }, [])

  async function loadSources() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/lead-sources', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || text.loadFailed)
        return
      }
      setSources(Array.isArray(data.sources) ? data.sources : [])
    } finally {
      setLoading(false)
    }
  }

  async function save(nextSources = sources) {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/lead-sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: nextSources.map((source, index) => ({
            value: source.value,
            label: source.label.trim(),
            order: index,
            system: source.system,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || text.saveFailed)
        return
      }
      setSources(Array.isArray(data.sources) ? data.sources : [])
      setNewLabel('')
    } finally {
      setSaving(false)
    }
  }

  function addSource() {
    const label = newLabel.trim()
    if (!label) return
    const next = [...sources, { value: '', label, order: sources.length, system: false, isNew: true }]
    save(next)
  }

  function updateSource(index: number, label: string) {
    setSources(current => current.map((source, sourceIndex) => sourceIndex === index ? { ...source, label } : source))
  }

  function deleteSource(index: number) {
    if (!confirm(text.deleteConfirm)) return
    const next = sources.filter((_, sourceIndex) => sourceIndex !== index)
    save(next)
  }

  function onDragStart(index: number) {
    dragItem.current = index
  }

  function onDragEnter(index: number) {
    dragOver.current = index
  }

  function onDragEnd() {
    const from = dragItem.current
    const to = dragOver.current
    dragItem.current = null
    dragOver.current = null
    if (from === null || to === null || from === to) return
    const reordered = [...sources]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setSources(reordered)
    save(reordered)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('lead_sources_title')}</div>
          <div className="page-subtitle">{t('lead_sources_sub')}</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 720 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>+</span>{text.addTitle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', gap: 10, alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">{text.name}</label>
                <input
                  className="input"
                  value={newLabel}
                  onChange={event => setNewLabel(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && addSource()}
                  placeholder={text.placeholder}
                />
              </div>
              <button className="btn btn-primary" type="button" onClick={addSource} disabled={saving || !newLabel.trim()}>
                {saving ? text.saving : text.add}
              </button>
            </div>
            {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>{text.listTitle}</div>
              <button className="btn btn-primary" type="button" onClick={() => save()} disabled={saving || loading}>
                {saving ? text.saving : text.save}
              </button>
            </div>

            {loading ? (
              <div style={{ color: 'var(--muted)', padding: '16px 0' }}>{text.loading}</div>
            ) : sources.length === 0 ? (
              <div style={{ color: 'var(--muted)', padding: '16px 0' }}>{text.empty}</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {sources.map((source, index) => (
                  <div
                    key={`${source.value || 'new'}-${index}`}
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragEnter={() => onDragEnter(index)}
                    onDragOver={event => event.preventDefault()}
                    onDragEnd={onDragEnd}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px minmax(160px, 1fr) minmax(120px, 180px) auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: 10,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--surface)',
                    }}
                  >
                    <span style={{ color: 'var(--muted)', cursor: 'grab', userSelect: 'none' }}>⋮</span>
                    <input
                      className="input"
                      value={source.label}
                      onChange={event => updateSource(index, event.target.value)}
                      onBlur={() => save()}
                    />
                    <code style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {source.value || text.willBeCreated}
                    </code>
                    <button className="btn btn-danger" type="button" onClick={() => deleteSource(index)} disabled={saving || sources.length <= 1}>
                      {text.delete}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
