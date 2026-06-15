'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import { DEFAULT_MARKETING_LANG, getMarketingCopy, type MarketingHeaderCopy } from '@/lib/marketingI18n'

function buildRegisterHref(ref?: string, plan = 'free') {
  const params = new URLSearchParams({ plan })
  if (ref) params.set('ref', ref)
  return `/register?${params.toString()}`
}

export default function MarketingHeader({
  referralCode,
  copy = getMarketingCopy(DEFAULT_MARKETING_LANG).header,
  onFaqOpen,
}: {
  referralCode?: string
  copy?: MarketingHeaderCopy
  onFaqOpen?: () => void
}) {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    function update() {
      const currentY = window.scrollY
      const delta = currentY - lastY

      if (currentY < 24) {
        setHidden(false)
      } else if (delta > 8 && currentY > 120) {
        setHidden(true)
      } else if (delta < -8) {
        setHidden(false)
      }

      lastY = currentY
      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (hidden) setMenuOpen(false)
  }, [hidden])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className={`marketing-header ${hidden ? 'marketing-header-hidden' : ''} ${menuOpen ? 'marketing-header-menu-open' : ''}`}>
      <Link href="/" className="marketing-brand" aria-label="LegalHub CRM">
        <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
      </Link>
      <nav id="marketing-mobile-nav" className={menuOpen ? 'marketing-nav-open' : ''} aria-label={copy.navAria}>
        <a href="#product" onClick={() => setMenuOpen(false)}>{copy.nav.product}</a>
        <a href="#demo" onClick={() => setMenuOpen(false)}>{copy.nav.tour}</a>
        <a href="#process" onClick={() => setMenuOpen(false)}>{copy.nav.workflow}</a>
        <a href="#pricing" onClick={() => setMenuOpen(false)}>{copy.nav.pricing}</a>
        <a href="#security" onClick={() => setMenuOpen(false)}>{copy.nav.security}</a>
        <button type="button" onClick={() => { setMenuOpen(false); onFaqOpen?.() }}>FAQ</button>
      </nav>
      <div className="marketing-actions">
        <button
          type="button"
          className="marketing-menu-toggle"
          aria-controls="marketing-mobile-nav"
          aria-expanded={menuOpen}
          aria-label={copy.menu}
          title={copy.menu}
          onClick={() => setMenuOpen(value => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <MarketingLanguageSelect />
        <Link href="/login" className="marketing-login">{copy.login}</Link>
        <Link href={buildRegisterHref(referralCode)} className="marketing-primary">{copy.startFree}</Link>
      </div>
    </header>
  )
}
