'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingProductTour from '@/components/MarketingProductTour'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getMarketingCopy } from '@/lib/marketingI18n'

const changeCards = [
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
]

const setupCards = [
  {
    icon: '↯',
    title: 'Быстрый перенос',
    text: 'Импортируйте клиентов из Excel, Google Sheets, старой CRM или обычного списка за несколько минут.',
    items: ['Excel и Google Sheets', 'Старая CRM', 'Любые списки клиентов'],
    badge: '5–10 минут',
  },
  {
    icon: '⚙',
    title: 'Гибкая настройка',
    text: 'Настройте CRM под вашу работу: услуги, этапы, сотрудников и права доступа.',
    items: ['Услуги', 'Этапы работы', 'Сотрудники и роли', 'Права доступа', 'Любая структура'],
    badge: 'Любая структура',
  },
]

const securityCards = [
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
]

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
}: {
  referralCode?: string
  initialSectionId?: string
}) {
  const { lang } = useMarketingLanguage()
  const copy = getMarketingCopy(lang)
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
      <MarketingHeader referralCode={referralCode} copy={copy.header} onFaqOpen={() => setFaqOpen(true)} />

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
          <div className="hero-window-top"><span /><span /><span /><strong>Короткий обзор LegalHub CRM</strong></div>
          <div className="hero-video-frame">
            {heroVideoOpen ? (
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                aria-label="Ознакомительное видео LegalHub CRM"
              >
                <source src="/assets/legalhub/legalhub-overview.mov" />
                Ваш браузер не поддерживает встроенное видео. Напишите нам, и мы отправим обзор отдельно.
              </video>
            ) : (
              <button
                type="button"
                className="hero-video-preview"
                onClick={() => setHeroVideoOpen(true)}
                aria-label="Смотреть короткий обзор LegalHub CRM"
              >
                <img
                  className="hero-video-poster"
                  src="/assets/legalhub/hero-video-poster.png?v=20260614"
                  alt="Dashboard LegalHub: полный контроль агентства в одном окне"
                />
                <span className="hero-play">▶</span>
                <span className="hero-video-open-label">Смотреть обзор 1 мин</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="marketing-section compact-intro" id="product">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">Коротко о выгоде</p>
            <h2>LegalHub собирает хаос в один рабочий процесс</h2>
          </div>
          <p>Вместо чатов, Excel, Drive и постоянных вопросов сотрудникам: один экран, где видно клиента, услугу, документы, срок, оплату и ответственного.</p>
        </div>

        <div className="change-grid">
          {changeCards.map(card => (
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
            <h2>Начните работу за несколько минут</h2>
            <p>Быстрый перенос клиентов и гибкая настройка CRM под ваш бизнес</p>
          </div>
          <div className="setup-fast-grid">
            {setupCards.map(card => (
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
            <Link href={buildRegisterHref(referralCode)} className="marketing-primary large">Попробовать бесплатно</Link>
          </div>
        </div>
      </section>

      <section className="marketing-section muted security-lite" id="security">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">Безопасность и доступы</p>
            <h2>Доступы можно настроить под вашу команду</h2>
          </div>
          <p>Вы сами решаете, что видит каждый сотрудник: всю базу, отдельные разделы или только клиентов и дела в своей зоне ответственности.</p>
        </div>
        <div className="security-lite-grid">
          {securityCards.map(card => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section launch-callout">
        <div>
          <p className="marketing-kicker">Спокойный запуск</p>
          <h2>Поможем запустить первый процесс</h2>
          <p>Не нужно переносить всю компанию сразу. Можно начать с одного процесса — например Karta Pobytu — добавить 5–10 клиентов, настроить этапы и проверить LegalHub в реальной работе.</p>
          <small>Подходит для одного специалиста, маленькой команды и растущей фирмы.</small>
        </div>
        <Link href="/contact" className="marketing-primary large">Запросить запуск</Link>
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
          <button type="button" className="marketing-footer-faq" onClick={() => setFaqOpen(true)}>Частые вопросы</button>
          <a href="mailto:office@legalhubcrm.com">office@legalhubcrm.com</a>
          <a href="tel:+48730382448">{copy.footer.phoneLabel}: +48 730 382 448</a>
        </div>
      </footer>

      {faqOpen && (
        <div className="faq-modal" role="dialog" aria-modal="true" aria-labelledby="faq-modal-title">
          <button type="button" className="faq-modal-backdrop" aria-label="Закрыть вопросы" onClick={() => setFaqOpen(false)} />
          <section className="faq-modal-panel">
            <button type="button" className="faq-modal-close" aria-label="Закрыть вопросы" onClick={() => setFaqOpen(false)}>×</button>
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
