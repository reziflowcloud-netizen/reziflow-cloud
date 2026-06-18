'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingProductTour from '@/components/MarketingProductTour'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getMarketingCopy, type MarketingLang } from '@/lib/marketingI18n'

type LandingTextCard = {
  title: string
  text: string
}

type LandingCopy = {
  heroWindowTitle: string
  videoAria: string
  videoUnsupported: string
  videoPreviewAria: string
  posterAlt: string
  videoOpenLabel: string
  benefit: {
    kicker: string
    title: string
    text: string
    cards: Array<LandingTextCard & { number: string }>
  }
  setup: {
    title: string
    text: string
    cta: string
    cards: Array<LandingTextCard & { icon: string; items: string[]; badge: string }>
  }
  security: {
    kicker: string
    title: string
    text: string
    cards: LandingTextCard[]
  }
  launch: {
    kicker: string
    title: string
    text: string
    note: string
    cta: string
  }
  footerFaq: string
  closeFaq: string
}

const ruLandingCopy: LandingCopy = {
  heroWindowTitle: 'Короткий обзор LegalHub CRM',
  videoAria: 'Ознакомительное видео LegalHub CRM',
  videoUnsupported: 'Ваш браузер не поддерживает встроенное видео. Напишите нам, и мы отправим обзор отдельно.',
  videoPreviewAria: 'Смотреть короткий обзор LegalHub CRM',
  posterAlt: 'Dashboard LegalHub: полный контроль агентства в одном окне',
  videoOpenLabel: 'Смотреть обзор 1 мин',
  benefit: {
    kicker: 'Коротко о выгоде',
    title: 'LegalHub собирает хаос в один рабочий процесс',
    text: 'Вместо чатов, Excel, Drive и постоянных вопросов сотрудникам: один экран, где видно клиента, услугу, документы, срок, оплату и ответственного.',
    cards: [
      {
        number: '01',
        title: 'Заявки не теряются',
        text: 'Сайт, Instagram, Facebook, Telegram и WhatsApp попадают в один поток.',
      },
      {
        number: '02',
        title: 'Документы видны сразу',
        text: 'По делу понятно, что получено, чего не хватает и что запросить у клиента.',
      },
      {
        number: '03',
        title: 'Сроки под контролем',
        text: 'Дедлайн, ответственный и следующий шаг закреплены за каждым делом.',
      },
      {
        number: '04',
        title: 'Руководитель видит картину',
        text: 'Просрочки, нагрузка, оплаты и проблемные клиенты видны без ежедневных вопросов.',
      },
    ],
  },
  setup: {
    title: 'Начните работу за несколько минут',
    text: 'Быстрый перенос клиентов и гибкая настройка CRM под ваш бизнес',
    cta: 'Попробовать бесплатно',
    cards: [
      {
        icon: '↯',
        title: 'Быстрый перенос',
        text: 'Импортируйте клиентов из Excel, Google Sheets, старой CRM или обычного списка за несколько минут.',
        items: ['Excel и Google Sheets', 'Старая CRM', 'Любые списки клиентов'],
        badge: '5-10 минут',
      },
      {
        icon: '⚙',
        title: 'Гибкая настройка',
        text: 'Настройте CRM под вашу работу: услуги, этапы, сотрудников и права доступа.',
        items: ['Услуги', 'Этапы работы', 'Сотрудники и роли', 'Права доступа', 'Любая структура'],
        badge: 'Любая структура',
      },
    ],
  },
  security: {
    kicker: 'Безопасность и доступы',
    title: 'Доступы можно настроить под вашу команду',
    text: 'Вы сами решаете, что видит каждый сотрудник: всю базу, отдельные разделы или только клиентов и дела в своей зоне ответственности.',
    cards: [
      {
        title: 'Для руководителя',
        text: 'Можно оставить полный доступ к клиентам, документам, оплатам и работе команды.',
      },
      {
        title: 'Для сотрудника',
        text: 'Можно открыть только его клиентов, задачи и дела в зоне ответственности.',
      },
      {
        title: 'Для вашей фирмы',
        text: 'Роли и права настраиваются под структуру команды и ваш рабочий порядок.',
      },
    ],
  },
  launch: {
    kicker: 'Спокойный запуск',
    title: 'Поможем запустить первый процесс',
    text: 'Не нужно переносить всю компанию сразу. Можно начать с одного процесса — например Karta Pobytu — добавить 5-10 клиентов, настроить этапы и проверить LegalHub в реальной работе.',
    note: 'Подходит для одного специалиста, маленькой команды и растущей фирмы.',
    cta: 'Запросить запуск',
  },
  footerFaq: 'Частые вопросы',
  closeFaq: 'Закрыть вопросы',
}

const ukLandingCopy: LandingCopy = {
  heroWindowTitle: 'Короткий огляд LegalHub CRM',
  videoAria: 'Ознайомче відео LegalHub CRM',
  videoUnsupported: 'Ваш браузер не підтримує вбудоване відео. Напишіть нам, і ми надішлемо огляд окремо.',
  videoPreviewAria: 'Подивитися короткий огляд LegalHub CRM',
  posterAlt: 'Dashboard LegalHub: повний контроль агентства в одному вікні',
  videoOpenLabel: 'Подивитися огляд 1 хв',
  benefit: {
    kicker: 'Коротко про користь',
    title: 'LegalHub збирає хаос в один робочий процес',
    text: 'Замість чатів, Excel, Drive і постійних питань до співробітників: один екран, де видно клієнта, послугу, документи, строк, оплату й відповідального.',
    cards: [
      {
        number: '01',
        title: 'Заявки не губляться',
        text: 'Сайт, Instagram, Facebook, Telegram і WhatsApp потрапляють в один потік.',
      },
      {
        number: '02',
        title: 'Документи видно одразу',
        text: 'По справі зрозуміло, що отримано, чого не вистачає і що запросити у клієнта.',
      },
      {
        number: '03',
        title: 'Строки під контролем',
        text: 'Дедлайн, відповідальний і наступний крок закріплені за кожною справою.',
      },
      {
        number: '04',
        title: 'Керівник бачить картину',
        text: 'Прострочення, навантаження, оплати й проблемні клієнти видно без щоденних питань.',
      },
    ],
  },
  setup: {
    title: 'Почніть роботу за кілька хвилин',
    text: 'Швидке перенесення клієнтів і гнучке налаштування CRM під ваш бізнес',
    cta: 'Спробувати безкоштовно',
    cards: [
      {
        icon: '↯',
        title: 'Швидке перенесення',
        text: 'Імпортуйте клієнтів з Excel, Google Sheets, старої CRM або звичайного списку за кілька хвилин.',
        items: ['Excel і Google Sheets', 'Стара CRM', 'Будь-які списки клієнтів'],
        badge: '5-10 хвилин',
      },
      {
        icon: '⚙',
        title: 'Гнучке налаштування',
        text: 'Налаштуйте CRM під вашу роботу: послуги, етапи, співробітників і права доступу.',
        items: ['Послуги', 'Етапи роботи', 'Співробітники й ролі', 'Права доступу', 'Будь-яка структура'],
        badge: 'Будь-яка структура',
      },
    ],
  },
  security: {
    kicker: 'Безпека та доступи',
    title: 'Доступи можна налаштувати під вашу команду',
    text: 'Ви самі вирішуєте, що бачить кожен співробітник: усю базу, окремі розділи або тільки клієнтів і справи у своїй зоні відповідальності.',
    cards: [
      {
        title: 'Для керівника',
        text: 'Можна залишити повний доступ до клієнтів, документів, оплат і роботи команди.',
      },
      {
        title: 'Для співробітника',
        text: 'Можна відкрити тільки його клієнтів, задачі та справи в зоні відповідальності.',
      },
      {
        title: 'Для вашої фірми',
        text: 'Ролі й права налаштовуються під структуру команди та ваш робочий порядок.',
      },
    ],
  },
  launch: {
    kicker: 'Спокійний запуск',
    title: 'Допоможемо запустити перший процес',
    text: 'Не потрібно переносити всю компанію одразу. Можна почати з одного процесу — наприклад Karta Pobytu — додати 5-10 клієнтів, налаштувати етапи й перевірити LegalHub у реальній роботі.',
    note: 'Підходить для одного спеціаліста, невеликої команди та компанії, що зростає.',
    cta: 'Запросити запуск',
  },
  footerFaq: 'Часті запитання',
  closeFaq: 'Закрити запитання',
}

const enLandingCopy: LandingCopy = {
  heroWindowTitle: 'Short LegalHub CRM overview',
  videoAria: 'Introductory LegalHub CRM video',
  videoUnsupported: 'Your browser does not support embedded video. Write to us and we will send the overview separately.',
  videoPreviewAria: 'Watch a short LegalHub CRM overview',
  posterAlt: 'LegalHub dashboard: full agency control in one workspace',
  videoOpenLabel: 'Watch 1 min overview',
  benefit: {
    kicker: 'In short',
    title: 'LegalHub turns chaos into one working process',
    text: 'Instead of chats, Excel, Drive and constant team questions: one screen with the client, service, documents, deadline, payment and responsible person.',
    cards: [
      {
        number: '01',
        title: 'Requests are not lost',
        text: 'Website, Instagram, Facebook, Telegram and WhatsApp go into one flow.',
      },
      {
        number: '02',
        title: 'Documents are visible immediately',
        text: 'For each case it is clear what has been received, what is missing and what to request from the client.',
      },
      {
        number: '03',
        title: 'Deadlines stay under control',
        text: 'Deadline, owner and next step are attached to every case.',
      },
      {
        number: '04',
        title: 'The manager sees the picture',
        text: 'Overdue items, workload, payments and problematic clients are visible without daily status checks.',
      },
    ],
  },
  setup: {
    title: 'Start working in a few minutes',
    text: 'Quick client migration and flexible CRM setup for your business',
    cta: 'Try for free',
    cards: [
      {
        icon: '↯',
        title: 'Quick migration',
        text: 'Import clients from Excel, Google Sheets, an old CRM or a regular list in a few minutes.',
        items: ['Excel and Google Sheets', 'Old CRM', 'Any client lists'],
        badge: '5-10 minutes',
      },
      {
        icon: '⚙',
        title: 'Flexible setup',
        text: 'Adjust the CRM to your work: services, stages, employees and access rights.',
        items: ['Services', 'Work stages', 'Employees and roles', 'Access rights', 'Any structure'],
        badge: 'Any structure',
      },
    ],
  },
  security: {
    kicker: 'Security and access',
    title: 'Access can be configured for your team',
    text: 'You decide what each employee can see: the whole base, selected sections or only clients and cases in their responsibility area.',
    cards: [
      {
        title: 'For the manager',
        text: 'You can keep full access to clients, documents, payments and team work.',
      },
      {
        title: 'For an employee',
        text: 'You can show only their clients, tasks and cases in their responsibility area.',
      },
      {
        title: 'For your company',
        text: 'Roles and permissions adapt to your team structure and working order.',
      },
    ],
  },
  launch: {
    kicker: 'Calm launch',
    title: 'We can help launch the first process',
    text: 'You do not have to move the whole company at once. Start with one process, for example Karta Pobytu, add 5-10 clients, set up stages and test LegalHub in real work.',
    note: 'Works for a solo specialist, a small team and a growing company.',
    cta: 'Request launch',
  },
  footerFaq: 'FAQ',
  closeFaq: 'Close FAQ',
}

const plLandingCopy: LandingCopy = {
  heroWindowTitle: 'Krótki przegląd LegalHub CRM',
  videoAria: 'Wprowadzające wideo LegalHub CRM',
  videoUnsupported: 'Twoja przeglądarka nie obsługuje osadzonego wideo. Napisz do nas, a wyślemy przegląd osobno.',
  videoPreviewAria: 'Obejrzyj krótki przegląd LegalHub CRM',
  posterAlt: 'Dashboard LegalHub: pełna kontrola agencji w jednym miejscu',
  videoOpenLabel: 'Obejrzyj przegląd 1 min',
  benefit: {
    kicker: 'Krótko o korzyści',
    title: 'LegalHub zamienia chaos w jeden proces pracy',
    text: 'Zamiast czatów, Excela, Drive i ciągłych pytań do zespołu: jeden ekran, gdzie widać klienta, usługę, dokumenty, termin, płatność i osobę odpowiedzialną.',
    cards: [
      {
        number: '01',
        title: 'Zgłoszenia się nie gubią',
        text: 'Strona, Instagram, Facebook, Telegram i WhatsApp trafiają do jednego strumienia.',
      },
      {
        number: '02',
        title: 'Dokumenty widać od razu',
        text: 'Przy sprawie jest jasne, co otrzymano, czego brakuje i o co poprosić klienta.',
      },
      {
        number: '03',
        title: 'Terminy są pod kontrolą',
        text: 'Deadline, odpowiedzialny i następny krok są przypisane do każdej sprawy.',
      },
      {
        number: '04',
        title: 'Manager widzi całość',
        text: 'Opóźnienia, obciążenie, płatności i problemowi klienci są widoczni bez codziennych pytań.',
      },
    ],
  },
  setup: {
    title: 'Zacznij pracę w kilka minut',
    text: 'Szybkie przeniesienie klientów i elastyczne ustawienie CRM pod Twój biznes',
    cta: 'Spróbuj bezpłatnie',
    cards: [
      {
        icon: '↯',
        title: 'Szybkie przeniesienie',
        text: 'Zaimportuj klientów z Excela, Google Sheets, starego CRM albo zwykłej listy w kilka minut.',
        items: ['Excel i Google Sheets', 'Stary CRM', 'Dowolne listy klientów'],
        badge: '5-10 minut',
      },
      {
        icon: '⚙',
        title: 'Elastyczne ustawienia',
        text: 'Dopasuj CRM do swojej pracy: usługi, etapy, pracowników i prawa dostępu.',
        items: ['Usługi', 'Etapy pracy', 'Pracownicy i role', 'Prawa dostępu', 'Dowolna struktura'],
        badge: 'Dowolna struktura',
      },
    ],
  },
  security: {
    kicker: 'Bezpieczeństwo i dostępy',
    title: 'Dostępy można dopasować do zespołu',
    text: 'Sam decydujesz, co widzi każdy pracownik: całą bazę, wybrane sekcje albo tylko klientów i sprawy w swojej strefie odpowiedzialności.',
    cards: [
      {
        title: 'Dla managera',
        text: 'Można zostawić pełny dostęp do klientów, dokumentów, płatności i pracy zespołu.',
      },
      {
        title: 'Dla pracownika',
        text: 'Można otworzyć tylko jego klientów, zadania i sprawy w strefie odpowiedzialności.',
      },
      {
        title: 'Dla Twojej firmy',
        text: 'Role i prawa dopasowują się do struktury zespołu i sposobu pracy.',
      },
    ],
  },
  launch: {
    kicker: 'Spokojne wdrożenie',
    title: 'Pomożemy uruchomić pierwszy proces',
    text: 'Nie trzeba przenosić całej firmy od razu. Można zacząć od jednego procesu, na przykład Karta Pobytu, dodać 5-10 klientów, ustawić etapy i sprawdzić LegalHub w realnej pracy.',
    note: 'Dla jednego specjalisty, małego zespołu i rozwijającej się firmy.',
    cta: 'Poproś o wdrożenie',
  },
  footerFaq: 'Najczęstsze pytania',
  closeFaq: 'Zamknij pytania',
}

const landingCopy: Record<MarketingLang, LandingCopy> = {
  en: enLandingCopy,
  ru: ruLandingCopy,
  uk: ukLandingCopy,
  pl: plLandingCopy,
}

function buildRegisterHref(ref?: string, plan = 'free') {
  const params = new URLSearchParams({ plan })
  if (ref) params.set('ref', ref)
  return `/register?${params.toString()}`
}

function buildPlanHref(planId: string, ref?: string) {
  return planId === 'agency' ? '/contact' : buildRegisterHref(ref, planId)
}

export default function MarketingLandingContent({
  referralCode,
  initialSectionId,
  isAuthenticated = false,
}: {
  referralCode?: string
  initialSectionId?: string
  isAuthenticated?: boolean
}) {
  const { lang } = useMarketingLanguage()
  const copy = getMarketingCopy(lang)
  const localCopy = landingCopy[lang] || ruLandingCopy
  const [heroVideoOpen, setHeroVideoOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const faqItems = copy.faq.items.slice(0, 8)

  useEffect(() => {
    if (!initialSectionId) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(initialSectionId)?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialSectionId])

  useEffect(() => {
    if (!faqOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFaqOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [faqOpen])

  return (
    <main className="marketing-page" id="top">
      <MarketingHeader
        referralCode={referralCode}
        copy={copy.header}
        isAuthenticated={isAuthenticated}
        onFaqOpen={() => setFaqOpen(true)}
      />

      <section className="marketing-hero">
        <div className="marketing-hero-content">
          <p className="marketing-kicker">{copy.hero.kicker}</p>
          <h1>{copy.hero.title}</h1>
          <p className="marketing-lead">{copy.hero.lead}</p>
          <p className="hero-fit-note">{copy.hero.fitNote}</p>
          <div className="marketing-cta-row">
            <a href="#demo" className="marketing-primary large">{copy.hero.primary}</a>
            <Link href={buildRegisterHref(referralCode)} className="marketing-secondary">{copy.hero.secondary}</Link>
          </div>
          <div className="marketing-proof">
            {copy.hero.proof.map(item => (
              <span key={`${item.strong}-${item.text}`}><strong>{item.strong}</strong> {item.text}</span>
            ))}
          </div>
        </div>

        <div className="hero-product-card" aria-label={copy.hero.dashboardAria}>
          <div className="hero-window-top"><span /><span /><span /><strong>{localCopy.heroWindowTitle}</strong></div>
          <div className="hero-video-frame">
            {heroVideoOpen ? (
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                aria-label={localCopy.videoAria}
              >
                <source src="/assets/legalhub/legalhub-overview.mov" />
                {localCopy.videoUnsupported}
              </video>
            ) : (
              <button
                type="button"
                className="hero-video-preview"
                onClick={() => setHeroVideoOpen(true)}
                aria-label={localCopy.videoPreviewAria}
              >
                <img
                  className="hero-video-poster"
                  src="/assets/legalhub/hero-video-poster.png?v=20260614"
                  alt={localCopy.posterAlt}
                />
                <span className="hero-play">▶</span>
                <span className="hero-video-open-label">{localCopy.videoOpenLabel}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="marketing-section compact-intro" id="product">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{localCopy.benefit.kicker}</p>
            <h2>{localCopy.benefit.title}</h2>
          </div>
          <p>{localCopy.benefit.text}</p>
        </div>

        <div className="change-grid">
          {localCopy.benefit.cards.map(card => (
            <article key={card.title}>
              <span>{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section product-tour-section" id="demo">
        <MarketingProductTour copy={copy.productTour} />
      </section>

      <section className="marketing-section setup-fast-section" id="process">
        <div className="setup-fast-shell">
          <div className="setup-fast-heading">
            <h2>{localCopy.setup.title}</h2>
            <p>{localCopy.setup.text}</p>
          </div>
          <div className="setup-fast-grid">
            {localCopy.setup.cards.map(card => (
              <article className="setup-fast-card" key={card.title}>
                <div className="setup-fast-card-head">
                  <span className="setup-fast-icon" aria-hidden="true">{card.icon}</span>
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </div>
                </div>
                <ul>
                  {card.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className="setup-fast-badge">{card.badge}</span>
              </article>
            ))}
          </div>
          <div className="setup-fast-action">
            <Link href={buildRegisterHref(referralCode)} className="marketing-primary large">{localCopy.setup.cta}</Link>
          </div>
        </div>
      </section>

      <section className="marketing-section muted security-lite" id="security">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{localCopy.security.kicker}</p>
            <h2>{localCopy.security.title}</h2>
          </div>
          <p>{localCopy.security.text}</p>
        </div>
        <div className="security-lite-grid">
          {localCopy.security.cards.map(card => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section launch-callout">
        <div>
          <p className="marketing-kicker">{localCopy.launch.kicker}</p>
          <h2>{localCopy.launch.title}</h2>
          <p>{localCopy.launch.text}</p>
          <small>{localCopy.launch.note}</small>
        </div>
        <Link href="/contact" className="marketing-primary large">{localCopy.launch.cta}</Link>
      </section>

      <section className="marketing-section" id="pricing">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.pricing.kicker}</p>
            <h2>{copy.pricing.title}</h2>
          </div>
          <p>{copy.pricing.text}</p>
        </div>
        <div className="pricing-grid">
          {copy.pricing.plans.map(plan => (
            <article className={['pricing-card', plan.id === 'free' ? 'free' : '', plan.id === 'pro' ? 'featured' : ''].filter(Boolean).join(' ')} key={plan.id}>
              <span className="pricing-eyebrow">{plan.eyebrow}</span>
              <div className="pricing-head">
                <h3>{plan.name}</h3>
                <strong>{plan.price}<small>{plan.period}</small></strong>
              </div>
              <p>{plan.text}</p>
              <ul>
                {plan.items.map(item => <li key={item}>{item}</li>)}
              </ul>
              <Link href={buildPlanHref(plan.id, referralCode)} className="marketing-primary">{plan.buttonLabel}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-final">
        <div>
          <p className="marketing-kicker">{copy.final.kicker}</p>
          <h2>{copy.final.title}</h2>
          <p>{copy.final.text}</p>
          <small>{copy.final.note}</small>
        </div>
        <div className="marketing-final-actions">
          <Link href={buildRegisterHref(referralCode)} className="marketing-primary large">{copy.final.primary}</Link>
          <a href="#demo" className="marketing-secondary">{copy.final.secondary}</a>
        </div>
      </section>

      <footer className="marketing-footer">
        <Link href="/" className="marketing-brand">
          <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
        </Link>
        <div className="marketing-footer-text">
          <span>{copy.footer.tagline}</span>
          <small>Copyright © 2026 LegalHub CRM, All Rights Reserved.</small>
        </div>
        <div className="marketing-footer-contact">
          <button type="button" className="marketing-footer-faq" onClick={() => setFaqOpen(true)}>{localCopy.footerFaq}</button>
          <a href="mailto:office@legalhubcrm.com">office@legalhubcrm.com</a>
          <a href="tel:+48730382448">{copy.footer.phoneLabel}: +48 730 382 448</a>
        </div>
      </footer>

      {faqOpen && (
        <div className="faq-modal" role="dialog" aria-modal="true" aria-labelledby="faq-modal-title">
          <button type="button" className="faq-modal-backdrop" aria-label={localCopy.closeFaq} onClick={() => setFaqOpen(false)} />
          <section className="faq-modal-panel">
            <button type="button" className="faq-modal-close" aria-label={localCopy.closeFaq} onClick={() => setFaqOpen(false)}>×</button>
            <p className="marketing-kicker">{copy.faq.kicker}</p>
            <h2 id="faq-modal-title">{copy.faq.title}</h2>
            <div className="faq-list">
              {faqItems.map(item => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
