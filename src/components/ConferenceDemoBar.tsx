'use client'

import Link from 'next/link'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getConferenceCopy } from '@/lib/conferenceI18n'
import styles from './ConferenceDemoBar.module.css'

export default function ConferenceDemoBar() {
  const { lang } = useMarketingLanguage()
  const copy = getConferenceCopy(lang).demoBar

  return (
    <aside className={styles.bar} aria-label={copy.title}>
      <div className={styles.copy}>
        <strong>{copy.title}</strong>
        <span>{copy.text}</span>
      </div>
      <div className={styles.actions}>
        <Link href="/register?plan=free" className={styles.primary}>{copy.register}</Link>
        <Link href="/login" className={styles.secondary}>{copy.login}</Link>
      </div>
    </aside>
  )
}
