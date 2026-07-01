'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import PasswordEyeIcon from '@/components/PasswordEyeIcon'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getAuthCopy } from '@/lib/authI18n'

type PlanId = 'free' | 'starter' | 'pro' | 'agency'

const PLAN_IDS: PlanId[] = ['free', 'starter', 'pro', 'agency']

function normalizePlan(value: string): PlanId {
  return PLAN_IDS.includes(value as PlanId) ? value as PlanId : 'free'
}

const LEGAL_CONSENT_COPY = {
  ru: {
    prefix: 'Я принимаю',
    and: 'и',
    terms: 'Regulamin',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
    required: 'Подтвердите согласие с документами LegalHub.',
  },
  uk: {
    prefix: 'Я приймаю',
    and: 'та',
    terms: 'Regulamin',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
    required: 'Підтвердьте згоду з документами LegalHub.',
  },
  pl: {
    prefix: 'Akceptuję',
    and: 'oraz',
    terms: 'Regulamin',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
    required: 'Potwierdź akceptację dokumentów LegalHub.',
  },
  en: {
    prefix: 'I accept',
    and: 'and',
    terms: 'Regulamin',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
    required: 'Please confirm that you accept the LegalHub documents.',
  },
}

export default function RegisterClient({ initialPlan, referralCode }: { initialPlan: string, referralCode?: string }) {
  const router = useRouter()
  const { lang } = useMarketingLanguage()
  const copy = getAuthCopy(lang).register
  const legalCopy = LEGAL_CONSENT_COPY[lang] || LEGAL_CONSENT_COPY.ru
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [plan, setPlan] = useState<PlanId>(normalizePlan(initialPlan))
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const planName = useMemo(() => copy.planLabels[plan], [copy.planLabels, plan])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!acceptedLegal) {
      setError(legalCopy.required)
      return
    }
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
        setError(copy.createError)
        return
      }
      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError(copy.connectionError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page auth-register-page">
      <section className="register-panel register-info-panel" aria-label={copy.infoAria}>
        <p className="marketing-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p className="register-lead">{copy.lead}</p>
        <div className="register-benefit-grid">
          {copy.benefits.map(benefit => (
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

      <section className="register-form-shell" aria-label={copy.formAria}>
        <form onSubmit={handleSubmit} className="register-form">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <MarketingLanguageSelect />
          </div>

          <Link href="/" className="register-logo">
            <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
          </Link>
          <p className="marketing-kicker">{copy.formKicker}</p>

          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label className="label">{copy.companyName}</label>
            <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={copy.companyPlaceholder} required />
          </div>

          <div className="form-group">
            <label className="label">{copy.adminName}</label>
            <input className="input" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder={copy.adminPlaceholder} required />
          </div>

          <div className="form-group">
            <label className="label">{copy.email}</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={copy.emailPlaceholder} required />
          </div>

          <div className="form-group">
            <label className="label">{copy.password}</label>
            <div className="password-field">
              <input className="input password-field-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={copy.passwordPlaceholder} minLength={6} required />
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

          <div className="form-group">
            <label className="label">{copy.startMode}</label>
            <div className="plan-segments" role="radiogroup" aria-label={copy.planAria}>
              {PLAN_IDS.map(value => (
                <button
                  key={value}
                  type="button"
                  className={plan === value ? 'active' : ''}
                  onClick={() => setPlan(value)}
                  aria-pressed={plan === value}
                >
                  {copy.planLabels[value]}
                </button>
              ))}
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              color: 'var(--muted)',
              fontSize: 13,
              lineHeight: 1.45,
              margin: '4px 0 14px',
            }}
          >
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={event => setAcceptedLegal(event.target.checked)}
              required
              style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--brand)', flex: '0 0 auto' }}
            />
            <span>
              {legalCopy.prefix}{' '}
              <Link href="/regulamin" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>{legalCopy.terms}</Link>
              {', '}
              <Link href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>{legalCopy.privacy}</Link>
              {' '}
              {legalCopy.and}{' '}
              <Link href="/data-deletion" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>{legalCopy.dataDeletion}</Link>.
            </span>
          </label>

          <button className="btn btn-primary register-submit" type="submit" disabled={loading || !acceptedLegal}>
            {loading ? copy.loading : plan === 'free' ? copy.submitFree : copy.submitPlan.replace('{plan}', planName)}
          </button>
        </form>

        <p className="register-bottom">
          {copy.already} <Link href="/login">{copy.loginLink}</Link>
        </p>
      </section>
    </main>
  )
}
