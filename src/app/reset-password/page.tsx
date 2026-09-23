'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import PasswordEyeIcon from '@/components/PasswordEyeIcon'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getPasswordResetCopy } from '@/lib/passwordResetI18n'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const { lang } = useMarketingLanguage()
  const copy = getPasswordResetCopy(lang).reset
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(token ? '' : copy.invalid)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const theme = localStorage.getItem('rezi_theme')
    if (theme === 'dark' || theme === 'slate' || theme === 'light') document.documentElement.dataset.theme = theme
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 6) return setError(copy.minimum)
    if (password !== confirmation) return setError(copy.mismatch)
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!response.ok) setError(copy.invalid)
      else setComplete(true)
    } catch {
      setError(copy.invalid)
    } finally {
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
          {complete ? (
            <><div className="success-msg" role="status">{copy.success}</div><div className="auth-recovery-links"><Link href="/login">{copy.login}</Link></div></>
          ) : (
            <>
              {error && <div className="error-msg" role="alert">{error}</div>}
              {token ? (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="label" htmlFor="new-password">{copy.password}</label>
                    <div className="password-field">
                      <input id="new-password" className="input password-field-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={6} />
                      <button type="button" className={`password-toggle ${showPassword ? 'is-visible' : ''}`} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? copy.hidePassword : copy.showPassword}><PasswordEyeIcon visible={showPassword} /></button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="confirm-password">{copy.confirm}</label>
                    <input id="confirm-password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={6} />
                  </div>
                  <button className="btn btn-primary login-submit" type="submit" disabled={loading}>{loading ? copy.loading : copy.submit}</button>
                </form>
              ) : <div className="auth-recovery-links"><Link href="/forgot-password">{copy.requestNew}</Link></div>}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordForm /></Suspense>
}
