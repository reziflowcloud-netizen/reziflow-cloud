'use client'

import { ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { BillingMetricKey } from '@/lib/billing'

const billingText = {
  ru: {
    title: 'Тариф и оплата',
    restrictedSubtitle: 'Информация доступна администратору организации',
    noAccessTitle: 'Недостаточно прав',
    noAccessBody: 'Тариф, оплату и лимиты может смотреть администратор организации.',
    subtitle: 'План, пробный период и мягкие лимиты организации',
    back: 'Назад',
    currentPlan: 'Текущий тариф',
    softLimitsCopy: 'Сейчас лимиты работают как подсказки: система предупреждает, но не блокирует рабочие данные.',
    trialUntil: 'Пробный период до {date}',
    daysLeft: '{days} дн. осталось',
    periodUntil: 'Период до {date}',
    viewPlans: 'Посмотреть тарифы',
    warningTitle: 'Организация приближается к лимиту Free.',
    warningBody: 'Данные не блокируются, но лучше заранее перейти на Pro или обсудить ручной тариф.',
    usageTitle: 'Использование',
    usageBody: 'Эти счетчики помогают понять, когда пора расширять тариф.',
    unlimited: 'Без лимита',
    percentLimit: '{percent}% лимита',
    customSuffix: 'индивидуально',
    customUnlimited: 'Индивидуально: без лимита',
    noLimitApplied: 'Лимит не применяется',
    includedTitle: 'Что входит',
    includedBody: 'Сейчас это продуктовый контур тарифов. Автоматическую оплату подключим отдельным этапом.',
    nextStepTitle: 'Следующий шаг',
    nextStepBody: 'После проверки интерфейса можно добавить реальные правила: мягкие предупреждения в формах, затем Stripe или ручную оплату через администратора.',
    organizations: 'Организации',
    locale: 'ru-RU',
  },
  uk: {
    title: 'Тариф і оплата',
    restrictedSubtitle: 'Інформація доступна адміністратору організації',
    noAccessTitle: 'Недостатньо прав',
    noAccessBody: 'Тариф, оплату та ліміти може переглядати адміністратор організації.',
    subtitle: 'План, пробний період і м’які ліміти організації',
    back: 'Назад',
    currentPlan: 'Поточний тариф',
    softLimitsCopy: 'Зараз ліміти працюють як підказки: система попереджає, але не блокує робочі дані.',
    trialUntil: 'Пробний період до {date}',
    daysLeft: 'залишилось {days} дн.',
    periodUntil: 'Період до {date}',
    viewPlans: 'Переглянути тарифи',
    warningTitle: 'Організація наближається до ліміту Free.',
    warningBody: 'Дані не блокуються, але краще заздалегідь перейти на Pro або обговорити ручний тариф.',
    usageTitle: 'Використання',
    usageBody: 'Ці лічильники допомагають зрозуміти, коли варто розширювати тариф.',
    unlimited: 'Без ліміту',
    percentLimit: '{percent}% ліміту',
    customSuffix: 'індивідуально',
    customUnlimited: 'Індивідуально: без ліміту',
    noLimitApplied: 'Ліміт не застосовується',
    includedTitle: 'Що входить',
    includedBody: 'Зараз це продуктовий контур тарифів. Автоматичну оплату підключимо окремим етапом.',
    nextStepTitle: 'Наступний крок',
    nextStepBody: 'Після перевірки інтерфейсу можна додати реальні правила: м’які попередження у формах, потім Stripe або ручну оплату через адміністратора.',
    organizations: 'Організації',
    locale: 'uk-UA',
  },
  pl: {
    title: 'Taryf i płatności',
    restrictedSubtitle: 'Informacje są dostępne dla administratora organizacji',
    noAccessTitle: 'Brak uprawnień',
    noAccessBody: 'Taryf, płatności i limity może przeglądać administrator organizacji.',
    subtitle: 'Plan, okres próbny i miękkie limity organizacji',
    back: 'Wstecz',
    currentPlan: 'Aktualny taryf',
    softLimitsCopy: 'Limity działają teraz jako podpowiedzi: system ostrzega, ale nie blokuje danych roboczych.',
    trialUntil: 'Okres próbny do {date}',
    daysLeft: 'pozostało {days} dni',
    periodUntil: 'Okres do {date}',
    viewPlans: 'Zobacz taryfy',
    warningTitle: 'Organizacja zbliża się do limitu Free.',
    warningBody: 'Dane nie są blokowane, ale warto wcześniej przejść na Pro albo omówić taryf ręczny.',
    usageTitle: 'Wykorzystanie',
    usageBody: 'Te liczniki pomagają zrozumieć, kiedy warto rozszerzyć taryf.',
    unlimited: 'Bez limitu',
    percentLimit: '{percent}% limitu',
    customSuffix: 'indywidualnie',
    customUnlimited: 'Indywidualnie: bez limitu',
    noLimitApplied: 'Limit nie jest stosowany',
    includedTitle: 'Co obejmuje',
    includedBody: 'To obecnie produktowy obszar taryfów. Automatyczną płatność podłączymy osobnym etapem.',
    nextStepTitle: 'Następny krok',
    nextStepBody: 'Po sprawdzeniu interfejsu można dodać realne reguły: miękkie ostrzeżenia w formularzach, potem Stripe albo płatność ręczną przez administratora.',
    organizations: 'Organizacje',
    locale: 'pl-PL',
  },
}

const metricLabels: Record<string, Record<BillingMetricKey, string>> = {
  ru: { users: 'Пользователи', clients: 'Клиенты', cases: 'Дела', leads: 'Лиды' },
  uk: { users: 'Користувачі', clients: 'Клієнти', cases: 'Справи', leads: 'Ліди' },
  pl: { users: 'Użytkownicy', clients: 'Klienci', cases: 'Sprawy', leads: 'Leady' },
}

const statusLabels: Record<string, Record<string, string>> = {
  ru: {
    trialing: 'Пробный период',
    active: 'Активна',
    past_due: 'Требует оплаты',
    canceled: 'Отменена',
    manual: 'Ручная оплата',
    default: 'Не настроена',
  },
  uk: {
    trialing: 'Пробний період',
    active: 'Активна',
    past_due: 'Потребує оплати',
    canceled: 'Скасована',
    manual: 'Ручна оплата',
    default: 'Не налаштовано',
  },
  pl: {
    trialing: 'Okres próbny',
    active: 'Aktywna',
    past_due: 'Wymaga płatności',
    canceled: 'Anulowana',
    manual: 'Płatność ręczna',
    default: 'Nie skonfigurowano',
  },
}

const planCopies: Record<string, Record<string, { subtitle: string; price?: string; features: string[] }>> = {
  ru: {
    free: {
      subtitle: 'Для небольшого старта и проверки CRM',
      features: [
        'Базовая CRM: клиенты, дела, задачи и календарь',
        'Импорт и экспорт CSV',
        'Один администратор организации',
        'Ручная оплата и ручное сопровождение',
      ],
    },
    starter: {
      subtitle: 'Для небольшой команды с регулярной работой',
      features: [
        'До 3 пользователей',
        'Работа с лидами и клиентской базой',
        'Настройки процессов и шаблоны документов',
        'Подходит для небольшой фирмы',
      ],
    },
    pro: {
      subtitle: 'Для активной команды и роста продаж',
      features: [
        'До 10 пользователей',
        'Без лимита клиентов, дел и лидов',
        'Интеграции с формами, квизами и рекламой',
        'Приоритетная настройка рабочего процесса',
      ],
    },
    agency: {
      subtitle: 'Для агентств с несколькими отделами',
      price: 'По договоренности',
      features: [
        'Неограниченная команда',
        'Расширенные настройки и интеграции',
        'Помощь с переносом данных',
        'Индивидуальные условия сопровождения',
      ],
    },
    manual: {
      subtitle: 'Ручной тариф для внутреннего администрирования',
      price: 'Ручной',
      features: [
        'Ручное управление доступом',
        'Без автоматических ограничений',
        'Используется для администрируемых организаций',
        'Настройки меняются администратором LegalHub',
      ],
    },
  },
  uk: {
    free: {
      subtitle: 'Для невеликого старту та перевірки CRM',
      features: [
        'Базова CRM: клієнти, справи, завдання і календар',
        'Імпорт та експорт CSV',
        'Один адміністратор організації',
        'Ручна оплата і ручний супровід',
      ],
    },
    starter: {
      subtitle: 'Для невеликої команди з регулярною роботою',
      features: [
        'До 3 користувачів',
        'Робота з лідами та клієнтською базою',
        'Налаштування процесів і шаблони документів',
        'Підходить для невеликої фірми',
      ],
    },
    pro: {
      subtitle: 'Для активної команди і зростання продажів',
      features: [
        'До 10 користувачів',
        'Без ліміту клієнтів, справ і лідів',
        'Інтеграції з формами, квізами та рекламою',
        'Пріоритетне налаштування робочого процесу',
      ],
    },
    agency: {
      subtitle: 'Для агентств з кількома відділами',
      price: 'За домовленістю',
      features: [
        'Необмежена команда',
        'Розширені налаштування та інтеграції',
        'Допомога з перенесенням даних',
        'Індивідуальні умови супроводу',
      ],
    },
    manual: {
      subtitle: 'Ручний тариф для внутрішнього адміністрування',
      price: 'Ручний',
      features: [
        'Ручне керування доступом',
        'Без автоматичних обмежень',
        'Використовується для адміністрованих організацій',
        'Налаштування змінюються адміністратором LegalHub',
      ],
    },
  },
  pl: {
    free: {
      subtitle: 'Dla małego startu i sprawdzenia CRM',
      features: [
        'Podstawowy CRM: klienci, sprawy, zadania i kalendarz',
        'Import i eksport CSV',
        'Jeden administrator organizacji',
        'Płatność ręczna i ręczne wsparcie',
      ],
    },
    starter: {
      subtitle: 'Dla małego zespołu z regularną pracą',
      features: [
        'Do 3 użytkowników',
        'Praca z leadami i bazą klientów',
        'Ustawienia procesów i szablony dokumentów',
        'Dobre dla małej firmy',
      ],
    },
    pro: {
      subtitle: 'Dla aktywnego zespołu i wzrostu sprzedaży',
      features: [
        'Do 10 użytkowników',
        'Bez limitu klientów, spraw i leadów',
        'Integracje z formularzami, quizami i reklamą',
        'Priorytetowa konfiguracja procesu pracy',
      ],
    },
    agency: {
      subtitle: 'Dla agencji z kilkoma działami',
      price: 'Do uzgodnienia',
      features: [
        'Nieograniczony zespół',
        'Rozszerzone ustawienia i integracje',
        'Pomoc z migracją danych',
        'Indywidualne warunki wsparcia',
      ],
    },
    manual: {
      subtitle: 'Taryf ręczny do wewnętrznego administrowania',
      price: 'Ręczny',
      features: [
        'Ręczne zarządzanie dostępem',
        'Bez automatycznych ograniczeń',
        'Używany dla administrowanych organizacji',
        'Ustawienia zmienia administrator LegalHub',
      ],
    },
  },
}

function useBillingText() {
  const { lang } = useLanguage()
  return { lang, text: billingText[lang] || billingText.ru }
}

function replaceValues(value: string, values?: Record<string, ReactNode>) {
  if (!values) return value
  return value.split(/(\{[^}]+\})/g).map((part, index) => {
    const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : ''
    return key && key in values ? <span key={index}>{values[key]}</span> : part
  })
}

export function BillingText({ id, values }: { id: keyof typeof billingText.ru; values?: Record<string, ReactNode> }) {
  const { text } = useBillingText()
  return <>{replaceValues(text[id], values)}</>
}

export function BillingDate({ value }: { value?: string | null }) {
  const { text } = useBillingText()
  if (!value) return <>—</>
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <>—</>
  return <>{date.toLocaleDateString(text.locale)}</>
}

export function BillingLimit({ limit }: { limit: number | null }) {
  const { text } = useBillingText()
  return <>{limit ? String(limit) : text.unlimited}</>
}

export function BillingMetricLabel({ metric }: { metric: BillingMetricKey }) {
  const { lang } = useBillingText()
  return <>{metricLabels[lang]?.[metric] || metricLabels.ru[metric]}</>
}

export function BillingStatusLabel({ status }: { status?: string | null }) {
  const { lang } = useBillingText()
  const labels = statusLabels[lang] || statusLabels.ru
  return <>{labels[String(status || '').toLowerCase()] || labels.default}</>
}

export function BillingUsageNote({ limit, percent, customLimit }: { limit: number | null; percent: number | null; customLimit: boolean }) {
  const { text } = useBillingText()
  if (limit) {
    return (
      <>
        {text.percentLimit.replace('{percent}', String(percent ?? 0))}
        {customLimit ? ` · ${text.customSuffix}` : ''}
      </>
    )
  }
  return <>{customLimit ? text.customUnlimited : text.noLimitApplied}</>
}

export function BillingPlanSubtitle({ planKey, fallback }: { planKey: string; fallback: string }) {
  const { lang } = useBillingText()
  return <>{planCopies[lang]?.[planKey]?.subtitle || planCopies.ru[planKey]?.subtitle || fallback}</>
}

export function BillingPlanPrice({ planKey, fallback }: { planKey: string; fallback: string }) {
  const { lang } = useBillingText()
  return <>{planCopies[lang]?.[planKey]?.price || fallback.replace('/ мес.', lang === 'uk' ? '/ міс.' : lang === 'pl' ? '/ mies.' : '/ мес.')}</>
}

export function BillingFeature({ planKey, index, fallback }: { planKey: string; index: number; fallback: string }) {
  const { lang } = useBillingText()
  return <>{planCopies[lang]?.[planKey]?.features[index] || planCopies.ru[planKey]?.features[index] || fallback}</>
}
