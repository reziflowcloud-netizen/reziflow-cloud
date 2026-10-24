'use client'
import { getMetaMessageStatus, getServerMetaMessageStatus, subscribeMetaMessageStatus } from '@/lib/metaMessageStatus'
import { metaMessageText } from '@/lib/metaMessageI18n'
import { useSyncExternalStore } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import { getNotificationStatus, getServerNotificationStatus, subscribeNotificationStatus } from '@/lib/notificationBrowser'
import styles from './Notifications.module.css'
import NotificationIcon from './NotificationIcon'
import mobileActions from './mobile/MobileHeaderActions.module.css'
import { useNotificationFeature } from '@/context/NotificationFeatureContext'

export default function NotificationBell({ placement = 'mobile' }: { placement?: 'mobile' | 'sidebar' }) {
  const { lang } = useLanguage()
  const enabled = useNotificationFeature()
  const { available, unread } = useSyncExternalStore(subscribeNotificationStatus, getNotificationStatus, getServerNotificationStatus)
  const meta = useSyncExternalStore(subscribeMetaMessageStatus, getMetaMessageStatus, getServerMetaMessageStatus)
  const metaCount = meta[0]?.total || 0
  const count = (available ? unread : 0) + metaCount
  if (!enabled && !metaCount) return null
  return <div className={`${styles.slot} ${placement === 'sidebar' ? styles.sidebarSlot : styles.mobileSlot}`}><button data-notification-bell data-mobile-header-action={placement === 'mobile' ? true : undefined} className={`${styles.bell} ${placement === 'mobile' ? mobileActions.action : ''}`} title={metaCount ? `${metaMessageText[lang].unread}: ${metaCount}` : notificationText[lang].center} aria-label={`${notificationText[lang].center}${count ? ` (${count})` : ''}${metaCount ? ` · ${metaMessageText[lang].unread}: ${metaCount}` : ''}`} aria-haspopup="dialog" onClick={event => window.dispatchEvent(new CustomEvent('legalhub:open-notifications', { detail: event.currentTarget }))}>
    <NotificationIcon />
    {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
  </button></div>
}
