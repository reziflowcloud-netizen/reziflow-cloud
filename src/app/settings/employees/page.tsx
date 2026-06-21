'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

interface Employee { id: number; name: string; active: boolean }

const employeeText = {
  ru: {
    title: '👤 Ответственные сотрудники',
    subtitle: 'Список сотрудников для назначения на дела',
    createError: 'Ошибка создания',
    deleteConfirm: 'Удалить сотрудника?',
    empty: 'Нет сотрудников. Добавьте первого ↓',
    inactive: 'Неактивен',
    hide: '⏸ Скрыть',
    activate: '▶ Активировать',
    placeholder: 'Имя сотрудника...',
    add: '+ Добавить',
  },
  uk: {
    title: '👤 Відповідальні співробітники',
    subtitle: 'Список співробітників для призначення на справи',
    createError: 'Помилка створення',
    deleteConfirm: 'Видалити співробітника?',
    empty: 'Співробітників немає. Додайте першого ↓',
    inactive: 'Неактивний',
    hide: '⏸ Приховати',
    activate: '▶ Активувати',
    placeholder: 'Ім’я співробітника...',
    add: '+ Додати',
  },
  pl: {
    title: '👤 Odpowiedzialni pracownicy',
    subtitle: 'Lista pracowników do przypisywania do spraw',
    createError: 'Błąd tworzenia',
    deleteConfirm: 'Usunąć pracownika?',
    empty: 'Brak pracowników. Dodaj pierwszego ↓',
    inactive: 'Nieaktywny',
    hide: '⏸ Ukryj',
    activate: '▶ Aktywuj',
    placeholder: 'Imię pracownika...',
    add: '+ Dodaj',
  },
}

export default function EmployeesSettingsPage() {
  const { lang, t } = useLanguage()
  const text = employeeText[lang] || employeeText.ru
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/settings'
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : []))
  }, [])

  async function add() {
    if (!newName.trim()) return
    const res = await fetch('/api/employees', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (!res.ok) { setError(text.createError); return }
    const emp = await res.json()
    setEmployees(p => [...p, emp])
    setNewName('')
  }

  async function save(id: number) {
    if (!editName.trim()) return
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    const updated = await res.json()
    setEmployees(p => p.map(e => e.id === id ? updated : e))
    setEditingId(null)
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: emp.name, active: !emp.active }),
    })
    const updated = await res.json()
    setEmployees(p => p.map(e => e.id === emp.id ? updated : e))
  }

  async function remove(id: number) {
    if (!confirm(text.deleteConfirm)) return
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    setEmployees(p => p.filter(e => e.id !== id))
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
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>{error}</div>}
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {employees.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '16px 0', fontSize: 13 }}>{text.empty}</div>
            )}
            {employees.map(emp => (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', opacity: emp.active ? 1 : 0.5 }}>
                {editingId === emp.id ? (
                  <>
                    <input className="input" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') save(emp.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13 }} />
                    <button onClick={() => save(emp.id)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>💾</button>
                    <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>✕</button>
                  </>
                ) : (
                  <>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{emp.name[0]}</div>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{emp.name}</span>
                    {!emp.active && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '2px 6px', borderRadius: 6 }}>{text.inactive}</span>}
                    <button onClick={() => toggleActive(emp)} style={{ fontSize: 11, background: 'var(--border)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text)' }}>
                      {emp.active ? text.hide : text.activate}
                    </button>
                    <button onClick={() => { setEditingId(emp.id); setEditName(emp.name) }} style={{ background: 'var(--border)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>✏️</button>
                    <button onClick={() => remove(emp.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()} placeholder={text.placeholder} style={{ flex: 1 }} />
            <button onClick={add} className="btn btn-primary" disabled={!newName.trim()}>{text.add}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
