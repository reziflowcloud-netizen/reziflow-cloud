'use client'
import { useState, useEffect } from 'react'

function getDateLabel(date: Date): { label: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { label: `Просрочено ${Math.abs(diff)} дн.`, color: '#dc2626' }
  if (diff === 0) return { label: 'Сегодня', color: '#dc2626' }
  if (diff === 1) return { label: 'Завтра', color: '#f59e0b' }
  if (diff <= 7) return { label: `Через ${diff} дн.`, color: '#6b7280' }
  return { label: new Date(date).toLocaleDateString('ru', { day: 'numeric', month: 'short' }), color: '#6b7280' }
}

export default function UpcomingEvents() {
  const [tasks, setTasks] = useState<any[]>([])
  const [priorities, setPriorities] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [editingTask, setEditingTask] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/task-priorities').then(r => r.json()),
    ]).then(([t, p]) => {
      const taskList = Array.isArray(t) ? t : []
      const prioList = Array.isArray(p) ? p : []
      setTasks(taskList)
      setPriorities(prioList)
      buildItems(taskList)
    })
  }, [])

  function taskMeta(task: any) {
    try { return JSON.parse(task?.description || '{}') || {} } catch { return {} }
  }

  function taskRelatedCaseId(task: any) {
    if (!task) return ''
    const meta = taskMeta(task)
    const refs = [meta.paymentPlan, meta.mosDocument, meta.autoReminder, meta.customCaseReminder, meta.quickCaseTask, meta.fingerprintsAppointment, meta.predictedDecision]
    const metaCaseId = refs.find((ref: any) => ref?.caseId)?.caseId
    if (metaCaseId) return metaCaseId

    return cases.find((item: any) => {
      const number = String(item.caseNumber || '')
      return !!number && (
        String(task.title || '').includes(number) ||
        String(task.description || '').includes(number)
      )
    })?.id || ''
  }

  function buildItems(taskList: any[]) {
    const now = new Date()
    const in14 = new Date(now); in14.setDate(now.getDate() + 14)
    const result: any[] = []

    for (const t of taskList) {
      if (t.status === 'done') continue
      if (t.dueDate) {
        const due = new Date(t.dueDate)
        const isOverdue = due < now
        if (due <= in14 || isOverdue) {
          result.push({ task: t, date: due, type: 'task', isOverdue, sortKey: due.getTime() - (isOverdue ? 1e13 : 0) })
        }
      }
      try {
        const desc = JSON.parse(t.description || '{}')
        if (desc.reminderAt) {
          const rem = new Date(desc.reminderAt)
          const isOverdue = rem < now
          if (rem <= in14 || isOverdue) {
            result.push({ task: t, date: rem, type: 'reminder', reminderNote: desc.reminderNote || '', isOverdue, sortKey: rem.getTime() - (isOverdue ? 1e13 : 0) })
          }
        }
      } catch {}
    }

    result.sort((a, b) => a.sortKey - b.sortKey)
    setItems(result.slice(0, 10))
  }

  function getPriorityColor(priority: string) {
    return priorities.find(p => p.name === priority)?.color || '#6b7280'
  }

  function openEdit(item: any) {
    const t = item.task
    const meta = taskMeta(t)
    const reminderAt = meta.reminderAt || ''
    const reminderNote = meta.reminderNote || ''
    setEditingTask({ ...t, dueDate: t.dueDate?.slice(0, 10) || '', reminderAt: reminderAt ? reminderAt.slice(0, 16) : '', reminderNote })
    if (clients.length === 0 || cases.length === 0) {
      Promise.all([
        clients.length === 0 ? fetch('/api/clients').then(r => r.json()) : Promise.resolve(clients),
        cases.length === 0 ? fetch('/api/cases').then(r => r.json()) : Promise.resolve(cases),
      ]).then(([clientData, caseData]) => {
        if (Array.isArray(clientData)) setClients(clientData)
        if (Array.isArray(caseData)) setCases(caseData)
      })
    }
  }

  function setE(k: string, v: string) { setEditingTask((p: any) => ({ ...p, [k]: v })) }

  async function saveTask() {
    if (!editingTask) return
    setSaving(true)
    const meta = taskMeta(editingTask)
    await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editingTask.title,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate || null,
        clientName: editingTask.clientName || '',
        description: JSON.stringify({ ...meta, reminderAt: editingTask.reminderAt || null, reminderNote: editingTask.reminderNote || '' }),
      }),
    })
    const updated = await fetch('/api/tasks').then(r => r.json())
    setTasks(updated)
    buildItems(updated)
    setEditingTask(null)
    setSaving(false)
  }

  async function deleteTask(id: string) {
    if (!confirm('Удалить задачу?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    const updated = tasks.filter(t => t.id !== id)
    setTasks(updated)
    buildItems(updated)
    setEditingTask(null)
  }

  const editingTaskCaseId = taskRelatedCaseId(editingTask)

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '14px 0', fontSize: 13 }}>
      🎉 Нет предстоящих событий на ближайшие 14 дней
    </div>
  )

  return (
    <>
      <style>{`
        .upcoming-item {
          background: var(--bg);
          transition: background 0.15s;
        }
        .upcoming-item:hover {
          background: var(--border) !important;
        }
        .upcoming-item.upcoming-overdue {
          background: #fef2f2;
        }
        .upcoming-item.upcoming-overdue:hover {
          background: #fee2e2 !important;
        }
        [data-theme="dark"] .upcoming-item.upcoming-overdue {
          background: rgba(220, 38, 38, 0.15);
        }
        [data-theme="dark"] .upcoming-item.upcoming-overdue:hover {
          background: rgba(220, 38, 38, 0.25) !important;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => {
          const { label, color } = getDateLabel(item.date)
          const isRem = item.type === 'reminder'
          const accent = item.isOverdue ? '#dc2626' : isRem ? '#7c3aed' : getPriorityColor(item.task.priority)
          const timeStr = isRem ? item.date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : ''

          return (
            <div
              key={i}
              onClick={() => openEdit(item)}
              className={`upcoming-item${item.isOverdue ? ' upcoming-overdue' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                borderRadius: 8,
                borderLeft: `3px solid ${accent}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{isRem ? '⏰' : item.isOverdue ? '⚠️' : '✓'}</span>

              <span style={{ fontWeight: 500, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                {item.task.title}
              </span>

              {item.task.clientName && (
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👤 {item.task.clientName}
                </span>
              )}

              <span style={{ fontSize: 11, fontWeight: 600, color, background: color + '18', padding: '2px 8px', borderRadius: 10, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {label}{timeStr ? ` · ${timeStr}` : ''}
              </span>

              <span style={{ fontSize: 11, background: accent + '18', color: accent, padding: '2px 7px', borderRadius: 10, flexShrink: 0, display: isRem ? 'none' : 'inline' }}>
                {item.task.priority}
              </span>

              <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>›</span>
            </div>
          )
        })}
      </div>

      {editingTask && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingTask(null) }}
        >
          <div style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Редактировать задачу</div>
              <button onClick={() => setEditingTask(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="label">Название</label>
              <input className="input" value={editingTask.title} onChange={e => setE('title', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">Приоритет</label>
                <select className="select" value={editingTask.priority} onChange={e => setE('priority', e.target.value)}>
                  {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Клиент</label>
                <select className="select" value={editingTask.clientId || ''}
                  onChange={e => {
                    const c = clients.find((cl: any) => cl.id === e.target.value)
                    setEditingTask((p: any) => ({ ...p, clientId: e.target.value, clientName: c ? `${c.firstName} ${c.lastName}` : '' }))
                  }}>
                  <option value="">— Без клиента —</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Срок выполнения</label>
                <input className="input" type="date" value={editingTask.dueDate || ''} onChange={e => setE('dueDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">⏰ Напоминание</label>
                <input className="input" type="datetime-local" value={editingTask.reminderAt || ''} onChange={e => setE('reminderAt', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Примечание к напоминанию</label>
              <input className="input" value={editingTask.reminderNote || ''} onChange={e => setE('reminderNote', e.target.value)} placeholder="Что нужно сделать..." />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveTask} className="btn btn-primary" disabled={saving}>{saving ? 'Сохранение...' : '💾 Сохранить'}</button>
              {editingTaskCaseId && (
                <button
                  onClick={() => { window.location.href = `/cases/${editingTaskCaseId}` }}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Переход к этому делу
                </button>
              )}
              <button onClick={() => setEditingTask(null)} className="btn btn-secondary">Отмена</button>
              <button onClick={() => deleteTask(editingTask.id)}
                className="btn" style={{ marginLeft: 'auto', background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer' }}>
                🗑 Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
