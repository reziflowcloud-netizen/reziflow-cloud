'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { Lang } from '@/lib/translations'
import styles from './MobileNavigation.module.css'

type Theme = 'light' | 'dark' | 'slate'

const THEME_OPTIONS: Theme[] = ['light', 'dark', 'slate']
const LANGUAGE_OPTIONS: Lang[] = ['ru', 'uk', 'pl']

export interface MobileSessionUser {
  name?: string | null
  role?: string | null
  organizationName?: string | null
  isConferenceDemo?: boolean
}

interface MoreBottomSheetProps {
  open: boolean
  pathname: string
  user: MobileSessionUser | null
  onClose: () => void
  onLogout: () => void | Promise<void>
}

type MoreKey = 'title' | 'tasks' | 'stages' | 'calendar' | 'settings' | 'logout' | 'administrator' | 'employee' | 'close' | 'language' | 'theme' | Theme

const LABELS: Record<Lang, Record<MoreKey, string>> = {
  ru: {
    title: 'Ещё', tasks: 'Задачи', stages: 'Этапы', calendar: 'Календарь', settings: 'Настройки',
    logout: 'Выйти', administrator: 'Администратор', employee: 'Сотрудник', close: 'Закрыть',
    language: 'Язык', theme: 'Тема', light: 'Светлая', dark: 'Тёмная', slate: 'Slate',
  },
  uk: {
    title: 'Ще', tasks: 'Завдання', stages: 'Етапи', calendar: 'Календар', settings: 'Налаштування',
    logout: 'Вийти', administrator: 'Адміністратор', employee: 'Співробітник', close: 'Закрити',
    language: 'Мова', theme: 'Тема', light: 'Світла', dark: 'Темна', slate: 'Slate',
  },
  pl: {
    title: 'Więcej', tasks: 'Zadania', stages: 'Etapy', calendar: 'Kalendarz', settings: 'Ustawienia',
    logout: 'Wyloguj', administrator: 'Administrator', employee: 'Pracownik', close: 'Zamknij',
    language: 'Język', theme: 'Motyw', light: 'Jasny', dark: 'Ciemny', slate: 'Slate',
  },
}

function initials(name?: string | null) {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || 'U').toUpperCase()
}

function SheetIcon({ type }: { type: 'tasks' | 'stages' | 'calendar' | 'settings' | 'logout' }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (type === 'tasks') return <svg {...common}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  if (type === 'stages') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  if (type === 'calendar') return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
  if (type === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>
  return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>
}

export default function MoreBottomSheet({ open, pathname, user, onClose, onLogout }: MoreBottomSheetProps) {
  const { lang, setLang } = useLanguage()
  const labels = LABELS[lang]
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dragStartRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    if (!open) return
    const savedTheme = localStorage.getItem('rezi_theme')
    setTheme(THEME_OPTIONS.includes(savedTheme as Theme) ? savedTheme as Theme : 'light')
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => closeRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      dragOffsetRef.current = 0
      setDragOffset(0)
    }
  }, [open, onClose])

  if (!open) return null

  const canOpenSettings = Boolean(
    user
    && !user.isConferenceDemo
    && (user.role === 'admin' || user.role === 'owner'),
  )
  const roleLabel = user?.role === 'admin' || user?.role === 'owner' ? labels.administrator : labels.employee
  const destinations: Array<{ key: 'tasks' | 'stages' | 'calendar' | 'settings'; href: string }> = [
    { key: 'tasks', href: '/tasks' },
    { key: 'stages', href: '/stages' },
    { key: 'calendar', href: '/calendar' },
    ...(canOpenSettings ? [{ key: 'settings' as const, href: '/settings' }] : []),
  ]

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartRef.current = event.clientY
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some embedded browsers still dispatch pointer events without capture support.
    }
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return
    const nextOffset = Math.max(0, event.clientY - dragStartRef.current)
    dragOffsetRef.current = nextOffset
    setDragOffset(nextOffset)
  }

  function finishDrag() {
    dragStartRef.current = null
    if (dragOffsetRef.current > 72) {
      onClose()
      return
    }
    dragOffsetRef.current = 0
    setDragOffset(0)
  }

  function changeTheme(next: Theme) {
    setTheme(next)
    localStorage.setItem('rezi_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <div className={styles.sheetLayer}>
      <button type="button" className={styles.backdrop} aria-label={labels.title} onClick={onClose} />
      <div
        id="mobile-more-sheet"
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-more-title"
        style={{ transform: `translateY(${dragOffset}px)` }}
      >
        <div className={styles.dragZone} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
          <span className={styles.dragHandle} aria-hidden="true" />
        </div>
        <div className={styles.sheetHeader}>
          <h2 id="mobile-more-title">{labels.title}</h2>
          <button ref={closeRef} type="button" className={styles.closeButton} onClick={onClose} aria-label={labels.close}>×</button>
        </div>
        <div className={styles.tileGrid}>
          {destinations.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={`${styles.tile} ${active ? styles.tileActive : ''}`} aria-current={active ? 'page' : undefined}>
                <span className={styles.tileIcon}><SheetIcon type={item.key} /></span>
                <span>{labels[item.key]}</span>
                {active && <span className={styles.currentMark} aria-hidden="true">✓</span>}
              </Link>
            )
          })}
        </div>
        <div className={styles.preferenceGrid}>
          <div className={styles.preferenceGroup}>
            <span className={styles.preferenceLabel}>{labels.language}</span>
            <div className={styles.segmentedControl} aria-label={labels.language}>
              {LANGUAGE_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  className={`${styles.segmentButton} ${lang === option ? styles.segmentActive : ''}`}
                  aria-pressed={lang === option}
                  onClick={() => setLang(option)}
                >
                  {option === 'uk' ? 'UA' : option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.preferenceGroup}>
            <span className={styles.preferenceLabel}>{labels.theme}</span>
            <div className={styles.segmentedControl} aria-label={labels.theme}>
              {THEME_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  className={`${styles.segmentButton} ${theme === option ? styles.segmentActive : ''}`}
                  aria-pressed={theme === option}
                  onClick={() => changeTheme(option)}
                >
                  {labels[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.accountRow}>
          <div className={styles.accountBlock}>
            <div className={styles.avatar} aria-hidden="true">{initials(user?.name)}</div>
            <div className={styles.accountText}>
              <strong>{user?.name || '—'}</strong>
              <span>{roleLabel}{user?.organizationName ? ` · ${user.organizationName}` : ''}</span>
            </div>
          </div>
          <button type="button" className={styles.logoutButton} onClick={onLogout}>
            <SheetIcon type="logout" />
            <span>{labels.logout}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
