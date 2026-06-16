'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordEyeIcon from '@/components/PasswordEyeIcon'

export default function LoginPage() {
  const router = useRouter()
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
      <section className="login-intro" aria-label="Преимущества LegalHub">
        <p className="login-kicker">LegalHub CRM</p>
        <h1>Система управления делами для легализационных агентств в Польше</h1>
        <div className="login-benefits">
          <article>
            <span className="login-benefit-icon shield" aria-hidden="true" />
            <div>
              <h2>Ваши данные под защитой</h2>
              <p>Шифрование и резервное копирование</p>
            </div>
          </article>
          <article>
            <span className="login-benefit-icon reminder" aria-hidden="true" />
            <div>
              <h2>Ничего не упустите</h2>
              <p>Напоминания и контроль сроков</p>
            </div>
          </article>
          <article>
            <span className="login-benefit-icon team" aria-hidden="true" />
            <div>
              <h2>Вся команда в одном окне</h2>
              <p>Задачи, клиенты и документы</p>
            </div>
          </article>
        </div>
      </section>

      <section className="login-center" aria-label="Форма входа">
        <div className="login-card fade-in">
          <div className="login-logo">
            <Link href="/" aria-label="LegalHub CRM">
              <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" className="login-brand-logo" />
            </Link>
            <p>Система управления делами</p>
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
              <div className="password-field">
                <input className="input password-field-input" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                <button
                  type="button"
                  className={`password-toggle ${showPassword ? 'is-visible' : ''}`}
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  <PasswordEyeIcon visible={showPassword} />
                </button>
              </div>
            </div>
            <div className="login-form-row">
              <label className="login-remember">
                <input type="checkbox" />
                <span>Запомнить меня</span>
              </label>
              <a href="mailto:office@legalhubcrm.com?subject=Восстановление доступа LegalHub">Забыли пароль?</a>
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
          <div className="login-legal-links">
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            <span>•</span>
            <a href="/data-deletion" target="_blank" rel="noreferrer">Data Deletion Instructions</a>
          </div>
        </div>
      </section>
    </div>
  )
}
