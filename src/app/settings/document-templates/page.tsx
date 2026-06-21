'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DOCUMENT_TEMPLATE_VARIABLES } from '@/lib/documentTemplates'
import { useLanguage } from '@/context/LanguageContext'

type TemplateType = {
  type: string
  label: string
}

type Template = {
  id: number
  type: string
  name: string
  fileName: string
  updatedAt: string
}

const templateText = {
  ru: {
    subtitle: 'Добавляйте несколько DOCX-бланков договоров, доверенностей и других документов для одной организации',
    loadFailed: 'Не удалось загрузить шаблоны',
    saveFailed: 'Не удалось сохранить шаблон',
    deleteFailed: 'Не удалось удалить шаблон',
    deleteConfirm: 'Удалить шаблон "{name}"?',
    addTitle: 'Добавить шаблон',
    documentType: 'Тип документа',
    name: 'Название',
    namePlaceholder: 'Например: Umowa - Pakiet Podstawowy',
    saving: 'Сохраняю...',
    addTemplate: 'Добавить шаблон',
    emptyType: 'Шаблонов этого типа пока нет',
    updated: 'Обновлён',
    delete: 'Удалить',
    variablesTitle: 'Переменные для Word',
    variablesHint: 'Вставьте нужные переменные прямо в текст договора. При генерации система заменит их на данные клиента, дела и плана платежей.',
    locale: 'ru-RU',
  },
  uk: {
    subtitle: 'Додавайте кілька DOCX-бланків договорів, довіреностей та інших документів для однієї організації',
    loadFailed: 'Не вдалося завантажити шаблони',
    saveFailed: 'Не вдалося зберегти шаблон',
    deleteFailed: 'Не вдалося видалити шаблон',
    deleteConfirm: 'Видалити шаблон "{name}"?',
    addTitle: 'Додати шаблон',
    documentType: 'Тип документа',
    name: 'Назва',
    namePlaceholder: 'Наприклад: Umowa - Pakiet Podstawowy',
    saving: 'Зберігаю...',
    addTemplate: 'Додати шаблон',
    emptyType: 'Шаблонів цього типу поки немає',
    updated: 'Оновлено',
    delete: 'Видалити',
    variablesTitle: 'Змінні для Word',
    variablesHint: 'Вставте потрібні змінні прямо в текст договору. Під час генерації система замінить їх на дані клієнта, справи та плану платежів.',
    locale: 'uk-UA',
  },
  pl: {
    subtitle: 'Dodawaj kilka szablonów DOCX umów, pełnomocnictw i innych dokumentów dla jednej organizacji',
    loadFailed: 'Nie udało się załadować szablonów',
    saveFailed: 'Nie udało się zapisać szablonu',
    deleteFailed: 'Nie udało się usunąć szablonu',
    deleteConfirm: 'Usunąć szablon „{name}”?',
    addTitle: 'Dodaj szablon',
    documentType: 'Typ dokumentu',
    name: 'Nazwa',
    namePlaceholder: 'Na przykład: Umowa - Pakiet Podstawowy',
    saving: 'Zapisuję...',
    addTemplate: 'Dodaj szablon',
    emptyType: 'Nie ma jeszcze szablonów tego typu',
    updated: 'Zaktualizowano',
    delete: 'Usuń',
    variablesTitle: 'Zmienne do Worda',
    variablesHint: 'Wstaw potrzebne zmienne bezpośrednio w treść umowy. Podczas generowania system zastąpi je danymi klienta, sprawy i planu płatności.',
    locale: 'pl-PL',
  },
}

export default function DocumentTemplatesPage() {
  const { lang, t } = useLanguage()
  const text = templateText[lang] || templateText.ru
  const [types, setTypes] = useState<TemplateType[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedType, setSelectedType] = useState('client_contract')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const templatesByType = useMemo(() => {
    return types.map(type => ({
      ...type,
      templates: templates.filter(template => template.type === type.type),
    }))
  }, [templates, types])

  async function loadTemplates() {
    setError('')
    const res = await fetch('/api/document-templates', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || text.loadFailed)
      return
    }
    setTypes(data.types || [])
    setTemplates(data.templates || [])
    if (!selectedType && data.types?.[0]?.type) setSelectedType(data.types[0].type)
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  async function uploadTemplate() {
    if (!file || !name.trim()) return
    setLoading('upload')
    setError('')
    try {
      const formData = new FormData()
      formData.append('type', selectedType)
      formData.append('name', name.trim())
      formData.append('file', file)
      const res = await fetch('/api/document-templates', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || text.saveFailed)
        return
      }
      setName('')
      setFile(null)
      await loadTemplates()
    } finally {
      setLoading(null)
    }
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(text.deleteConfirm.replace('{name}', template.name))) return
    setLoading(`delete-${template.id}`)
    setError('')
    try {
      const res = await fetch(`/api/document-templates/${template.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || text.deleteFailed)
        return
      }
      await loadTemplates()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('document_templates_title')}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>{text.addTitle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(220px, 1fr)', gap: 10, marginBottom: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">{text.documentType}</label>
                <select className="select" value={selectedType} onChange={event => setSelectedType(event.target.value)}>
                  {types.map(type => <option key={type.type} value={type.type}>{type.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">{text.name}</label>
                <input
                  className="input"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder={text.namePlaceholder}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', gap: 10, alignItems: 'center' }}>
              <input
                key={file ? file.name : 'empty'}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={event => setFile(event.target.files?.[0] || null)}
              />
              <button
                className="btn btn-primary"
                onClick={uploadTemplate}
                disabled={!file || !name.trim() || loading === 'upload'}
              >
                {loading === 'upload' ? text.saving : text.addTemplate}
              </button>
            </div>
          </div>

          {templatesByType.map(group => (
            <div key={group.type} className="card">
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{group.label}</div>
              {group.templates.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.emptyType}</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {group.templates.map(template => (
                    <div
                      key={template.id}
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) auto', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{template.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{text.updated}: {new Date(template.updatedAt).toLocaleDateString(text.locale)}</div>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={template.fileName}>
                        {template.fileName}
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={() => deleteTemplate(template)}
                        disabled={loading === `delete-${template.id}`}
                      >
                        {text.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{text.variablesTitle}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
              {text.variablesHint}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DOCUMENT_TEMPLATE_VARIABLES.map(variable => (
                <code key={variable} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 12, background: 'var(--bg)' }}>
                  {variable}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
