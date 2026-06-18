'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import MetaMessageNotifier from '@/components/MetaMessageNotifier'

type Lang = 'ru' | 'uk' | 'pl'
type Theme = 'light' | 'dark' | 'slate'

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  ru: {
    menu: 'Меню', system: 'Система',
    dashboard: 'Dashboard', cases: 'Дела', clients: 'Клиенты',
    leads: 'Лиды', stages: 'Этапы', tasks: 'Задачи', calendar: 'Календарь', settings: 'Настройки',
    logout: 'Выйти', light: 'Светлая', dark: 'Тёмная', slate: 'Slate',
    administrator: 'Администратор', employee: 'Сотрудник', company: 'Фирма',
  },
  uk: {
    menu: 'Меню', system: 'Система',
    dashboard: 'Dashboard', cases: 'Справи', clients: 'Клієнти',
    leads: 'Ліди', stages: 'Етапи', tasks: 'Завдання', calendar: 'Календар', settings: 'Налаштування',
    logout: 'Вийти', light: 'Світла', dark: 'Темна', slate: 'Slate',
    administrator: 'Адміністратор', employee: 'Співробітник', company: 'Фірма',
  },
  pl: {
    menu: 'Menu', system: 'System',
    dashboard: 'Pulpit', cases: 'Sprawy', clients: 'Klienci',
    leads: 'Leady', stages: 'Etapy', tasks: 'Zadania', calendar: 'Kalendarz', settings: 'Ustawienia',
    logout: 'Wyloguj', light: 'Jasny', dark: 'Ciemny', slate: 'Slate',
    administrator: 'Administrator', employee: 'Pracownik', company: 'Firma',
  },
}

const THEME_OPTIONS: Theme[] = ['light', 'dark', 'slate']

function initials(name?: string) {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2) || 'U').toUpperCase()
}

export default function Sidebar({
  userName,
  userRole,
  userAvatarUrl,
  organizationName,
}: {
  userName?: string
  userRole?: string
  userAvatarUrl?: string
  organizationName?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>('light')
  const [lang, setLang] = useState<Lang>('ru')

  useEffect(() => {
    const savedThemeRaw = localStorage.getItem('rezi_theme') || 'light'
    const savedTheme = THEME_OPTIONS.includes(savedThemeRaw as Theme) ? savedThemeRaw as Theme : 'light'
    const savedLang = (localStorage.getItem('rezi_lang') || 'ru') as Lang
    setTheme(savedTheme)
    setLang(savedLang)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  function setThemeChoice(next: Theme) {
    setTheme(next)
    localStorage.setItem('rezi_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function changeLang(l: Lang) {
    setLang(l)
    localStorage.setItem('rezi_lang', l)
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const t = TRANSLATIONS[lang]
  const roleLabel = userRole === 'admin' || userRole === 'owner' ? t.administrator : t.employee

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
    { href: '/leads', key: 'leads', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-8-8 18-2-7-8-3z"/>
        <path d="M13 14l-3-3"/>
      </svg>
    )},
    { href: '/clients', key: 'clients', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )},
    { href: '/stages', key: 'stages', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M8 4v16"/><path d="M16 4v16"/>
      </svg>
    )},
    { href: '/tasks', key: 'tasks', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    )},
    { href: '/calendar', key: 'calendar', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
  ]

  const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <div className="sidebar">
      <MetaMessageNotifier />
      <div className="sidebar-logo">
        <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" className="sidebar-brand-logo" />
      </div>

      <div style={{ flex: 1 }}>
        <div className="sidebar-label">{t.menu}</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`sidebar-item ${isActive(item.href) ? 'active' : ''}`}>
            {item.icon}
            {(item as any).label || t[item.key] || item.key}
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

      <div className="sidebar-bottom">
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['ru', 'uk', 'pl'] as const).map(l => (
            <button key={l} onClick={() => changeLang(l)} className={`sidebar-segment ${lang === l ? 'active' : ''}`}>{l === 'uk' ? 'UA' : l.toUpperCase()}</button>
          ))}
        </div>

        <div className="theme-switcher">
          {THEME_OPTIONS.map(option => (
            <button key={option} onClick={() => setThemeChoice(option)} className={`sidebar-segment ${theme === option ? 'active' : ''}`}>
              {t[option]}
            </button>
          ))}
        </div>

        <div className="sidebar-profile">
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt={userName || 'User'} className="avatar sidebar-profile-avatar" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="avatar sidebar-profile-avatar">{initials(userName)}</div>
          )}
          <div className="sidebar-profile-text">
            <div className="sidebar-profile-name">{userName || 'User'}</div>
            <div className="sidebar-profile-role">{roleLabel}</div>
            {organizationName && <div className="sidebar-profile-org">{t.company}: {organizationName}</div>}
          </div>
        </div>

        <button onClick={handleLogout} className="sidebar-logout">
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
