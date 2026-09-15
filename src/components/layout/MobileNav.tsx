'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { Lang } from '@/lib/translations'
import MoreBottomSheet, { type MobileSessionUser } from './MoreBottomSheet'
import styles from './MobileNavigation.module.css'

type NavKey = 'dashboard' | 'leads' | 'cases' | 'clients' | 'more'

const LABELS: Record<Lang, Record<NavKey, string>> = {
  ru: { dashboard: 'Пульт', leads: 'Лиды', cases: 'Дела', clients: 'Клиенты', more: 'Ещё' },
  uk: { dashboard: 'Пульт', leads: 'Ліди', cases: 'Справи', clients: 'Клієнти', more: 'Ще' },
  pl: { dashboard: 'Pulpit', leads: 'Leady', cases: 'Sprawy', clients: 'Klienci', more: 'Więcej' },
}

const MORE_SECTION_PREFIXES = ['/tasks', '/stages', '/calendar', '/settings']

function NavIcon({ type, active }: { type: NavKey; active: boolean }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (type === 'dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity="0.14" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? 'currentColor' : 'none'} fillOpacity="0.14" />
      </svg>
    )
  }

  if (type === 'leads') {
    return (
      <svg {...common}>
        <path d="M3 11 21 3l-8 18-2.2-7.1L3 11Z" fill={active ? 'currentColor' : 'none'} fillOpacity="0.12" />
        <path d="m13.2 13.8-3.1-3.1" />
      </svg>
    )
  }

  if (type === 'cases') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" fill={active ? 'currentColor' : 'none'} fillOpacity="0.12" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </svg>
    )
  }

  if (type === 'clients') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" fill={active ? 'currentColor' : 'none'} fillOpacity="0.12" />
        <path d="M23 21v-2a4 4 0 0 0-3.2-3.9M16.5 3.2a4 4 0 0 1 0 7.6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="5" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  )
}

function routeIsActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang } = useLanguage()
  const [moreOpen, setMoreOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState<MobileSessionUser | null>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const labels = LABELS[lang]
  const moreSectionActive = MORE_SECTION_PREFIXES.some(prefix => pathname.startsWith(prefix))

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data) setSessionUser(data as MobileSessionUser)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const items: Array<{ key: Exclude<NavKey, 'more'>; href: string }> = [
    { key: 'dashboard', href: '/dashboard' },
    { key: 'leads', href: '/leads' },
    { key: 'cases', href: '/cases' },
    { key: 'clients', href: '/clients' },
  ]

  return (
    <>
      <MoreBottomSheet
        open={moreOpen}
        pathname={pathname}
        user={sessionUser}
        onClose={() => {
          setMoreOpen(false)
          window.requestAnimationFrame(() => moreButtonRef.current?.focus())
        }}
        onLogout={logout}
      />
      <nav className={styles.bottomNav} aria-label="Mobile navigation">
        {items.map(item => {
          const active = routeIsActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.icon}><NavIcon type={item.key} active={active} /></span>
              <span className={styles.label}>{labels[item.key]}</span>
            </Link>
          )
        })}
        <button
          ref={moreButtonRef}
          type="button"
          className={`${styles.navItem} ${moreOpen || moreSectionActive ? styles.active : ''}`}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => setMoreOpen(value => !value)}
        >
          <span className={styles.icon}><NavIcon type="more" active={moreOpen || moreSectionActive} /></span>
          <span className={styles.label}>{labels.more}</span>
        </button>
      </nav>
    </>
  )
}
