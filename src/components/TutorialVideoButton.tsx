'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { tutorialVideos, type TutorialVideoKey } from '@/lib/tutorialVideos'
import styles from './TutorialVideoButton.module.css'

const copy = {
  ru: {
    button: 'Видео',
    missing: 'Видео скоро',
    title: 'Видеоинструкция',
  },
  uk: {
    button: 'Відео',
    missing: 'Відео скоро',
    title: 'Відеоінструкція',
  },
  pl: {
    button: 'Wideo',
    missing: 'Wideo wkrótce',
    title: 'Instrukcja wideo',
  },
}

type TutorialVideoButtonProps = {
  videoKey: TutorialVideoKey
  label?: string
  missingLabel?: string
  missingBehavior?: 'hide' | 'disabled'
  className?: string
  style?: CSSProperties
}

export default function TutorialVideoButton({
  videoKey,
  label,
  missingLabel,
  missingBehavior = 'hide',
  className = '',
  style,
}: TutorialVideoButtonProps) {
  const { lang } = useLanguage()
  const [enabled, setEnabled] = useState(false)
  const video = tutorialVideos[videoKey]
  const url = video?.url.trim()
  const text = copy[lang] || copy.ru

  useEffect(() => {
    let active = true

    fetch('/api/organization-settings', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active) setEnabled(data?.settings?.tutorialVideosEnabled === true)
      })
      .catch(() => {
        if (active) setEnabled(false)
      })

    return () => {
      active = false
    }
  }, [])

  if (!enabled) return null
  if (!url && missingBehavior === 'hide') return null

  function openVideo() {
    if (!url) return

    const popup = window.open(
      url,
      `legalhub_tutorial_${videoKey}`,
      'width=1080,height=720,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes',
    )
    if (popup) {
      popup.opener = null
      popup.focus()
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-secondary ${styles.button} ${className}`.trim()}
      onClick={openVideo}
      disabled={!url}
      title={url ? `${text.title}: ${video.title}` : video.title}
      aria-label={url ? `${text.title}: ${video.title}` : video.title}
      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7, ...style }}
    >
      <span className={styles.desktopIcon} aria-hidden="true" style={{ fontSize: 12 }}>▶</span>
      <svg className={styles.mobileIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <rect x="2" y="4.5" width="20" height="15" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="m10 8 6 4-6 4V8Z" fill="currentColor" />
      </svg>
      {url ? (label || text.button) : (missingLabel || text.missing)}
    </button>
  )
}
