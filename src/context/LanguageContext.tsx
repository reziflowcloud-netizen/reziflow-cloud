// src/context/LanguageContext.tsx
'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { T, Lang, normalizeLang } from '@/lib/translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'ru',
  setLang: () => {},
  t: (k) => k,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => {
    const saved = normalizeLang(localStorage.getItem('rezi_lang'))
    setLangState(saved)
    localStorage.setItem('rezi_lang', saved)

    // Listen for lang changes from Sidebar
    function onLangChange(e: Event) {
      const detail = normalizeLang((e as CustomEvent).detail)
      setLangState(detail)
      localStorage.setItem('rezi_lang', detail)
    }
    window.addEventListener('langchange', onLangChange)
    return () => window.removeEventListener('langchange', onLangChange)
  }, [])

  function setLang(l: Lang) {
    const next = normalizeLang(l)
    setLangState(next)
    localStorage.setItem('rezi_lang', next)
    window.dispatchEvent(new CustomEvent('langchange', { detail: next }))
  }

  function t(key: string): string {
    return T[lang]?.[key] ?? T['ru']?.[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
