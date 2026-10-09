'use client'
import { useSyncExternalStore } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import { getNotificationStatus, getServerNotificationStatus, subscribeNotificationStatus } from '@/lib/notificationBrowser'
import styles from './Notifications.module.css'

export default function NotificationBell() {
  const { lang } = useLanguage()
  const { available, unread } = useSyncExternalStore(subscribeNotificationStatus, getNotificationStatus, getServerNotificationStatus)
  if (!available) return null
  return <div className={styles.slot}><button className={styles.bell} aria-label={`${notificationText[lang].center}${unread ? ` (${unread})` : ''}`} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event('legalhub:open-notifications'))}>
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
  </button></div>
}
