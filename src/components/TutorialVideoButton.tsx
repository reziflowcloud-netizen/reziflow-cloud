'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { tutorialVideos, type TutorialVideoKey } from '@/lib/tutorialVideos'

const copy = {
  ru: {
    button: 'Видео',
    title: 'Открыть обучающее видео',
  },
  uk: {
    button: 'Відео',
    title: 'Відкрити навчальне відео',
  },
  pl: {
    button: 'Wideo',
    title: 'Otwórz wideo szkoleniowe',
  },
}

export default function TutorialVideoButton({ videoKey }: { videoKey: TutorialVideoKey }) {
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

  if (!enabled || !url) return null

  function openVideo() {
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
      className="btn btn-secondary"
      onClick={openVideo}
      title={`${text.title}: ${video.title}`}
      aria-label={`${text.title}: ${video.title}`}
      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7 }}
    >
      <span aria-hidden="true" style={{ fontSize: 12 }}>▶</span>
      {text.button}
    </button>
  )
}
