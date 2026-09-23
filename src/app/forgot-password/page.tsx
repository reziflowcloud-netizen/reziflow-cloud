'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getPasswordResetCopy } from '@/lib/passwordResetI18n'

export default function ForgotPasswordPage() {
  const { lang } = useMarketingLanguage()
  const copy = getPasswordResetCopy(lang).forgot
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const theme = localStorage.getItem('rezi_theme')
    if (theme === 'dark' || theme === 'slate' || theme === 'light') document.documentElement.dataset.theme = theme
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: lang }),
      })
    } finally {
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <main className="login-page auth-recovery-page">
      <section className="login-center" aria-label={copy.formAria}>
        <div className="login-card fade-in">
          <div className="auth-language-row"><MarketingLanguageSelect /></div>
          <div className="login-logo">
            <Link href="/" aria-label="LegalHub CRM"><img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" className="login-brand-logo" /></Link>
            <h1 className="auth-recovery-title">{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          {submitted ? <div className="success-msg" role="status">{copy.generic}</div> : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="forgot-email">{copy.email}</label>
                <input id="forgot-email" className="input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
              </div>
              <button className="btn btn-primary login-submit" type="submit" disabled={loading}>{loading ? copy.loading : copy.submit}</button>
            </form>
          )}
          <div className="auth-recovery-links"><Link href="/login">{copy.back}</Link></div>
        </div>
      </section>
    </main>
  )
}
