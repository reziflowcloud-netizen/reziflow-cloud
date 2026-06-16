'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import PasswordEyeIcon from '@/components/PasswordEyeIcon'

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

const REGISTER_BENEFITS = [
  {
    title: 'Старт без оплаты',
    text: 'и без карты',
    icon: 'payment',
  },
  {
    title: 'Гибкие настройки',
    text: 'под ваш процесс',
    icon: 'settings',
  },
  {
    title: 'Полный контроль',
    text: 'и аналитика',
    icon: 'control',
  },
  {
    title: 'Безопасность',
    text: 'и защита данных',
    icon: 'security',
  },
]

export default function RegisterClient({ initialPlan, referralCode }: { initialPlan: string, referralCode?: string }) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [plan, setPlan] = useState(PLAN_LABELS[initialPlan] ? initialPlan : 'free')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const planName = useMemo(() => PLAN_LABELS[plan] || PLAN_LABELS.free, [plan])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          adminName,
          email,
          password,
          plan,
          referralCode,
          landingPath: typeof window !== 'undefined' ? window.location.href : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Не удалось создать организацию')
        return
      }
      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page auth-register-page">
      <section className="register-panel register-info-panel" aria-label="Преимущества старта">
        <p className="marketing-kicker">LegalHub CRM</p>
        <h1>Начните бесплатно и настройте систему под свою работу</h1>
        <p className="register-lead">
          Создайте организацию за пару минут и начните работать в своей CRM.
        </p>
        <div className="register-benefit-grid">
          {REGISTER_BENEFITS.map(benefit => (
            <article key={benefit.title} className="register-benefit-card">
              <span className={`register-benefit-icon ${benefit.icon}`} aria-hidden="true" />
              <div>
                <h2>{benefit.title}</h2>
                <p>{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="register-form-shell" aria-label="Форма регистрации">
        <form onSubmit={handleSubmit} className="register-form">
          <Link href="/" className="register-logo">
            <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
          </Link>
          <p className="marketing-kicker">Бесплатный старт</p>

          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label className="label">Название компании *</label>
            <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Напр.: Legal Partner" required />
          </div>

          <div className="form-group">
            <label className="label">Ваше имя *</label>
            <input className="input" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Имя администратора" required />
          </div>

          <div className="form-group">
            <label className="label">Email для входа *</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required />
          </div>

          <div className="form-group">
            <label className="label">Пароль *</label>
            <div className="password-field">
              <input className="input password-field-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required />
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

          <div className="form-group">
            <label className="label">Режим старта</label>
            <div className="plan-segments" role="radiogroup" aria-label="Тариф">
              {Object.entries(PLAN_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={plan === value ? 'active' : ''}
                  onClick={() => setPlan(value)}
                  aria-pressed={plan === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary register-submit" type="submit" disabled={loading}>
            {loading ? 'Создаем организацию...' : plan === 'free' ? 'Создать организацию бесплатно' : `Начать бесплатно на тарифе ${planName}`}
          </button>
        </form>

        <p className="register-bottom">
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </section>
    </main>
  )
}
