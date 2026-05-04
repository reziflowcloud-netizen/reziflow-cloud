// src/context/LanguageContext.tsx
'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { T, Lang } from '@/lib/translations'

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
    const saved = (localStorage.getItem('rezi_lang') || 'ru') as Lang
    setLangState(saved)

    // Listen for lang changes from Sidebar
    function onLangChange(e: Event) {
      const detail = (e as CustomEvent).detail as Lang
      setLangState(detail)
    }
    window.addEventListener('langchange', onLangChange)
    return () => window.removeEventListener('langchange', onLangChange)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('rezi_lang', l)
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
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
