'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Ошибка входа')
      else router.push('/dashboard')
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <img src="/assets/legalhub/legalhub-logo.svg" alt="LegalHub" className="login-brand-logo login-brand-logo-light" />
          <img src="/assets/legalhub/legalhub-logo-dark.svg" alt="LegalHub" className="login-brand-logo login-brand-logo-dark" />
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Система управления делами</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div className="form-group">
            <label className="label">Пароль</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
      <div className="login-legal-links">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
        <span>•</span>
        <a href="/data-deletion" target="_blank" rel="noreferrer">Data Deletion Instructions</a>
      </div>
    </div>
  )
}
