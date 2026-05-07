'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type SectionSetting = {
  scope: 'client' | 'case'
  sectionKey: string
  title: string
  description: string
  visible: boolean
  sortOrder: number
}

export default function SectionSettingsPage() {
  const [settings, setSettings] = useState<SectionSetting[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/ui-section-settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setSettings(data.settings || [])
        setCanManage(Boolean(data.canManage))
      })
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => ({
    client: settings.filter(item => item.scope === 'client'),
    case: settings.filter(item => item.scope === 'case'),
  }), [settings])

  function toggle(scope: 'client' | 'case', sectionKey: string) {
    setSettings(current => current.map(item => (
      item.scope === scope && item.sectionKey === sectionKey
        ? { ...item, visible: !item.visible }
        : item
    )))
    setMessage('')
  }

  async function save() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/ui-section-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    setSaving(false)
    setMessage(res.ok ? 'Настройки сохранены' : 'Не удалось сохранить настройки')
  }

  function renderGroup(title: string, items: SectionSetting[]) {
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
              <input
                type="checkbox"
                checked={item.visible}
                disabled={!canManage}
                onChange={() => toggle(item.scope, item.sectionKey)}
                style={{ width: 20, height: 20 }}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Поля и сектора</div>
          <div className="page-subtitle">Что показывать в карточке клиента и деле</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-light" href="/settings">Назад</Link>
          {canManage && <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>}
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 900 }}>
        {message && <div className="card" style={{ marginBottom: 16, color: message.includes('Не') ? '#dc2626' : '#16a34a' }}>{message}</div>}
        {!canManage && !loading && (
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Доступ только для администратора фирмы</strong>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>Сотрудник может работать с данными, но не может менять видимость полей и секторов.</div>
          </div>
        )}
        {loading ? (
          <div className="card">Загрузка...</div>
        ) : (
          <>
            {renderGroup('Карточка клиента', grouped.client)}
            {renderGroup('Дело клиента', grouped.case)}
          </>
        )}
      </div>
    </div>
  )
}
