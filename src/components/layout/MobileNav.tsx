'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const LABELS: Record<string, Record<string, string>> = {
  ru: { dashboard: 'Пульт', cases: 'Дела', leads: 'Лиды', clients: 'Клиенты', stages: 'Этапы', tasks: 'Задачи', calendar: 'Календарь' },
  uk: { dashboard: 'Пульт', cases: 'Справи', leads: 'Ліди', clients: 'Клієнти', stages: 'Етапи', tasks: 'Завдання', calendar: 'Календар' },
  pl: { dashboard: 'Pulpit', cases: 'Sprawy', leads: 'Leady', clients: 'Klienci', stages: 'Etapy', tasks: 'Zadania', calendar: 'Kalendarz' },
}

const NAV_ITEMS = [
  {
    href: '/dashboard', key: 'dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: '/cases', key: 'cases',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: '/leads', key: 'leads',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-8-8 18-2-7-8-3z"/>
        <path d="M13 14l-3-3"/>
      </svg>
    ),
  },
  {
    href: '/clients', key: 'clients',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/stages', key: 'stages',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16"/>
        <path d="M4 12h16"/>
        <path d="M4 18h16"/>
        <path d="M8 4v16"/>
        <path d="M16 4v16"/>
        <path d="m9.5 12 1.5 1.5 3.5-4"/>
      </svg>
    ),
  },
  {
    href: '/tasks', key: 'tasks',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.1 : 0}/>
        <polyline points="9 11 12 14 22 4"/>
      </svg>
    ),
  },
  {
    href: '/calendar', key: 'calendar',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
]

const THEME_LABELS: Record<string, Record<string, string>> = {
  ru: { light: 'Светлая', dark: 'Темная', slate: 'Slate', language: 'Язык', theme: 'Тема', logout: 'Выйти' },
  uk: { light: 'Світла', dark: 'Темна', slate: 'Slate', language: 'Мова', theme: 'Тема', logout: 'Вийти' },
  pl: { light: 'Jasny', dark: 'Ciemny', slate: 'Slate', language: 'Język', theme: 'Motyw', logout: 'Wyloguj' },
}

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [lang, setLang] = useState<'ru' | 'uk' | 'pl'>('ru')
  const [theme, setTheme] = useState<'light' | 'dark' | 'slate'>('light')
  const [actionsOpen, setActionsOpen] = useState(false)

  useEffect(() => {
    setLang((localStorage.getItem('rezi_lang') || 'ru') as 'ru' | 'uk' | 'pl')
    setTheme((localStorage.getItem('rezi_theme') || 'light') as 'light' | 'dark' | 'slate')
    const handler = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const t = LABELS[lang]
  const actionText = THEME_LABELS[lang] || THEME_LABELS.ru

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  function changeLang(next: 'ru' | 'uk' | 'pl') {
    setLang(next)
    localStorage.setItem('rezi_lang', next)
    window.dispatchEvent(new CustomEvent('langchange', { detail: next }))
    setActionsOpen(false)
  }

  function changeTheme(next: 'light' | 'dark' | 'slate') {
    setTheme(next)
    localStorage.setItem('rezi_theme', next)
    document.documentElement.setAttribute('data-theme', next)
    setActionsOpen(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            height: 72px !important;
            min-height: 72px !important;
            align-items: stretch !important;
          }
          .mobile-nav-item {
            min-width: 0;
            padding: 7px 2px 8px !important;
            gap: 3px !important;
          }
          .mobile-nav-icon {
            width: 30px !important;
            height: 30px !important;
          }
          .mobile-nav-icon svg {
            width: 24px;
            height: 24px;
          }
          .mobile-nav-label {
            font-size: 10px !important;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .mobile-actions-button {
            display: flex;
            position: fixed;
            right: 12px;
            bottom: calc(78px + env(safe-area-inset-bottom));
            z-index: 120;
            width: 42px;
            height: 42px;
            border-radius: 999px;
            border: 1px solid rgba(6,182,212,0.38);
            background: var(--sidebar-bg);
            color: var(--sidebar-text);
            align-items: center;
            justify-content: center;
            box-shadow: 0 12px 28px rgba(0,0,0,0.24);
          }
          .mobile-actions-panel {
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: calc(126px + env(safe-area-inset-bottom));
            z-index: 130;
            border: 1px solid var(--sidebar-border);
            border-radius: 14px;
            background: var(--sidebar-bg);
            color: var(--sidebar-text);
            padding: 12px;
            box-shadow: 0 18px 42px rgba(0,0,0,0.34);
          }
          .mobile-actions-row {
            display: grid;
            grid-template-columns: 68px repeat(3, 1fr);
            gap: 6px;
            align-items: center;
            margin-bottom: 8px;
          }
          .mobile-actions-row:last-child { margin-bottom: 0; }
          .mobile-actions-label {
            color: var(--sidebar-muted);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .mobile-actions-chip {
            border: 0;
            border-radius: 8px;
            padding: 8px 6px;
            background: var(--sidebar-btn);
            color: var(--sidebar-muted);
            font-size: 12px;
            font-weight: 800;
          }
          .mobile-actions-chip.active {
            background: var(--brand);
            color: #fff;
          }
          .mobile-actions-logout {
            width: 100%;
            margin-top: 8px;
            border: 1px solid rgba(248,113,113,0.35);
            border-radius: 10px;
            padding: 10px;
            background: rgba(248,113,113,0.12);
            color: #fecaca;
            font-weight: 800;
          }
        }
        @media (min-width: 769px) {
          .mobile-actions-button,
          .mobile-actions-panel { display: none; }
        }
      `}</style>

      {actionsOpen && (
        <div className="mobile-actions-panel">
          <div className="mobile-actions-row">
            <div className="mobile-actions-label">{actionText.language}</div>
            {(['ru', 'uk', 'pl'] as const).map(next => (
              <button key={next} onClick={() => changeLang(next)} className={`mobile-actions-chip ${lang === next ? 'active' : ''}`}>
                {next === 'uk' ? 'UA' : next.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mobile-actions-row">
            <div className="mobile-actions-label">{actionText.theme}</div>
            {(['light', 'dark', 'slate'] as const).map(next => (
              <button key={next} onClick={() => changeTheme(next)} className={`mobile-actions-chip ${theme === next ? 'active' : ''}`}>
                {actionText[next]}
              </button>
            ))}
          </div>
          <button onClick={logout} className="mobile-actions-logout">{actionText.logout}</button>
        </div>
      )}

      <button type="button" className="mobile-actions-button" onClick={() => setActionsOpen(v => !v)} aria-label="Menu">
        ⋯
      </button>

      <nav className="mobile-bottom-nav">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} className={`mobile-nav-item ${active ? 'active' : ''}`}>
              <span className="mobile-nav-icon">{item.icon(active)}</span>
              <span className="mobile-nav-label">{t[item.key] || item.key}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
