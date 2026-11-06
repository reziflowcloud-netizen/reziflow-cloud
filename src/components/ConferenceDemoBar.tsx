'use client'

import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getConferenceCopy } from '@/lib/conferenceI18n'
import { trackConferenceEvent } from '@/lib/conferenceTrackingClient'
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
        <form action="/api/conference/demo/exit" method="post">
          <button
            type="submit"
            name="intent"
            value="register"
            className={styles.primary}
            onClick={() => trackConferenceEvent('conference_register_click', { language: lang, ctaLocation: 'demo_bar' })}
          >
            {copy.register}
          </button>
        </form>
        <form action="/api/conference/demo/exit" method="post">
          <button type="submit" name="intent" value="login" className={styles.secondary}>{copy.login}</button>
        </form>
      </div>
    </aside>
  )
}
