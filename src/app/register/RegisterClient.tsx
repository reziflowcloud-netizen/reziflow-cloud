'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

export default function RegisterClient({ initialPlan, referralCode }: { initialPlan: string, referralCode?: string }) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <main className="register-page">
      <section className="register-panel">
        <Link href="/" className="register-logo">
          <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
        </Link>
        <p className="marketing-kicker">Бесплатный старт</p>
        <h1>Создайте организацию и начните работу в LegalHub</h1>
        <p className="register-lead">
          После регистрации вы сразу попадете в LegalHub CRM. Карту добавлять не нужно, а подходящий тариф можно выбрать позже.
        </p>

        <form onSubmit={handleSubmit} className="register-form">
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
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required />
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

      <aside className="register-aside" aria-label="Что входит в старт">
        <div>
          <strong>Что будет создано</strong>
          <ul>
            <li>Отдельная организация в CRM</li>
            <li>Первый администратор с полным доступом</li>
            <li>Базовые статусы, приоритеты и настройки дел</li>
            <li>Запуск без карты и предоплаты</li>
          </ul>
        </div>
      </aside>
    </main>
  )
}
