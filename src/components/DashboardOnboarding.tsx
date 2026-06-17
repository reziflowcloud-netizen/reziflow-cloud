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
  const legacyStorageKey = `legalhub:onboarding:${organizationId}`
  const collapsedStorageKey = `${legacyStorageKey}:collapsed`
  const skippedStorageKey = `${legacyStorageKey}:skipped`
  const [collapsed, setCollapsed] = useState(false)
  const [skippedStepIds, setSkippedStepIds] = useState<string[]>([])
  const skippedSet = useMemo(() => new Set(skippedStepIds), [skippedStepIds])
  const completedCount = useMemo(() => steps.filter(step => step.done).length, [steps])
  const resolvedCount = useMemo(
    () => steps.filter(step => step.done || skippedSet.has(step.id)).length,
    [steps, skippedSet]
  )
  const isComplete = completedCount === steps.length

  useEffect(() => {
    try {
      const legacyValue = window.localStorage.getItem(legacyStorageKey)
      if (legacyValue === 'dismissed') {
        setCollapsed(true)
        window.localStorage.setItem(collapsedStorageKey, 'true')
        window.localStorage.removeItem(legacyStorageKey)
      } else {
        setCollapsed(window.localStorage.getItem(collapsedStorageKey) === 'true')
      }

      const storedSkipped = window.localStorage.getItem(skippedStorageKey)
      setSkippedStepIds(storedSkipped ? JSON.parse(storedSkipped) : [])
    } catch {
      setCollapsed(false)
      setSkippedStepIds([])
    }
  }, [collapsedStorageKey, legacyStorageKey, skippedStorageKey])

  function toggleCollapsed(nextValue: boolean) {
    setCollapsed(nextValue)
    try {
      window.localStorage.setItem(collapsedStorageKey, String(nextValue))
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
  }

  function toggleSkipped(stepId: string) {
    setSkippedStepIds(current => {
      const next = current.includes(stepId)
        ? current.filter(id => id !== stepId)
        : [...current, stepId]

      try {
        window.localStorage.setItem(skippedStorageKey, JSON.stringify(next))
      } catch {
        // Local storage can be unavailable in private browser modes.
      }

      return next
    })
  }

  if (isComplete) return null

  if (collapsed) {
    return (
      <section className="onboarding-panel onboarding-panel-collapsed" aria-labelledby="dashboard-onboarding-title">
        <div>
          <div className="section-title" style={{ marginBottom: 6 }}>Быстрый старт</div>
          <h2 id="dashboard-onboarding-title">Первые шаги в CRM</h2>
          <p>{resolvedCount}/{steps.length} шагов закрыто. Можно продолжить настройку позже.</p>
        </div>
        <div className="onboarding-collapsed-actions">
          <div className="onboarding-progress" aria-label={`Закрыто ${resolvedCount} из ${steps.length}`}>
            <strong>{resolvedCount}/{steps.length}</strong>
            <span>закрыто</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => toggleCollapsed(false)}>Развернуть</button>
        </div>
      </section>
    )
  }

  return (
    <section className="onboarding-panel" aria-labelledby="dashboard-onboarding-title">
      <div className="onboarding-panel-head">
        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>Быстрый старт</div>
          <h2 id="dashboard-onboarding-title">Первые шаги в CRM</h2>
          <p>Настройте рабочее пространство, чтобы после регистрации сразу вести клиентов, дела и команду. Ненужные шаги можно пропустить.</p>
        </div>
        <div className="onboarding-progress" aria-label={`Закрыто ${resolvedCount} из ${steps.length}`}>
          <strong>{resolvedCount}/{steps.length}</strong>
          <span>закрыто</span>
        </div>
      </div>

      <div className="onboarding-steps">
        {steps.map((step, index) => {
          const skipped = !step.done && skippedSet.has(step.id)

          return (
            <article key={step.id} className={`onboarding-step ${step.done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''}`}>
              <Link href={step.href} className="onboarding-step-main">
                <span className="onboarding-step-check" aria-hidden="true">{step.done ? '✓' : skipped ? '—' : index + 1}</span>
                <span className="onboarding-step-copy">
                  <span className="onboarding-step-title">{step.title}</span>
                  <span className="onboarding-step-desc">{step.description}</span>
                  {step.meta && <span className="onboarding-step-meta">{step.meta}</span>}
                </span>
                <span className="onboarding-step-action">{step.done ? 'Готово' : skipped ? 'Пропущено' : step.action}</span>
              </Link>
              {!step.done && (
                <button type="button" className="onboarding-step-skip" onClick={() => toggleSkipped(step.id)}>
                  {skipped ? 'Вернуть шаг' : 'Пропустить'}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <div className="onboarding-panel-foot">
        <Link href="/cases/new" className="btn btn-primary">+ Новое дело</Link>
        <Link href="/clients/new" className="btn btn-secondary">+ Новый клиент</Link>
        <button type="button" className="btn btn-ghost" onClick={() => toggleCollapsed(true)}>Свернуть</button>
      </div>
    </section>
  )
}
