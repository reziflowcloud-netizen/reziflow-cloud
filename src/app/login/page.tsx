'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import PasswordEyeIcon from '@/components/PasswordEyeIcon'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getAuthCopy } from '@/lib/authI18n'

export default function LoginPage() {
  const router = useRouter()
  const { lang } = useMarketingLanguage()
  const copy = getAuthCopy(lang).login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('rezi_theme')
    if (savedTheme === 'dark' || savedTheme === 'slate' || savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      await res.json()
      if (!res.ok) setError(copy.loginError)
      else router.push('/dashboard')
    } catch {
      setError(copy.connectionError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-intro" aria-label={copy.introAria}>
        <p className="login-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <div className="login-benefits">
          {copy.benefits.map(benefit => (
            <article key={benefit.title}>
              <span className={`login-benefit-icon ${benefit.icon}`} aria-hidden="true" />
              <div>
                <h2>{benefit.title}</h2>
                <p>{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="login-center" aria-label={copy.formAria}>
        <div className="login-card fade-in">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <MarketingLanguageSelect />
          </div>

          <div className="login-logo">
            <Link href="/" aria-label="LegalHub CRM">
              <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" className="login-brand-logo" />
            </Link>
            <p>{copy.cardSubtitle}</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">{copy.email}</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div className="form-group">
              <label className="label">{copy.password}</label>
              <div className="password-field">
                <input className="input password-field-input" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                <button
                  type="button"
                  className={`password-toggle ${showPassword ? 'is-visible' : ''}`}
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  title={showPassword ? copy.hidePassword : copy.showPassword}
                >
                  <PasswordEyeIcon visible={showPassword} />
                </button>
              </div>
            </div>
            <div className="login-form-row">
              <label className="login-remember">
                <input type="checkbox" />
                <span>{copy.remember}</span>
              </label>
              <a href={`mailto:office@legalhubcrm.com?subject=${encodeURIComponent(copy.forgotSubject)}`}>{copy.forgot}</a>
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? copy.loading : copy.submit}
            </button>
          </form>
          <div className="login-legal-links">
            <a href="/privacy" target="_blank" rel="noreferrer">{copy.privacy}</a>
            <span>•</span>
            <a href="/data-deletion" target="_blank" rel="noreferrer">{copy.dataDeletion}</a>
          </div>
        </div>
      </section>
    </div>
  )
}
