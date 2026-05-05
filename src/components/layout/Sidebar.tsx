'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const TRANSLATIONS: Record<string, Record<string, string>> = {
  ru: {
    menu: 'Меню', system: 'Система',
    dashboard: 'Пульт', cases: 'Дела', clients: 'Клиенты',
    tasks: 'Задачи', calendar: 'Календарь', settings: 'Настройки',
    logout: 'Выйти', theme_light: 'Светлая', theme_dark: 'Тёмная',
  },
  uk: {
    menu: 'Меню', system: 'Система',
    dashboard: 'Пульт', cases: 'Справи', clients: 'Клієнти',
    tasks: 'Завдання', calendar: 'Календар', settings: 'Налаштування',
    logout: 'Вийти', theme_light: 'Світла', theme_dark: 'Темна',
  },
  pl: {
    menu: 'Menu', system: 'System',
    dashboard: 'Pulpit', cases: 'Sprawy', clients: 'Klienci',
    tasks: 'Zadania', calendar: 'Kalendarz', settings: 'Ustawienia',
    logout: 'Wyloguj', theme_light: 'Jasny', theme_dark: 'Ciemny',
  },
}

export default function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [lang, setLang] = useState<'ru' | 'uk' | 'pl'>('ru')

  useEffect(() => {
    const savedTheme = (localStorage.getItem('rezi_theme') || 'light') as 'light' | 'dark'
    const savedLang = (localStorage.getItem('rezi_lang') || 'ru') as 'ru' | 'uk' | 'pl'
    setTheme(savedTheme)
    setLang(savedLang)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('rezi_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function changeLang(l: 'ru' | 'uk' | 'pl') {
    setLang(l)
    localStorage.setItem('rezi_lang', l)
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const t = TRANSLATIONS[lang]

  const navItems = [
    { href: '/dashboard', key: 'dashboard', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    )},
    { href: '/cases', key: 'cases', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    )},
    { href: '/clients', key: 'clients', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )},
    { href: '/stages', key: 'Этапы', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16"/>
        <path d="M4 12h16"/>
        <path d="M4 18h16"/>
        <path d="M8 4v16"/>
        <path d="M16 4v16"/>
        <path d="m9.5 12 1.5 1.5 3.5-4"/>
      </svg>
    )},
    { href: '/tasks', key: 'tasks', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    )},
    { href: '/calendar', key: 'calendar', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
  ]

  const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#2563eb"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#rg)"/>
          <path d="M9 9 L16 16 L9 23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M16 9 L23 16 L16 23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
        </svg>
        <span>ReziFlow <em>Cloud</em></span>
      </div>

      {/* Nav */}
      <div style={{ flex: 1 }}>
        <div className="sidebar-label">{t.menu}</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`sidebar-item ${isActive(item.href) ? 'active' : ''}`}>
            {item.icon}
            {t[item.key] || item.key}
          </Link>
        ))}

        <div className="sidebar-label" style={{ marginTop: 12 }}>{t.system}</div>
        <Link href="/settings" className={`sidebar-item ${pathname.startsWith('/settings') ? 'active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {t.settings}
        </Link>
      </div>

      {/* Bottom controls */}
      <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: 12 }}>
        {/* Language switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, padding: '0 12px' }}>
          {(['ru', 'uk', 'pl'] as const).map(l => (
            <button key={l} onClick={() => changeLang(l)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                background: lang === l ? 'var(--brand)' : 'var(--sidebar-btn)',
                color: lang === l ? 'white' : 'var(--sidebar-muted)',
                transition: 'all 0.15s',
              }}>{l}</button>
          ))}
        </div>

        {/* Theme toggle */}
        <div style={{ padding: '0 12px', marginBottom: 10 }}>
          <button onClick={toggleTheme}
            style={{
              width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              background: 'var(--sidebar-btn)', color: 'var(--sidebar-muted)',
              transition: 'all 0.15s',
            }}>
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
            {theme === 'light' ? t.theme_dark : t.theme_light}
          </button>
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
          <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{userName?.[0]?.toUpperCase() || 'U'}</div>
          <span style={{ fontSize: 13, color: 'var(--sidebar-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{userName}</span>
        </div>

        <button onClick={handleLogout}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 2,
            background: 'transparent', color: 'var(--sidebar-muted)', textAlign: 'left',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {t.logout}
        </button>
      </div>
    </div>
  )
}
