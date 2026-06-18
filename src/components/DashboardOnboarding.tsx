'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { Lang } from '@/lib/translations'

export type DashboardOnboardingStepId = 'services' | 'statuses' | 'team' | 'clients' | 'first-case'

export type DashboardOnboardingStep = {
  id: DashboardOnboardingStepId
  href: string
  done: boolean
  count?: number
  userCount?: number
  employeeCount?: number
}

type DashboardOnboardingProps = {
  organizationId: string
  steps: DashboardOnboardingStep[]
}

type OnboardingCopy = {
  section: string
  title: string
  intro: string
  progressLabel: string
  expand: string
  collapse: string
  done: string
  skipped: string
  skip: string
  restore: string
  newCase: string
  newClient: string
  closedText: (resolved: number, total: number) => string
  closedAria: (resolved: number, total: number) => string
  steps: Record<DashboardOnboardingStepId, {
    title: string
    description: string
    action: string
  }>
}

const COPY: Record<Lang, OnboardingCopy> = {
  ru: {
    section: 'Быстрый старт',
    title: 'Первые шаги в CRM',
    intro: 'Настройте рабочее пространство, чтобы после регистрации сразу вести клиентов, дела и команду. Ненужные шаги можно пропустить.',
    progressLabel: 'закрыто',
    expand: 'Развернуть',
    collapse: 'Свернуть',
    done: 'Готово',
    skipped: 'Пропущено',
    skip: 'Пропустить',
    restore: 'Вернуть шаг',
    newCase: '+ Новое дело',
    newClient: '+ Новый клиент',
    closedText: (resolved, total) => `${resolved}/${total} шагов закрыто. Можно продолжить настройку позже.`,
    closedAria: (resolved, total) => `Закрыто ${resolved} из ${total}`,
    steps: {
      services: {
        title: 'Добавьте услуги',
        description: 'Список услуг помогает быстрее создавать дела и считать стоимость.',
        action: 'Настроить',
      },
      statuses: {
        title: 'Проверьте статусы дел',
        description: 'Оставьте стандартные этапы или адаптируйте их под процесс вашей фирмы.',
        action: 'Открыть',
      },
      team: {
        title: 'Добавьте команду',
        description: 'Пригласите пользователей или заведите ответственных сотрудников для назначения дел.',
        action: 'Добавить',
      },
      clients: {
        title: 'Добавьте первых клиентов',
        description: 'Создайте клиента вручную или импортируйте базу из CSV.',
        action: 'Добавить',
      },
      'first-case': {
        title: 'Создайте первое дело',
        description: 'Откройте первое дело, выберите услугу и проверьте карточку клиента в работе.',
        action: 'Создать',
      },
    },
  },
  uk: {
    section: 'Швидкий старт',
    title: 'Перші кроки в CRM',
    intro: 'Налаштуйте робочий простір, щоб після реєстрації одразу вести клієнтів, справи та команду. Непотрібні кроки можна пропустити.',
    progressLabel: 'закрито',
    expand: 'Розгорнути',
    collapse: 'Згорнути',
    done: 'Готово',
    skipped: 'Пропущено',
    skip: 'Пропустити',
    restore: 'Повернути крок',
    newCase: '+ Нова справа',
    newClient: '+ Новий клієнт',
    closedText: (resolved, total) => `${resolved}/${total} кроків закрито. Можна продовжити налаштування пізніше.`,
    closedAria: (resolved, total) => `Закрито ${resolved} з ${total}`,
    steps: {
      services: {
        title: 'Додайте послуги',
        description: 'Список послуг допомагає швидше створювати справи та рахувати вартість.',
        action: 'Налаштувати',
      },
      statuses: {
        title: 'Перевірте статуси справ',
        description: 'Залиште стандартні етапи або адаптуйте їх під процес вашої фірми.',
        action: 'Відкрити',
      },
      team: {
        title: 'Додайте команду',
        description: 'Запросіть користувачів або додайте відповідальних співробітників для призначення справ.',
        action: 'Додати',
      },
      clients: {
        title: 'Додайте перших клієнтів',
        description: 'Створіть клієнта вручну або імпортуйте базу з CSV.',
        action: 'Додати',
      },
      'first-case': {
        title: 'Створіть першу справу',
        description: 'Відкрийте першу справу, виберіть послугу та перевірте картку клієнта в роботі.',
        action: 'Створити',
      },
    },
  },
  pl: {
    section: 'Szybki start',
    title: 'Pierwsze kroki w CRM',
    intro: 'Skonfiguruj przestrzeń pracy, aby od razu po rejestracji prowadzić klientów, sprawy i zespół. Niepotrzebne kroki można pominąć.',
    progressLabel: 'zamknięte',
    expand: 'Rozwiń',
    collapse: 'Zwiń',
    done: 'Gotowe',
    skipped: 'Pominięto',
    skip: 'Pomiń',
    restore: 'Przywróć krok',
    newCase: '+ Nowa sprawa',
    newClient: '+ Nowy klient',
    closedText: (resolved, total) => `${resolved}/${total} kroków zamknięto. Możesz kontynuować konfigurację później.`,
    closedAria: (resolved, total) => `Zamknięto ${resolved} z ${total}`,
    steps: {
      services: {
        title: 'Dodaj usługi',
        description: 'Lista usług pomaga szybciej tworzyć sprawy i liczyć koszt.',
        action: 'Ustaw',
      },
      statuses: {
        title: 'Sprawdź statusy spraw',
        description: 'Zostaw standardowe etapy albo dopasuj je do procesu swojej firmy.',
        action: 'Otwórz',
      },
      team: {
        title: 'Dodaj zespół',
        description: 'Zaproś użytkowników albo dodaj odpowiedzialnych pracowników do przypisywania spraw.',
        action: 'Dodaj',
      },
      clients: {
        title: 'Dodaj pierwszych klientów',
        description: 'Utwórz klienta ręcznie albo zaimportuj bazę z CSV.',
        action: 'Dodaj',
      },
      'first-case': {
        title: 'Utwórz pierwszą sprawę',
        description: 'Otwórz pierwszą sprawę, wybierz usługę i sprawdź kartę klienta w pracy.',
        action: 'Utwórz',
      },
    },
  },
}

function stepMeta(step: DashboardOnboardingStep, lang: Lang) {
  const count = step.count || 0

  if (lang === 'uk') {
    switch (step.id) {
      case 'services':
        return count > 0 ? `${count} активн.` : 'Поки порожньо'
      case 'statuses':
        return count > 0 ? `${count} статусів` : 'Потрібно налаштувати'
      case 'team':
        return step.done ? `${step.userCount || 0} корист. / ${step.employeeCount || 0} співр.` : 'Лише адміністратор'
      case 'clients':
        return count > 0 ? `${count} клієнтів` : 'Можна почати з одного клієнта'
      case 'first-case':
        return count > 0 ? `${count} справ` : 'Після додавання клієнта'
    }
  }

  if (lang === 'pl') {
    switch (step.id) {
      case 'services':
        return count > 0 ? `${count} aktyw.` : 'Na razie pusto'
      case 'statuses':
        return count > 0 ? `${count} statusów` : 'Trzeba skonfigurować'
      case 'team':
        return step.done ? `${step.userCount || 0} użytk. / ${step.employeeCount || 0} prac.` : 'Tylko administrator'
      case 'clients':
        return count > 0 ? `${count} klientów` : 'Można zacząć od jednego klienta'
      case 'first-case':
        return count > 0 ? `${count} spraw` : 'Po dodaniu klienta'
    }
  }

  switch (step.id) {
    case 'services':
      return count > 0 ? `${count} активн.` : 'Пока пусто'
    case 'statuses':
      return count > 0 ? `${count} статусов` : 'Нужно настроить'
    case 'team':
      return step.done ? `${step.userCount || 0} польз. / ${step.employeeCount || 0} сотр.` : 'Только администратор'
    case 'clients':
      return count > 0 ? `${count} клиентов` : 'Можно начать с одного клиента'
    case 'first-case':
      return count > 0 ? `${count} дел` : 'После добавления клиента'
  }
}

export default function DashboardOnboarding({ organizationId, steps }: DashboardOnboardingProps) {
  const { lang } = useLanguage()
  const copy = COPY[lang] || COPY.ru
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
          <div className="section-title" style={{ marginBottom: 6 }}>{copy.section}</div>
          <h2 id="dashboard-onboarding-title">{copy.title}</h2>
          <p>{copy.closedText(resolvedCount, steps.length)}</p>
        </div>
        <div className="onboarding-collapsed-actions">
          <div className="onboarding-progress" aria-label={copy.closedAria(resolvedCount, steps.length)}>
            <strong>{resolvedCount}/{steps.length}</strong>
            <span>{copy.progressLabel}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => toggleCollapsed(false)}>{copy.expand}</button>
        </div>
      </section>
    )
  }

  return (
    <section className="onboarding-panel" aria-labelledby="dashboard-onboarding-title">
      <div className="onboarding-panel-head">
        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>{copy.section}</div>
          <h2 id="dashboard-onboarding-title">{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <div className="onboarding-progress" aria-label={copy.closedAria(resolvedCount, steps.length)}>
          <strong>{resolvedCount}/{steps.length}</strong>
          <span>{copy.progressLabel}</span>
        </div>
      </div>

      <div className="onboarding-steps">
        {steps.map((step, index) => {
          const skipped = !step.done && skippedSet.has(step.id)
          const stepCopy = copy.steps[step.id]

          return (
            <article key={step.id} className={`onboarding-step ${step.done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''}`}>
              <Link href={step.href} className="onboarding-step-main">
                <span className="onboarding-step-check" aria-hidden="true">{step.done ? '✓' : skipped ? '—' : index + 1}</span>
                <span className="onboarding-step-copy">
                  <span className="onboarding-step-title">{stepCopy.title}</span>
                  <span className="onboarding-step-desc">{stepCopy.description}</span>
                  <span className="onboarding-step-meta">{stepMeta(step, lang)}</span>
                </span>
                <span className="onboarding-step-action">{step.done ? copy.done : skipped ? copy.skipped : stepCopy.action}</span>
              </Link>
              {!step.done && (
                <button type="button" className="onboarding-step-skip" onClick={() => toggleSkipped(step.id)}>
                  {skipped ? copy.restore : copy.skip}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <div className="onboarding-panel-foot">
        <Link href="/cases/new" className="btn btn-primary">{copy.newCase}</Link>
        <Link href="/clients/new" className="btn btn-secondary">{copy.newClient}</Link>
        <button type="button" className="btn btn-ghost" onClick={() => toggleCollapsed(true)}>{copy.collapse}</button>
      </div>
    </section>
  )
}
