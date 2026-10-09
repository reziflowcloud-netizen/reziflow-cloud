'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import type { NotificationType } from '@/lib/notificationPolicy'
import { publishNotificationStatus, updateAppBadge } from '@/lib/notificationBrowser'
import { prepareScreenLeave } from '@/lib/screenLeave'
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
  const panel = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const sync = useCallback(async (next?: string) => {
    if (inFlight.current) return
    inFlight.current = true; setLoading(true)
    try {
      const response = await fetch('/api/notifications' + (next ? `?cursor=${encodeURIComponent(next)}` : ''), { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const data = await response.json()
      setItems(current => next ? [...current, ...data.items.filter((item: Item) => !current.some(old => old.id === item.id))] : data.items)
      setUnread(data.unread); setCursor(data.nextCursor); setError(false)
      await updateAppBadge(data.unread)
    } catch { setError(true) } finally { inFlight.current = false; setLoading(false) }
  }, [])
  useEffect(() => {
    let alive = true
    fetch('/api/notifications/preferences', { cache: 'no-store' }).then(response => { if (alive) setAvailable(response.ok) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!available) return
    const show = () => { bell.current = document.activeElement as HTMLElement; setOpen(true) }
    window.addEventListener('legalhub:open-notifications', show)
    return () => { window.removeEventListener('legalhub:open-notifications', show) }
  }, [available])
  useEffect(() => { publishNotificationStatus({ available, unread }) }, [available, unread])
  useEffect(() => () => { publishNotificationStatus({ available: false, unread: 0 }) }, [])
  useEffect(() => {
    if (!available) return
    void sync()
    const refresh = () => { if (document.visibilityState === 'visible') void sync() }
    const workerMessage = (event: MessageEvent) => { if (event.data?.type === 'notifications-changed') refresh() }
    const timer = window.setInterval(refresh, 45000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    navigator.serviceWorker?.addEventListener('message', workerMessage)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); navigator.serviceWorker?.removeEventListener('message', workerMessage) }
  }, [available, sync])
  useEffect(() => {
    if (!open) return
    void sync()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
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
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keys) }
  }, [open, sync])
  async function markRead(id?: string) {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { all: true }) })
      if (!response.ok) throw new Error()
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
    {open && createPortal(<div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) { setOpen(false); bell.current?.focus() } }}>
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
