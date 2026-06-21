// src/app/settings/users/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

interface UserItem {
  id: number
  name: string
  email: string
  role: string
  restrictedAccess?: boolean
  avatarUrl?: string | null
  createdAt: string
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#fef3c7', color: '#92400e' },
  employee: { bg: '#eff6ff', color: '#1d4ed8' },
}

const userText = {
  ru: {
    title: '👥 Пользователи системы',
    subtitle: 'Управление доступом к LegalHub',
    addUser: '+ Добавить пользователя',
    fillAll: 'Заполните все поля',
    passwordMin: 'Пароль должен быть не менее 6 символов',
    createError: 'Ошибка создания',
    created: 'Пользователь "{name}" успешно создан',
    nameEmailRequired: 'Имя и email обязательны',
    saveError: 'Ошибка сохранения',
    updated: 'Данные обновлены',
    deleteConfirm: 'Удалить пользователя "{name}"? Это действие нельзя отменить.',
    deleteError: 'Ошибка удаления',
    deleted: 'Пользователь "{name}" удалён',
    newUser: 'Новый пользователь',
    name: 'Имя',
    nameRequired: 'Имя *',
    passwordRequired: 'Пароль * (мин. 6 символов)',
    enterPassword: 'Введите пароль',
    role: 'Роль',
    roles: { admin: 'Администратор', employee: 'Сотрудник' },
    restrictTitle: 'Ограничить доступ только своими делами и клиентами',
    restrictDesc: 'Сотрудник увидит только назначенные ему дела, клиентов, лиды, задачи и финансовые показатели.',
    creating: 'Создание...',
    createUser: '✅ Создать пользователя',
    cancel: 'Отмена',
    noUsers: 'Нет пользователей',
    newPassword: 'Новый пароль (оставьте пустым чтобы не менять)',
    newPasswordPlaceholder: 'Новый пароль...',
    avatar: 'Аватарка',
    avatarHint: 'Можно загрузить JPG, PNG или WebP до 5 MB',
    saving: 'Сохранение...',
    save: '💾 Сохранить',
    restricted: 'Ограничен',
    edit: '✏️ Изменить',
    hintTitle: 'Роли:',
    hintText: 'Администратор имеет полный доступ. Сотрудник может просматривать и редактировать дела и клиентов. Каждый пользователь входит в систему через страницу входа используя свой email и пароль.',
    locale: 'ru-RU',
  },
  uk: {
    title: '👥 Користувачі системи',
    subtitle: 'Керування доступом до LegalHub',
    addUser: '+ Додати користувача',
    fillAll: 'Заповніть усі поля',
    passwordMin: 'Пароль має бути не менше 6 символів',
    createError: 'Помилка створення',
    created: 'Користувача "{name}" успішно створено',
    nameEmailRequired: 'Ім’я та email обов’язкові',
    saveError: 'Помилка збереження',
    updated: 'Дані оновлено',
    deleteConfirm: 'Видалити користувача "{name}"? Цю дію не можна скасувати.',
    deleteError: 'Помилка видалення',
    deleted: 'Користувача "{name}" видалено',
    newUser: 'Новий користувач',
    name: 'Ім’я',
    nameRequired: 'Ім’я *',
    passwordRequired: 'Пароль * (мін. 6 символів)',
    enterPassword: 'Введіть пароль',
    role: 'Роль',
    roles: { admin: 'Адміністратор', employee: 'Співробітник' },
    restrictTitle: 'Обмежити доступ тільки своїми справами і клієнтами',
    restrictDesc: 'Співробітник побачить тільки призначені йому справи, клієнтів, ліди, завдання та фінансові показники.',
    creating: 'Створення...',
    createUser: '✅ Створити користувача',
    cancel: 'Скасувати',
    noUsers: 'Користувачів немає',
    newPassword: 'Новий пароль (залиште порожнім, щоб не змінювати)',
    newPasswordPlaceholder: 'Новий пароль...',
    avatar: 'Аватарка',
    avatarHint: 'Можна завантажити JPG, PNG або WebP до 5 MB',
    saving: 'Збереження...',
    save: '💾 Зберегти',
    restricted: 'Обмежений',
    edit: '✏️ Змінити',
    hintTitle: 'Ролі:',
    hintText: 'Адміністратор має повний доступ. Співробітник може переглядати і редагувати справи та клієнтів. Кожен користувач входить у систему через сторінку входу, використовуючи свій email і пароль.',
    locale: 'uk-UA',
  },
  pl: {
    title: '👥 Użytkownicy systemu',
    subtitle: 'Zarządzanie dostępem do LegalHub',
    addUser: '+ Dodaj użytkownika',
    fillAll: 'Uzupełnij wszystkie pola',
    passwordMin: 'Hasło musi mieć co najmniej 6 znaków',
    createError: 'Błąd tworzenia',
    created: 'Użytkownik „{name}” został utworzony',
    nameEmailRequired: 'Imię i email są wymagane',
    saveError: 'Błąd zapisu',
    updated: 'Dane zaktualizowane',
    deleteConfirm: 'Usunąć użytkownika „{name}”? Tej czynności nie można cofnąć.',
    deleteError: 'Błąd usuwania',
    deleted: 'Użytkownik „{name}” został usunięty',
    newUser: 'Nowy użytkownik',
    name: 'Imię',
    nameRequired: 'Imię *',
    passwordRequired: 'Hasło * (min. 6 znaków)',
    enterPassword: 'Wpisz hasło',
    role: 'Rola',
    roles: { admin: 'Administrator', employee: 'Pracownik' },
    restrictTitle: 'Ogranicz dostęp tylko do własnych spraw i klientów',
    restrictDesc: 'Pracownik zobaczy tylko przypisane do niego sprawy, klientów, leady, zadania i wskaźniki finansowe.',
    creating: 'Tworzenie...',
    createUser: '✅ Utwórz użytkownika',
    cancel: 'Anuluj',
    noUsers: 'Brak użytkowników',
    newPassword: 'Nowe hasło (zostaw puste, aby nie zmieniać)',
    newPasswordPlaceholder: 'Nowe hasło...',
    avatar: 'Avatar',
    avatarHint: 'Można przesłać JPG, PNG albo WebP do 5 MB',
    saving: 'Zapisywanie...',
    save: '💾 Zapisz',
    restricted: 'Ograniczony',
    edit: '✏️ Edytuj',
    hintTitle: 'Role:',
    hintText: 'Administrator ma pełny dostęp. Pracownik może przeglądać i edytować sprawy oraz klientów. Każdy użytkownik loguje się przez stronę logowania, używając swojego emaila i hasła.',
    locale: 'pl-PL',
  },
}

export default function UsersSettingsPage() {
  const { lang, t } = useLanguage()
  const text = userText[lang] || userText.ru
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [canManageUsers, setCanManageUsers] = useState(true)

  const [newForm, setNewForm] = useState({ name: '', email: '', password: '', role: 'employee', restrictedAccess: false })
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '', restrictedAccess: false })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (res.ok) {
      setCanManageUsers(res.headers.get('X-Can-Manage-Users') !== 'false')
      setUsers(await res.json())
    }
  }

  function setN(k: string, v: any) {
    setNewForm(p => ({
      ...p,
      [k]: v,
      ...(k === 'role' && v !== 'employee' ? { restrictedAccess: false } : {}),
    }))
  }
  function setE(k: string, v: any) {
    setEditForm(p => ({
      ...p,
      [k]: v,
      ...(k === 'role' && v !== 'employee' ? { restrictedAccess: false } : {}),
    }))
  }

  async function createUser() {
    setError(''); setSuccess('')
    if (!newForm.name.trim() || !newForm.email.trim() || !newForm.password.trim()) {
      setError(text.fillAll); return
    }
    if (newForm.password.length < 6) {
      setError(text.passwordMin); return
    }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || text.createError); setSaving(false); return }
    setUsers(p => [...p, data])
    setNewForm({ name: '', email: '', password: '', role: 'employee', restrictedAccess: false })
    setShowNew(false)
    setSuccess(text.created.replace('{name}', data.name))
    setSaving(false)
    setTimeout(() => setSuccess(''), 4000)
  }

  function startEdit(u: UserItem) {
    setEditingId(u.id)
    setEditForm({ name: u.name, email: u.email, role: u.role, password: '', restrictedAccess: u.restrictedAccess === true })
    setAvatarFile(null)
    setError('')
  }

  async function saveEdit(id: number) {
    setError('')
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError(text.nameEmailRequired); return
    }
    if (canManageUsers && editForm.password && editForm.password.length < 6) {
      setError(text.passwordMin); return
    }
    setSaving(true)
    const body: any = canManageUsers
      ? { name: editForm.name, email: editForm.email, role: editForm.role, restrictedAccess: editForm.role === 'employee' && editForm.restrictedAccess }
      : { name: editForm.name }
    if (canManageUsers && editForm.password) body.password = editForm.password
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || text.saveError); setSaving(false); return }
    let updatedUser = data
    if (avatarFile) {
      const fd = new FormData()
      fd.append('file', avatarFile)
      const avatarRes = await fetch(`/api/users/${id}/avatar`, { method: 'POST', body: fd })
      const avatarData = await avatarRes.json().catch(() => ({}))
      if (!avatarRes.ok) { setError(avatarData.error || 'Avatar upload error'); setSaving(false); return }
      updatedUser = avatarData
    }
    setUsers(p => p.map(u => u.id === id ? updatedUser : u))
    setEditingId(null)
    setAvatarFile(null)
    setSuccess(text.updated)
    router.refresh()
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(text.deleteConfirm.replace('{name}', name))) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || text.deleteError); return }
    setUsers(p => p.filter(u => u.id !== id))
    setSuccess(text.deleted.replace('{name}', name))
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{text.title}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/settings" className="btn btn-secondary">{t('back')}</Link>
          <button onClick={() => { setShowNew(true); setEditingId(null); setError('') }} className="btn btn-primary" style={{ display: canManageUsers ? undefined : 'none' }}>
            {text.addUser}
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Уведомления */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
          </div>
        )}
        {success && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#14532d', fontSize: 13 }}>
            ✅ {success}
          </div>
        )}

        {/* Форма создания нового пользователя */}
        {showNew && canManageUsers && (
          <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--brand)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{text.newUser}</div>
              <button onClick={() => { setShowNew(false); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">{text.nameRequired}</label>
                <input className="input" value={newForm.name} onChange={e => setN('name', e.target.value)} placeholder="Иван Иванов" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" value={newForm.email} onChange={e => setN('email', e.target.value)} placeholder="ivan@example.com" />
              </div>
              <div className="form-group">
                <label className="label">{text.passwordRequired}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPasswords['new'] ? 'text' : 'password'}
                    value={newForm.password}
                    onChange={e => setN('password', e.target.value)}
                    placeholder={text.enterPassword}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    onClick={() => setShowPasswords(p => ({ ...p, new: !p['new'] }))}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
                  >{showPasswords['new'] ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div className="form-group">
                <label className="label">{text.role}</label>
                <select className="select" value={newForm.role} onChange={e => setN('role', e.target.value)}>
                  <option value="employee">{text.roles.employee}</option>
                  <option value="admin">{text.roles.admin}</option>
                </select>
              </div>
              <label
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--bg)',
                  opacity: newForm.role === 'employee' ? 1 : 0.62,
                }}
              >
                <input
                  type="checkbox"
                  checked={newForm.restrictedAccess}
                  disabled={newForm.role !== 'employee'}
                  onChange={e => setN('restrictedAccess', e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{text.restrictTitle}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {text.restrictDesc}
                  </span>
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createUser} className="btn btn-primary" disabled={saving}>
                {saving ? text.creating : text.createUser}
              </button>
              <button onClick={() => { setShowNew(false); setError('') }} className="btn btn-secondary">{text.cancel}</button>
            </div>
          </div>
        )}

        {/* Список пользователей */}
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {users.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>{text.noUsers}</div>
            )}
            {users.map((u, idx) => (
              <div key={u.id}>
                {idx > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}
                {editingId === u.id ? (
                  /* Режим редактирования */
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group">
                        <label className="label">{text.name}</label>
                        <input className="input" value={editForm.name} onChange={e => setE('name', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="label">Email</label>
                        <input className="input" type="email" value={editForm.email} onChange={e => setE('email', e.target.value)} disabled={!canManageUsers} />
                      </div>
                      <div className="form-group" style={{ display: canManageUsers ? undefined : 'none' }}>
                        <label className="label">{text.newPassword}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input"
                            type={showPasswords[u.id] ? 'text' : 'password'}
                            value={editForm.password}
                            onChange={e => setE('password', e.target.value)}
                            placeholder={text.newPasswordPlaceholder}
                            style={{ paddingRight: 40 }}
                          />
                          <button
                            onClick={() => setShowPasswords(p => ({ ...p, [u.id]: !p[u.id] }))}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
                          >{showPasswords[u.id] ? '🙈' : '👁'}</button>
                        </div>
                      </div>
                      <div className="form-group" style={{ display: canManageUsers ? undefined : 'none' }}>
                        <label className="label">{text.role}</label>
                        <select className="select" value={editForm.role} onChange={e => setE('role', e.target.value)}>
                          <option value="employee">{text.roles.employee}</option>
                          <option value="admin">{text.roles.admin}</option>
                        </select>
                      </div>
                      <label
                        style={{
                          gridColumn: '1 / -1',
                          display: canManageUsers ? 'flex' : 'none',
                          gap: 10,
                          alignItems: 'flex-start',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 12,
                          background: 'var(--bg)',
                          opacity: editForm.role === 'employee' ? 1 : 0.62,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editForm.restrictedAccess}
                          disabled={editForm.role !== 'employee'}
                          onChange={e => setE('restrictedAccess', e.target.checked)}
                          style={{ marginTop: 3 }}
                        />
                        <span>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{text.restrictTitle}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                            {text.restrictDesc}
                          </span>
                        </span>
                      </label>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="label">{text.avatar}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="avatar" style={{ width: 44, height: 44, objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>
                              {u.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <input className="input" type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} />
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                              {avatarFile ? avatarFile.name : text.avatarHint}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveEdit(u.id)} className="btn btn-primary" disabled={saving}>
                        {saving ? text.saving : text.save}
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn btn-secondary">{text.cancel}</button>
                    </div>
                  </div>
                ) : (
                  /* Режим просмотра */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="avatar" style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div className="avatar" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                    </div>
                    <span className="badge" style={{ ...(ROLE_COLORS[u.role] || { bg: '#f3f4f6', color: '#374151' }) }}>
                      {text.roles[u.role as keyof typeof text.roles] || u.role}
                    </span>
                    {u.role === 'employee' && u.restrictedAccess && (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {text.restricted}
                      </span>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 80 }}>
                      {new Date(u.createdAt).toLocaleDateString(text.locale)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(u)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                        {text.edit}
                      </button>
                      <button onClick={() => deleteUser(u.id, u.name)}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626', display: canManageUsers ? undefined : 'none' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Подсказка */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
          💡 <strong>{text.hintTitle}</strong> {text.hintText}
        </div>
      </div>
    </div>
  )
}
