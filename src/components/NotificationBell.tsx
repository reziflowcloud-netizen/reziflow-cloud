'use client'
import { useSyncExternalStore } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import { getNotificationStatus, getServerNotificationStatus, subscribeNotificationStatus } from '@/lib/notificationBrowser'
import styles from './Notifications.module.css'
import NotificationIcon from './NotificationIcon'

export default function NotificationBell({ placement = 'mobile' }: { placement?: 'mobile' | 'sidebar' }) {
  const { lang } = useLanguage()
  const { available, unread } = useSyncExternalStore(subscribeNotificationStatus, getNotificationStatus, getServerNotificationStatus)
  if (!available) return null
  return <div className={`${styles.slot} ${placement === 'sidebar' ? styles.sidebarSlot : styles.mobileSlot}`}><button data-notification-bell className={styles.bell} title={notificationText[lang].center} aria-label={`${notificationText[lang].center}${unread ? ` (${unread})` : ''}`} aria-haspopup="dialog" onClick={event => window.dispatchEvent(new CustomEvent('legalhub:open-notifications', { detail: event.currentTarget }))}>
    <NotificationIcon />
    {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
  </button></div>
}
