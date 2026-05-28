'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  APP_LANG_STORAGE_KEY,
  DEFAULT_MARKETING_LANG,
  MARKETING_LANG_CHANGE_EVENT,
  MARKETING_LANG_STORAGE_KEY,
  type MarketingLang,
  normalizeMarketingLang,
} from '@/lib/marketingI18n'

function applyDocumentLang(lang: MarketingLang) {
  document.documentElement.lang = lang
  document.documentElement.dataset.marketingLang = lang
}

function readSavedLang(): MarketingLang {
  return normalizeMarketingLang(
    localStorage.getItem(MARKETING_LANG_STORAGE_KEY) || localStorage.getItem(APP_LANG_STORAGE_KEY),
  )
}

export function useMarketingLanguage() {
  const [lang, setLangState] = useState<MarketingLang>(DEFAULT_MARKETING_LANG)

  useEffect(() => {
    const saved = readSavedLang()
    setLangState(saved)
    applyDocumentLang(saved)

    function onMarketingLangChange(event: Event) {
      const next = normalizeMarketingLang((event as CustomEvent<MarketingLang>).detail)
      setLangState(next)
      applyDocumentLang(next)
    }

    function onStorage(event: StorageEvent) {
      if (event.key === MARKETING_LANG_STORAGE_KEY || event.key === APP_LANG_STORAGE_KEY) {
        const next = readSavedLang()
        setLangState(next)
        applyDocumentLang(next)
      }
    }

    window.addEventListener(MARKETING_LANG_CHANGE_EVENT, onMarketingLangChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(MARKETING_LANG_CHANGE_EVENT, onMarketingLangChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setLang = useCallback((nextValue: MarketingLang) => {
    const next = normalizeMarketingLang(nextValue)
    setLangState(next)
    localStorage.setItem(MARKETING_LANG_STORAGE_KEY, next)

    if (next === 'en') {
      localStorage.removeItem(APP_LANG_STORAGE_KEY)
    } else {
      localStorage.setItem(APP_LANG_STORAGE_KEY, next)
      window.dispatchEvent(new CustomEvent('langchange', { detail: next }))
    }

    applyDocumentLang(next)
    window.dispatchEvent(new CustomEvent(MARKETING_LANG_CHANGE_EVENT, { detail: next }))
  }, [])

  return { lang, setLang }
}
