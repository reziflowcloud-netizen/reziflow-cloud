'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export type DashboardOnboardingStep = {
  id: string
  title: string
  description: string
  href: string
  action: string
  done: boolean
  meta?: string
}

type DashboardOnboardingProps = {
  organizationId: string
  steps: DashboardOnboardingStep[]
}

export default function DashboardOnboarding({ organizationId, steps }: DashboardOnboardingProps) {
  const storageKey = `legalhub:onboarding:${organizationId}`
  const [dismissed, setDismissed] = useState(false)
  const completedCount = useMemo(() => steps.filter(step => step.done).length, [steps])
  const isComplete = completedCount === steps.length

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === 'dismissed')
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(storageKey, 'dismissed')
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
  }

  if (dismissed || isComplete) return null

  return (
    <section className="onboarding-panel" aria-labelledby="dashboard-onboarding-title">
      <div className="onboarding-panel-head">
        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>Быстрый старт</div>
          <h2 id="dashboard-onboarding-title">Первые шаги в CRM</h2>
          <p>Настройте рабочее пространство, чтобы после регистрации сразу вести клиентов, дела и команду.</p>
        </div>
        <div className="onboarding-progress" aria-label={`Готово ${completedCount} из ${steps.length}`}>
          <strong>{completedCount}/{steps.length}</strong>
          <span>готово</span>
        </div>
      </div>

      <div className="onboarding-steps">
        {steps.map((step, index) => (
          <Link key={step.id} href={step.href} className={`onboarding-step ${step.done ? 'is-done' : ''}`}>
            <span className="onboarding-step-check" aria-hidden="true">{step.done ? '✓' : index + 1}</span>
            <span className="onboarding-step-copy">
              <span className="onboarding-step-title">{step.title}</span>
              <span className="onboarding-step-desc">{step.description}</span>
              {step.meta && <span className="onboarding-step-meta">{step.meta}</span>}
            </span>
            <span className="onboarding-step-action">{step.done ? 'Готово' : step.action}</span>
          </Link>
        ))}
      </div>

      <div className="onboarding-panel-foot">
        <Link href="/cases/new" className="btn btn-primary">+ Новое дело</Link>
        <Link href="/clients/new" className="btn btn-secondary">+ Новый клиент</Link>
        <button type="button" className="btn btn-ghost" onClick={dismiss}>Скрыть</button>
      </div>
    </section>
  )
}
