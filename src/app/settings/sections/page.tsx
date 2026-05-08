'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Scope = 'client' | 'case'

type SectionSetting = {
  scope: Scope
  sectionKey: string
  title: string
  description: string
  visible: boolean
  sortOrder: number
}

type CustomField = {
  id: number
  label: string
  type: string
  placeholder?: string | null
  options?: string[] | null
  required: boolean
  active: boolean
  sortOrder: number
}

type CustomSection = {
  id: number
  scope: Scope
  title: string
  description?: string | null
  active: boolean
  sortOrder: number
  fields: CustomField[]
}

type OrganizationSettings = {
  mosAutoRemindersEnabled: boolean
}

const fieldTypes = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Большое поле' },
  { value: 'date', label: 'Дата' },
  { value: 'number', label: 'Число' },
  { value: 'checkbox', label: 'Чекбокс' },
  { value: 'select', label: 'Список выбора' },
]

function optionsToText(options: unknown) {
  return Array.isArray(options) ? options.map(String).join('\n') : ''
}

export default function SectionSettingsPage() {
  const [settings, setSettings] = useState<SectionSetting[]>([])
  const [sections, setSections] = useState<CustomSection[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingOrganizationSettings, setSavingOrganizationSettings] = useState(false)
  const [message, setMessage] = useState('')
  const [newSection, setNewSection] = useState({ scope: 'client' as Scope, title: '', description: '' })
  const [newFields, setNewFields] = useState<Record<number, any>>({})
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings>({
    mosAutoRemindersEnabled: true,
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [uiRes, customRes, organizationRes] = await Promise.all([
      fetch('/api/ui-section-settings', { cache: 'no-store' }),
      fetch('/api/custom-sections', { cache: 'no-store' }),
      fetch('/api/organization-settings', { cache: 'no-store' }),
    ])
    const ui = await uiRes.json()
    const custom = await customRes.json()
    const organization = await organizationRes.json()
    setSettings(ui.settings || [])
    setSections(custom.sections || [])
    setOrganizationSettings({
      mosAutoRemindersEnabled: organization?.settings?.mosAutoRemindersEnabled !== false,
    })
    setCanManage(Boolean(ui.canManage || custom.canManage || organization.canManage))
    setLoading(false)
  }

  const grouped = useMemo(() => ({
    client: settings.filter(item => item.scope === 'client'),
    case: settings.filter(item => item.scope === 'case'),
  }), [settings])

  const customGrouped = useMemo(() => ({
    client: sections.filter(item => item.scope === 'client'),
    case: sections.filter(item => item.scope === 'case'),
  }), [sections])

  function toggle(scope: Scope, sectionKey: string) {
    setSettings(current => current.map(item => (
      item.scope === scope && item.sectionKey === sectionKey
        ? { ...item, visible: !item.visible }
        : item
    )))
    setMessage('')
  }

  async function saveStandard() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/ui-section-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    setSaving(false)
    setMessage(res.ok ? 'Настройки стандартных секций сохранены' : 'Не удалось сохранить настройки')
  }

  async function saveOrganizationSettings(nextSettings = organizationSettings) {
    setSavingOrganizationSettings(true)
    setMessage('')
    const res = await fetch('/api/organization-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: nextSettings }),
    })
    setSavingOrganizationSettings(false)
    if (res.ok) {
      const data = await res.json()
      setOrganizationSettings({
        mosAutoRemindersEnabled: data?.settings?.mosAutoRemindersEnabled !== false,
      })
      setMessage('Настройки автоматических напоминаний сохранены')
    } else {
      setMessage('Не удалось сохранить настройки автоматических напоминаний')
    }
  }

  async function createSection() {
    if (!newSection.title.trim()) return
    const res = await fetch('/api/custom-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSection),
    })
    if (res.ok) {
      setNewSection({ scope: 'client', title: '', description: '' })
      setMessage('Секция добавлена')
      await loadAll()
    } else {
      setMessage('Не удалось добавить секцию')
    }
  }

  async function updateSection(section: CustomSection) {
    const res = await fetch(`/api/custom-sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section),
    })
    setMessage(res.ok ? 'Секция сохранена' : 'Не удалось сохранить секцию')
    if (res.ok) await loadAll()
  }

  async function deleteSection(id: number) {
    if (!confirm('Удалить секцию вместе с ее полями и заполненными значениями?')) return
    const res = await fetch(`/api/custom-sections/${id}`, { method: 'DELETE' })
    setMessage(res.ok ? 'Секция удалена' : 'Не удалось удалить секцию')
    if (res.ok) await loadAll()
  }

  async function createField(sectionId: number) {
    const draft = newFields[sectionId] || {}
    if (!String(draft.label || '').trim()) return
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, ...draft }),
    })
    if (res.ok) {
      setNewFields(current => ({ ...current, [sectionId]: {} }))
      setMessage('Поле добавлено')
      await loadAll()
    } else {
      setMessage('Не удалось добавить поле')
    }
  }

  async function updateField(field: CustomField) {
    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
    setMessage(res.ok ? 'Поле сохранено' : 'Не удалось сохранить поле')
    if (res.ok) await loadAll()
  }

  async function deleteField(id: number) {
    if (!confirm('Удалить поле и все заполненные значения этого поля?')) return
    const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setMessage(res.ok ? 'Поле удалено' : 'Не удалось удалить поле')
    if (res.ok) await loadAll()
  }

  function patchSection(id: number, patch: Partial<CustomSection>) {
    setSections(current => current.map(section => section.id === id ? { ...section, ...patch } : section))
  }

  function patchField(sectionId: number, fieldId: number, patch: Partial<CustomField>) {
    setSections(current => current.map(section => section.id !== sectionId ? section : {
      ...section,
      fields: section.fields.map(field => field.id === fieldId ? { ...field, ...patch } : field),
    }))
  }

  function renderStandardGroup(title: string, items: SectionSetting[]) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 14 }}><span>▦</span>{title}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(item => (
            <label key={`${item.scope}:${item.sectionKey}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: item.visible ? 'var(--card)' : 'var(--bg)' }}>
              <span>
                <strong style={{ display: 'block', marginBottom: 3 }}>{item.title}</strong>
                <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13 }}>{item.description}</span>
              </span>
              <input type="checkbox" checked={item.visible} disabled={!canManage} onChange={() => toggle(item.scope, item.sectionKey)} style={{ width: 20, height: 20 }} />
            </label>
          ))}
        </div>
      </div>
    )
  }

  function renderFieldEditor(section: CustomSection, field: CustomField) {
    return (
      <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 150px 100px 90px 90px auto auto', gap: 8, alignItems: 'start', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
        <input className="input" value={field.label} disabled={!canManage} onChange={e => patchField(section.id, field.id, { label: e.target.value })} />
        <select className="input" value={field.type} disabled={!canManage} onChange={e => patchField(section.id, field.id, { type: e.target.value })}>
          {fieldTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <input className="input" type="number" value={field.sortOrder} disabled={!canManage} onChange={e => patchField(section.id, field.id, { sortOrder: Number(e.target.value) })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <input type="checkbox" checked={field.required} disabled={!canManage} onChange={e => patchField(section.id, field.id, { required: e.target.checked })} />
          Обяз.
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <input type="checkbox" checked={field.active} disabled={!canManage} onChange={e => patchField(section.id, field.id, { active: e.target.checked })} />
          Вкл.
        </label>
        <button className="btn btn-light" disabled={!canManage} onClick={() => updateField(field)}>Сохранить</button>
        <button className="btn btn-danger" disabled={!canManage} onClick={() => deleteField(field.id)}>Удалить</button>
        {field.type === 'select' && (
          <textarea
            className="input"
            style={{ gridColumn: '1 / -1', minHeight: 70 }}
            placeholder="Варианты списка, каждый с новой строки"
            value={optionsToText(field.options)}
            disabled={!canManage}
            onChange={e => patchField(section.id, field.id, { options: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
          />
        )}
      </div>
    )
  }

  function renderCustomGroup(title: string, items: CustomSection[]) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 14 }}><span>▣</span>{title}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Пользовательских секций пока нет.</div>}
          {items.map(section => {
            const draft = newFields[section.id] || {}
            return (
              <div key={section.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 90px 90px auto auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input className="input" value={section.title} disabled={!canManage} onChange={e => patchSection(section.id, { title: e.target.value })} />
                  <input className="input" value={section.description || ''} disabled={!canManage} placeholder="Описание секции" onChange={e => patchSection(section.id, { description: e.target.value })} />
                  <input className="input" type="number" value={section.sortOrder} disabled={!canManage} onChange={e => patchSection(section.id, { sortOrder: Number(e.target.value) })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={section.active} disabled={!canManage} onChange={e => patchSection(section.id, { active: e.target.checked })} />
                    Вкл.
                  </label>
                  <button className="btn btn-light" disabled={!canManage} onClick={() => updateSection(section)}>Сохранить секцию</button>
                  <button className="btn btn-danger" disabled={!canManage} onClick={() => deleteSection(section.id)}>Удалить</button>
                </div>
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {section.fields.map(field => renderFieldEditor(section, field))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 150px 1fr auto', gap: 8, alignItems: 'start' }}>
                  <input className="input" placeholder="Название поля" disabled={!canManage} value={draft.label || ''} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, label: e.target.value } }))} />
                  <select className="input" disabled={!canManage} value={draft.type || 'text'} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, type: e.target.value } }))}>
                    {fieldTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <textarea className="input" style={{ minHeight: 38 }} placeholder="Для списка: варианты с новой строки" disabled={!canManage || (draft.type || 'text') !== 'select'} value={draft.options || ''} onChange={e => setNewFields(current => ({ ...current, [section.id]: { ...draft, options: e.target.value } }))} />
                  <button className="btn btn-primary" disabled={!canManage} onClick={() => createField(section.id)}>+ Поле</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Поля и сектора</div>
          <div className="page-subtitle">Стандартные блоки и собственные поля для карточки клиента и дела</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-light" href="/settings">Назад</Link>
          {canManage && <button className="btn btn-primary" onClick={saveStandard} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить видимость'}</button>}
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 1120 }}>
        {message && <div className="card" style={{ marginBottom: 16 }}>{message}</div>}
        {!canManage && !loading && (
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Доступ только для администратора фирмы</strong>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>Сотрудник может заполнять данные, но не может менять структуру секций и полей.</div>
          </div>
        )}
        {loading ? (
          <div className="card">Загрузка...</div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>
                <span>🔔</span>Автоматические напоминания
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={organizationSettings.mosAutoRemindersEnabled}
                    disabled={!canManage}
                    onChange={e => {
                      setOrganizationSettings(current => ({
                        ...current,
                        mosAutoRemindersEnabled: e.target.checked,
                      }))
                      setMessage('')
                    }}
                    style={{ width: 20, height: 20, marginTop: 2 }}
                  />
                  <span>
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      Автоматические напоминания с момента передачи документов в MOS
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                      Если включено, при сохранении дела с датой передачи в MOS автоматически создаются 4 напоминания:
                      донести документы, получить ID, запросить логин и пароль от кабинета, проверить статус.
                    </span>
                  </span>
                </label>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingOrganizationSettings}
                    onClick={() => saveOrganizationSettings()}
                  >
                    {savingOrganizationSettings ? 'Сохранение...' : 'Сохранить'}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}><span>＋</span>Добавить свою секцию</div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1.3fr auto', gap: 10 }}>
                <select className="input" disabled={!canManage} value={newSection.scope} onChange={e => setNewSection(current => ({ ...current, scope: e.target.value as Scope }))}>
                  <option value="client">Карточка клиента</option>
                  <option value="case">Дело клиента</option>
                </select>
                <input className="input" disabled={!canManage} placeholder="Название секции" value={newSection.title} onChange={e => setNewSection(current => ({ ...current, title: e.target.value }))} />
                <input className="input" disabled={!canManage} placeholder="Короткое описание" value={newSection.description} onChange={e => setNewSection(current => ({ ...current, description: e.target.value }))} />
                <button className="btn btn-primary" disabled={!canManage || !newSection.title.trim()} onClick={createSection}>+ Секция</button>
              </div>
            </div>

            <h3 style={{ margin: '8px 0 12px' }}>Свои секции</h3>
            {renderCustomGroup('Карточка клиента', customGrouped.client)}
            {renderCustomGroup('Дело клиента', customGrouped.case)}

            <h3 style={{ margin: '22px 0 12px' }}>Стандартные секции</h3>
            {renderStandardGroup('Карточка клиента', grouped.client)}
            {renderStandardGroup('Дело клиента', grouped.case)}
          </>
        )}
      </div>
    </div>
  )
}
