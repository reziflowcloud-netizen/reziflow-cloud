'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const LABELS: Record<string, Record<string, string>> = {
  ru: { dashboard: 'Пульт', cases: 'Дела', clients: 'Клиенты', tasks: 'Задачи', calendar: 'Календарь' },
  uk: { dashboard: 'Пульт', cases: 'Справи', clients: 'Клієнти', tasks: 'Завдання', calendar: 'Календар' },
  pl: { dashboard: 'Pulpit', cases: 'Sprawy', clients: 'Klienci', tasks: 'Zadania', calendar: 'Kalendarz' },
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
    href: '/stages', key: 'Этапы',
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

export default function MobileNav() {
  const pathname = usePathname()
  const [lang, setLang] = useState<'ru' | 'uk' | 'pl'>('ru')

  useEffect(() => {
    setLang((localStorage.getItem('rezi_lang') || 'ru') as 'ru' | 'uk' | 'pl')
    const handler = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const t = LABELS[lang]

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
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
  )
}
