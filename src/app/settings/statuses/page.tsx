'use client'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/context/LanguageContext'

function isArchiveStatusName(name: string) {
  return ['архив', 'архів', 'archive', 'archiwum'].includes(String(name || '').trim().toLowerCase())
}

export default function StatusesPage() {
  const { t } = useLanguage()
  const [statuses, setStatuses] = useState<any[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/statuses').then(r => r.json()).then(d => setStatuses(Array.isArray(d) ? d : []))
  }, [])

  async function add() {
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, order: statuses.length }),
      })
      let s: any
      try { s = await res.json() } catch { s = {} }
      if (!res.ok) { setError(s?.error || `Ошибка сервера: ${res.status}`); return }
      setStatuses(prev => [...prev, s])
      setName('')
      setColor('#3b82f6')
    } catch { setError('Ошибка соединения с сервером.') }
    finally { setLoading(false) }
  }

  async function updateStatus(id: number) {
    setError('')
    try {
      const res = await fetch(`/api/statuses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      let updated: any
      try { updated = await res.json() } catch { updated = {} }
      if (!res.ok) { setError(updated?.error || 'Ошибка при обновлении'); return }
      setStatuses(prev => prev.map(s => s.id === id ? updated : s))
      setEditingId(null)
    } catch { setError('Ошибка соединения.') }
  }

  async function deleteStatus(id: number) {
    const status = statuses.find(s => s.id === id)
    if (status && isArchiveStatusName(status.name)) {
      setError(t('archive_status_protected'))
      return
    }
    if (!confirm('Удалить статус?')) return
    setError('')
    try {
      await fetch(`/api/statuses/${id}`, { method: 'DELETE' })
      setStatuses(prev => prev.filter(s => s.id !== id))
    } catch { setError('Ошибка при удалении.') }
  }

  function startEdit(s: any) {
    setEditingId(s.id)
    setEditName(s.name)
    setEditColor(s.color)
    setError('')
  }

  // Drag reorder
  function onDragStart(idx: number) {
    dragItem.current = idx
    setDraggingIdx(idx)
  }
  function onDragEnter(idx: number) { dragOver.current = idx }
  function onDragEnd() {
    const from = dragItem.current
    const to = dragOver.current
    if (from === null || to === null || from === to) {
      setDraggingIdx(null)
      return
    }
    const reordered = [...statuses]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setStatuses(reordered)
    setDraggingIdx(null)
    dragItem.current = null
    dragOver.current = null
    // Save new order
    reordered.forEach((s, i) => {
      fetch(`/api/statuses/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, color: s.color, order: i }),
      })
    })
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('statuses_title')}</div>
          <div className="page-subtitle">{t('statuses_sub')}</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 640 }}>
          {/* Add form */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title"><span>➕</span>Добавить статус</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="label">Название</label>
                <input className="input" value={name}
                  onChange={e => { setName(e.target.value); setError('') }}
                  placeholder="Напр.: Ожидание решения"
                  onKeyDown={e => e.key === 'Enter' && add()} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Цвет</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ height: 38, width: 60, padding: 4, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
              </div>
              <button onClick={add} className="btn btn-primary" disabled={loading || !name.trim()}>
                {loading ? 'Добавление...' : '+ Добавить'}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>Список статусов — всего: {statuses.length}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>⠿ Перетащите для сортировки</div>
            </div>

            {statuses.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>Нет статусов</div>
            )}

            {statuses.map((s, i) => (
              <div key={s.id}
                draggable={editingId !== s.id}
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0',
                  borderBottom: i < statuses.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: draggingIdx === i ? 0.4 : 1,
                  background: dragOver.current === i && draggingIdx !== null && draggingIdx !== i ? '#f0f9ff' : 'transparent',
                  borderRadius: 6,
                  transition: 'opacity 0.15s',
                  cursor: editingId === s.id ? 'default' : 'grab',
                }}>

                {/* Drag handle */}
                {editingId !== s.id && (
                  <span style={{ color: '#d1d5db', fontSize: 16, flexShrink: 0, userSelect: 'none' }}>⠿</span>
                )}

                {editingId === s.id ? (
                  <>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                      style={{ width: 32, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                    <input className="input" value={editName}
                      onChange={e => setEditName(e.target.value)}
                      style={{ flex: 1 }}
                      onKeyDown={e => e.key === 'Enter' && updateStatus(s.id)}
                      autoFocus />
                    <button onClick={() => updateStatus(s.id)} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>💾 Сохранить</button>
                    <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>Отмена</button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 8 }}>
                      {new Date(s.createdAt).toLocaleDateString('ru')}
                    </span>
                    <button onClick={() => startEdit(s)}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button
                      onClick={() => deleteStatus(s.id)}
                      disabled={isArchiveStatusName(s.name)}
                      title={isArchiveStatusName(s.name) ? t('archive_status_protected') : undefined}
                      style={{
                        background: '#fef2f2',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 10px',
                        cursor: isArchiveStatusName(s.name) ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        color: '#dc2626',
                        opacity: isArchiveStatusName(s.name) ? 0.4 : 1,
                      }}
                    >🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
