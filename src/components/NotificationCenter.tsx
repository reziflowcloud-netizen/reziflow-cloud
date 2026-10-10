'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import type { NotificationType } from '@/lib/notificationPolicy'
import { handleNotificationOpen, publishNotificationStatus, updateAppBadge } from '@/lib/notificationBrowser'
import { prepareScreenLeave } from '@/lib/screenLeave'
import { mobileStandalone, NotificationResumeTracker } from '@/lib/notificationResume'
import styles from './Notifications.module.css'
type Item = { id: string; type: NotificationType; title: string; body: string; createdAt: string; readAt: string | null }
export default function NotificationCenter() {
  const { lang } = useLanguage()
  const copy = notificationText[lang]
  const pathname = usePathname()
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const bell = useRef<HTMLElement | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [resumeBanner, setResumeBanner] = useState(false)
  const [bannerHost, setBannerHost] = useState<HTMLElement | null>(null)
  const resume = useRef(new NotificationResumeTracker())
  const eligible = useRef(false)
  const centerOpen = useRef(false)
  const inFlight = useRef<Promise<void> | null>(null)
  const syncAgain = useRef(false)
  const acknowledgeResume = useCallback(() => { resume.current.acknowledge(); setResumeBanner(false) }, [])
  const sync = useCallback(async (next?: string) => {
    if (inFlight.current) { if (!next) syncAgain.current = true; await inFlight.current; return }
    const work = async () => {
      setLoading(true)
      do {
        syncAgain.current = false
        const page = next
        const since = eligible.current ? resume.current.since() : null
        const params = new URLSearchParams()
        if (page) params.set('cursor', page)
        if (eligible.current) { params.set('resume', '1'); if (since) params.set('unreadSince', since) }
        try {
          const response = await fetch('/api/notifications' + (params.size ? `?${params}` : ''), { cache: 'no-store' })
          if (response.status === 401) {
            resume.current.reset(); setResumeBanner(false); setOpen(false)
            setAvailable(false); setItems([]); setUnread(0); setCursor(null)
            syncAgain.current = false; await updateAppBadge(0); break
          }
          if (!response.ok) throw new Error()
          const data = await response.json()
          setItems(current => page ? [...current, ...data.items.filter((item: Item) => !current.some(old => old.id === item.id))] : data.items)
          setUnread(data.unread); setCursor(data.nextCursor); setError(false)
          if (eligible.current && data.resume) {
            resume.current.observe(data.resume, performance.now(), since, document.visibilityState === 'visible')
            if (centerOpen.current || (since && !data.unread)) resume.current.acknowledge()
            if (document.visibilityState === 'visible' && resume.current.since() && resume.current.since() !== since) syncAgain.current = true
            setResumeBanner(resume.current.showing)
          }
          await updateAppBadge(data.unread)
        } catch { setError(true) }
        next = undefined
      } while (syncAgain.current)
      setLoading(false)
    }
    inFlight.current = work()
    try { await inFlight.current } finally { inFlight.current = null }
  }, [])
  useEffect(() => {
    const mobile = matchMedia('(max-width: 768px)')
    const standalone = matchMedia('(display-mode: standalone)')
    const check = () => {
      eligible.current = mobileStandalone(mobile.matches, standalone.matches, (navigator as Navigator & { standalone?: boolean }).standalone)
      if (!eligible.current) { resume.current.reset(); setResumeBanner(false) }
      else if (available) void sync()
    }
    check(); mobile.addEventListener('change', check); standalone.addEventListener('change', check)
    return () => { mobile.removeEventListener('change', check); standalone.removeEventListener('change', check) }
  }, [available, sync])
  useLayoutEffect(() => {
    // A compact in-flow header remains reachable when a scrolled page resumes.
    const content = document.querySelector('.main-content')
    if (!available || !content) return
    const host = document.createElement('div')
    host.className = styles.resumeHost
    content.prepend(host); setBannerHost(host)
    return () => { host.remove() }
  }, [available, pathname])
  useEffect(() => {
    let alive = true
    fetch('/api/notifications/preferences', { cache: 'no-store' }).then(response => { if (alive) setAvailable(response.ok) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  useEffect(() => { setOpen(false); acknowledgeResume() }, [pathname, acknowledgeResume])
  useEffect(() => { centerOpen.current = open; if (open) acknowledgeResume() }, [open, acknowledgeResume])
  useEffect(() => {
    if (!available) return
    const show = (event: Event) => {
      if (open) { setOpen(false); bell.current?.focus() }
      else { acknowledgeResume(); centerOpen.current = true; bell.current = (event as CustomEvent<HTMLElement>).detail || document.activeElement as HTMLElement; setOpen(true) }
    }
    window.addEventListener('legalhub:open-notifications', show)
    return () => { window.removeEventListener('legalhub:open-notifications', show) }
  }, [available, open, acknowledgeResume])
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      if (!overlay.current) return
      // Keep the opener and focus return valid when crossing the mobile breakpoint.
      if (!bell.current?.getBoundingClientRect().width) {
        bell.current = Array.from(document.querySelectorAll<HTMLElement>('[data-notification-bell]')).find(button => button.getBoundingClientRect().width > 0) || null
      }
      if (!bell.current || window.innerWidth <= 768) return
      const anchor = bell.current.getBoundingClientRect()
      const card = bell.current.closest('.sidebar-profile')?.getBoundingClientRect() || anchor
      const sidebar = bell.current.closest('.sidebar')?.getBoundingClientRect() || card
      const width = Math.min(400, window.innerWidth - 24)
      const left = Math.max(12, Math.min(sidebar.right + 12, window.innerWidth - width - 12))
      const bottom = Math.max(12, Math.min(window.innerHeight - card.bottom, window.innerHeight * 0.2))
      const values = {
        '--notification-left': left, '--notification-bottom': bottom,
        '--notification-width': width,
        '--notification-height': Math.min(window.innerHeight * 0.75, window.innerHeight - bottom - 12),
        '--bell-left': anchor.left - 4, '--bell-right': anchor.right + 4,
        '--bell-top': anchor.top - 4, '--bell-bottom': anchor.bottom + 4,
      }
      for (const [key, value] of Object.entries(values)) overlay.current.style.setProperty(key, `${value}px`)
    }
    position()
    const observer = new ResizeObserver(position)
    if (bell.current) observer.observe(bell.current)
    const card = bell.current?.closest('.sidebar-profile')
    if (card) observer.observe(card)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open])
  useEffect(() => { publishNotificationStatus({ available, unread }) }, [available, unread])
  useEffect(() => () => { publishNotificationStatus({ available: false, unread: 0 }) }, [])
  useEffect(() => {
    if (available) void sync()
    const refresh = () => { if (available && document.visibilityState === 'visible') void sync() }
    const returned = () => { if (eligible.current && document.visibilityState === 'visible') resume.current.resume(); refresh() }
    const visibility = () => {
      if (document.visibilityState === 'hidden') { if (eligible.current) resume.current.background(performance.now()) }
      else returned()
    }
    if (document.visibilityState === 'hidden') visibility()
    const workerMessage = (event: MessageEvent) => { handleNotificationOpen(event); if (event.data?.type === 'notifications-changed') refresh() }
    const timer = window.setInterval(refresh, 45000)
    window.addEventListener('focus', returned); window.addEventListener('pageshow', returned); window.addEventListener('notifications-changed', refresh); document.addEventListener('visibilitychange', visibility)
    navigator.serviceWorker?.addEventListener('message', workerMessage)
    // Refresh an existing worker after a release without requesting permission
    // or creating a subscription on page load.
    if (available) navigator.serviceWorker?.getRegistration('/notification-sw.js').then(registration => registration?.update()).catch(() => undefined)
    return () => { clearInterval(timer); window.removeEventListener('focus', returned); window.removeEventListener('pageshow', returned); window.removeEventListener('notifications-changed', refresh); document.removeEventListener('visibilitychange', visibility); navigator.serviceWorker?.removeEventListener('message', workerMessage) }
  }, [available, sync])
  useEffect(() => {
    if (!open) return
    void sync()
    const oldOverflow = document.body.style.overflow
    const oldPaddingRight = document.body.style.paddingRight
    const paddingRight = parseFloat(getComputedStyle(document.body).paddingRight) || 0
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const preserveWidth = () => {
      document.body.style.paddingRight = window.innerWidth > 768 && scrollbarWidth > 0 ? `${paddingRight + scrollbarWidth}px` : oldPaddingRight
    }
    preserveWidth()
    document.body.style.overflow = 'hidden'
    window.addEventListener('resize', preserveWidth)
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus())
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); bell.current?.focus() }
      if (event.key === 'Tab') {
        const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || [])
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', keys)
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = oldOverflow; document.body.style.paddingRight = oldPaddingRight; window.removeEventListener('resize', preserveWidth); document.removeEventListener('keydown', keys) }
  }, [open, sync])
  async function markRead(id?: string) {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { all: true }) })
      if (!response.ok) throw new Error()
      if (!id) acknowledgeResume()
      await sync()
    } catch { setError(true) }
  }
  function timestamp(date: string) {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (minutes < 1440) return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-Math.max(0, minutes < 60 ? minutes : Math.floor(minutes / 60)), minutes < 60 ? 'minute' : 'hour')
    return new Date(date).toLocaleString(lang, { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' })
  }
  if (!available) return null
  return <>
    {resumeBanner && !open && bannerHost && createPortal(<aside className={styles.resumeBanner} aria-label={copy.resumeTitle}>
      <div className={styles.resumeCopy}><p role="status">🔔 {copy.resumeTitle}</p><button type="button" onClick={() => {
        acknowledgeResume(); centerOpen.current = true
        bell.current = Array.from(document.querySelectorAll<HTMLElement>('[data-notification-bell]')).find(button => button.getBoundingClientRect().width > 0) || null
        setOpen(true)
      }}>{copy.resumeOpen}</button></div>
      <button type="button" className={styles.iconButton} aria-label={copy.close} onClick={acknowledgeResume}>×</button>
    </aside>, bannerHost)}
    {open && createPortal(<div ref={overlay} className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) { setOpen(false); bell.current?.focus() } }}>
      <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <div className={styles.panelHeader}><h2 id="notification-center-title">{copy.center}</h2><button className={styles.iconButton} aria-label={copy.close} onClick={() => { setOpen(false); bell.current?.focus() }}>×</button></div>
        <div className={styles.toolbar}><button disabled={!unread || loading} onClick={() => void markRead()}>{copy.markAll}</button><Link href="/settings/notifications" onClick={async event => { event.preventDefault(); if (await prepareScreenLeave()) window.location.assign('/settings/notifications') }}>{copy.settings}</Link></div>
        <div className={styles.list} aria-busy={loading}>
          {error && <p role="alert" className={styles.error}>{copy.error}</p>}
          {!items.length && <p className={styles.empty}>{loading ? copy.loading : copy.empty}</p>}
          {items.map(item => <article key={item.id} className={`${styles.item} ${!item.readAt ? styles.unread : ''}`}>
            <span className={`${styles.eventIcon} ${item.type === 'task_overdue' ? styles.urgent : item.type === 'case_date' || item.type === 'task_due' ? styles.upcoming : ''}`} aria-hidden="true">{item.type.startsWith('task') ? '✓' : item.type === 'case_date' ? '◷' : '↗'}</span>
            <div className={styles.itemCopy}><a href={`/notifications/open/${item.id}`} onClick={async event => { event.preventDefault(); if (await prepareScreenLeave()) window.location.assign(`/notifications/open/${item.id}`) }}><strong>{copy.events[item.type] || item.title}</strong><p>{item.body}</p></a><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString(lang, { timeZone: 'Europe/Warsaw' })}>{timestamp(item.createdAt)}</time>{item.readAt ? <span className={styles.readState}> · {copy.read}</span> : <button className={styles.markRead} onClick={() => void markRead(item.id)}>{copy.markRead}</button>}</div>
          </article>)}
          {cursor && <button className="btn btn-secondary" disabled={loading} onClick={() => void sync(cursor)}>{copy.more}</button>}
        </div>
      </div>
    </div>, document.body)}
  </>
}
