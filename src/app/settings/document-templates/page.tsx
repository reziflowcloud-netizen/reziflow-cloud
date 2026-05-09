'use client'

import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_TEMPLATE_VARIABLES } from '@/lib/documentTemplates'

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

export default function DocumentTemplatesPage() {
  const [types, setTypes] = useState<TemplateType[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const templatesByType = useMemo(() => {
    return Object.fromEntries(templates.map(template => [template.type, template]))
  }, [templates])

  async function loadTemplates() {
    setError('')
    const res = await fetch('/api/document-templates', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Не удалось загрузить шаблоны')
      return
    }
    setTypes(data.types || [])
    setTemplates(data.templates || [])
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  async function uploadTemplate(type: string) {
    const file = files[type]
    if (!file) return
    setLoading(type)
    setError('')
    try {
      const formData = new FormData()
      formData.append('type', type)
      formData.append('file', file)
      const res = await fetch('/api/document-templates', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить шаблон')
        return
      }
      setFiles(current => ({ ...current, [type]: null }))
      await loadTemplates()
    } finally {
      setLoading(null)
    }
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(`Удалить шаблон "${template.name}"?`)) return
    setLoading(`delete-${template.id}`)
    setError('')
    try {
      const res = await fetch(`/api/document-templates/${template.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Не удалось удалить шаблон')
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
          <div className="page-title">Шаблоны документов</div>
          <div className="page-subtitle">Загрузите DOCX-бланки организации для автоматического заполнения из дела клиента</div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
          {types.map(item => {
            const template = templatesByType[item.type]
            return (
              <div key={item.type} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                      {template ? `Загружен файл: ${template.fileName}` : 'Шаблон пока не загружен'}
                    </div>
                  </div>
                  {template && (
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteTemplate(template)}
                      disabled={loading === `delete-${template.id}`}
                    >
                      Удалить
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={event => setFiles(current => ({ ...current, [item.type]: event.target.files?.[0] || null }))}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => uploadTemplate(item.type)}
                    disabled={!files[item.type] || loading === item.type}
                  >
                    {loading === item.type ? 'Сохраняю...' : template ? 'Заменить шаблон' : 'Загрузить шаблон'}
                  </button>
                </div>
              </div>
            )
          })}

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Переменные для Word</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Вставьте нужные переменные прямо в текст договора. При генерации система заменит их на данные клиента и дела.
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
