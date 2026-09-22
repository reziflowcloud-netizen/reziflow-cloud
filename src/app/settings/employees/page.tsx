'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

interface Employee { id: number; name: string; active: boolean; userId: number | null }
interface CrmUser { id: number; name: string; email: string; role: string; restrictedAccess: boolean }
interface LinkImpact { routingRules: number; leads: number; cases: number; restrictedAccess: boolean }

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
    account: 'CRM-аккаунт', unlinked: 'Не привязано', accountHint: 'Связь задаётся явно; имя сотрудника не используется для подбора аккаунта.',
    linkedElsewhere: 'Уже привязан к другому сотруднику', linkError: 'Не удалось изменить связь. Обновите страницу и повторите.',
    linkWarning: 'Изменение связи может повлиять на доступ и маршрутизацию. Продолжить?',
    impact: (value: LinkImpact) => `Правила маршрутизации: ${value.routingRules}; лиды: ${value.leads}; дела: ${value.cases}; ограниченный доступ: ${value.restrictedAccess ? 'да' : 'нет'}. Записи автоматически не изменятся.`,
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
    account: 'CRM-акаунт', unlinked: 'Не прив’язано', accountHint: 'Зв’язок задається явно; ім’я співробітника не використовується для підбору акаунта.',
    linkedElsewhere: 'Уже прив’язано до іншого співробітника', linkError: 'Не вдалося змінити зв’язок. Оновіть сторінку та повторіть.',
    linkWarning: 'Зміна зв’язку може вплинути на доступ і маршрутизацію. Продовжити?',
    impact: (value: LinkImpact) => `Правила маршрутизації: ${value.routingRules}; ліди: ${value.leads}; справи: ${value.cases}; обмежений доступ: ${value.restrictedAccess ? 'так' : 'ні'}. Записи автоматично не зміняться.`,
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
    account: 'Konto CRM', unlinked: 'Nie powiązano', accountHint: 'Powiązanie jest jawne; nazwa pracownika nie służy do dopasowania konta.',
    linkedElsewhere: 'Już powiązane z innym pracownikiem', linkError: 'Nie udało się zmienić powiązania. Odśwież stronę i spróbuj ponownie.',
    linkWarning: 'Zmiana powiązania może wpłynąć na dostęp i routing. Kontynuować?',
    impact: (value: LinkImpact) => `Reguły routingu: ${value.routingRules}; leady: ${value.leads}; sprawy: ${value.cases}; ograniczony dostęp: ${value.restrictedAccess ? 'tak' : 'nie'}. Rekordy nie zostaną automatycznie zmienione.`,
  },
}

export default function EmployeesSettingsPage() {
  const { lang, t } = useLanguage()
  const text = employeeText[lang] || employeeText.ru
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/settings'
  const [employees, setEmployees] = useState<Employee[]>([])
  const [users, setUsers] = useState<CrmUser[]>([])
  const [canManage, setCanManage] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : []))
    fetch('/api/users').then(async response => {
      setCanManage(response.headers.get('X-Can-Manage-Users') === 'true')
      const data = await response.json()
      setUsers(Array.isArray(data) ? data : [])
    })
  }, [])

  async function changeIdentity(emp: Employee, targetUserId: number | null) {
    if (!canManage || busyId !== null || emp.userId === targetUserId) return
    setBusyId(emp.id)
    setError('')
    try {
      const impactResponse = await fetch(`/api/employees/${emp.id}/identity`, { cache: 'no-store' })
      if (!impactResponse.ok) throw new Error('impact')
      const current = await impactResponse.json()
      if (current.userId !== emp.userId) throw new Error('stale')
      const affected = current.impact as LinkImpact
      const targetRestricted = users.find(item => item.id === targetUserId)?.restrictedAccess === true
      let confirmed = false
      if (affected.routingRules || affected.leads || affected.cases || affected.restrictedAccess || targetRestricted) {
        confirmed = window.confirm(`${text.linkWarning}\n\n${text.impact({ ...affected, restrictedAccess: affected.restrictedAccess || targetRestricted })}`)
        if (!confirmed) return
      }
      const update = async (confirmImpact: boolean) => fetch(`/api/employees/${emp.id}/identity`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUserId: emp.userId, userId: targetUserId, confirmImpact }),
      })
      let response = await update(confirmed)
      if (response.status === 409 && !confirmed) {
        const body = await response.json()
        if (body.impact && window.confirm(`${text.linkWarning}\n\n${text.impact(body.impact)}`)) response = await update(true)
      }
      if (!response.ok) throw new Error('update')
      const refreshed = await fetch('/api/employees', { cache: 'no-store' })
      const data = await refreshed.json()
      if (!refreshed.ok || !Array.isArray(data)) throw new Error('refresh')
      setEmployees(data)
    } catch {
      setError(text.linkError)
    } finally {
      setBusyId(null)
    }
  }

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
        <div className="card" style={{ maxWidth: 900 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>{text.accountHint}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {employees.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '16px 0', fontSize: 13 }}>{text.empty}</div>
            )}
            {employees.map(emp => (
              <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', opacity: emp.active ? 1 : 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                    {canManage && <button onClick={() => toggleActive(emp)} style={{ fontSize: 11, background: 'var(--border)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text)' }}>
                      {emp.active ? text.hide : text.activate}
                    </button>}
                    {canManage && <button onClick={() => { setEditingId(emp.id); setEditName(emp.name) }} style={{ background: 'var(--border)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>✏️</button>}
                    {canManage && <button onClick={() => remove(emp.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>}
                  </>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
                <span style={{ minWidth: 105, fontWeight: 700 }}>{text.account}:</span>
                <select className="input" aria-label={`${text.account}: ${emp.name}`} value={emp.userId ?? ''}
                  disabled={!canManage || busyId !== null}
                  onChange={event => changeIdentity(emp, event.target.value ? Number(event.target.value) : null)}
                  style={{ flex: '1 1 240px', minWidth: 0, maxWidth: 450 }}>
                  <option value="">{text.unlinked}</option>
                  {users.map(account => {
                    const assignedElsewhere = employees.some(item => item.id !== emp.id && item.userId === account.id)
                    return <option key={account.id} value={account.id} disabled={assignedElsewhere}>
                      {account.name} · {account.email} · {account.role}{assignedElsewhere ? ` · ${text.linkedElsewhere}` : ''}
                    </option>
                  })}
                </select>
              </label>
              </div>
            ))}
          </div>
          {canManage && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()} placeholder={text.placeholder} style={{ flex: 1 }} />
            <button onClick={add} className="btn btn-primary" disabled={!newName.trim()}>{text.add}</button>
          </div>}
        </div>
      </div>
    </div>
  )
}
