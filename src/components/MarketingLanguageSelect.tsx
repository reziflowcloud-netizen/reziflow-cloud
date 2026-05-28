'use client'
import { useEffect, useRef, useState } from 'react'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { LANGUAGE_OPTIONS } from '@/lib/marketingI18n'

export default function MarketingLanguageSelect() {
  const { lang, setLang } = useMarketingLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = LANGUAGE_OPTIONS.find(option => option.code === lang) || LANGUAGE_OPTIONS[1]

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onScroll() {
      setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  function choose(next: typeof LANGUAGE_OPTIONS[number]['code']) {
    setLang(next)
    setOpen(false)
  }

  return (
    <div className="marketing-language" ref={rootRef}>
      <button
        type="button"
        className="marketing-language-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${active.label}`}
        title={active.label}
        onClick={() => setOpen(value => !value)}
      >
        <span>{active.short}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <div className="marketing-language-menu" role="listbox" aria-label="Language">
          {LANGUAGE_OPTIONS.map(option => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={option.code === lang}
              className={option.code === lang ? 'active' : ''}
              onClick={() => choose(option.code)}
            >
              <span>{option.short}</span>
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
