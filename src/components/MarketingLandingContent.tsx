'use client'

import Link from 'next/link'
import { useState } from 'react'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingProductTour from '@/components/MarketingProductTour'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getMarketingCopy } from '@/lib/marketingI18n'

function buildRegisterHref(ref?: string, plan = 'free') {
  const params = new URLSearchParams({ plan })
  if (ref) params.set('ref', ref)
  return `/register?${params.toString()}`
}

function buildPlanHref(planId: string, ref?: string) {
  return planId === 'agency' ? '/contact' : buildRegisterHref(ref, planId)
}

export default function MarketingLandingContent({ referralCode }: { referralCode?: string }) {
  const { lang } = useMarketingLanguage()
  const copy = getMarketingCopy(lang)
  const [heroVideoOpen, setHeroVideoOpen] = useState(false)

  return (
    <main className="marketing-page" id="top">
      <MarketingHeader referralCode={referralCode} copy={copy.header} />

      <section className="marketing-hero">
        <div className="marketing-hero-content">
          <p className="marketing-kicker">{copy.hero.kicker}</p>
          <h1>{copy.hero.title}</h1>
          <p className="marketing-lead">{copy.hero.lead}</p>
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
              <button type="button" className="hero-video-preview" onClick={() => setHeroVideoOpen(true)}>
                <span>▶</span>
                <strong>Смотреть короткий обзор</strong>
                <small>1 минута 24 секунды · видео загрузится после нажатия</small>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="marketing-section problems-section" id="problems">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.problems.kicker}</p>
            <h2>{copy.problems.title}</h2>
          </div>
          <p>{copy.problems.text}</p>
        </div>
        <div className="marketing-grid problem-grid">
          {copy.problems.cards.map(card => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section" id="product">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.product.kicker}</p>
            <h2>{copy.product.title}</h2>
          </div>
          <p>{copy.product.text}</p>
        </div>
        <div className="before-after">
          <article>
            <span>{copy.product.before.eyebrow}</span>
            <h3>{copy.product.before.title}</h3>
            <ul>
              {copy.product.before.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="after">
            <span>{copy.product.after.eyebrow}</span>
            <h3>{copy.product.after.title}</h3>
            <ul>
              {copy.product.after.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="marketing-section product-tour-section" id="demo">
        <MarketingProductTour copy={copy.productTour} />
      </section>

      <section className="marketing-section muted manager-section" id="manager-view">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.managerView.kicker}</p>
            <h2>{copy.managerView.title}</h2>
          </div>
          <p>{copy.managerView.text}</p>
        </div>
        <div className="marketing-grid manager-grid">
          {copy.managerView.cards.map(card => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section muted" id="process">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.workflow.kicker}</p>
            <h2>{copy.workflow.title}</h2>
          </div>
          <p>{copy.workflow.text}</p>
        </div>
        <div className="workflow-rail">
          {copy.workflow.steps.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section migration-section">
        <div>
          <p className="marketing-kicker">{copy.migration.kicker}</p>
          <h2>{copy.migration.title}</h2>
          <p>{copy.migration.text}</p>
        </div>
        <div className="migration-panel">
          {copy.migration.steps.map(step => (
            <div key={step.number}>
              <strong>{step.number}</strong>
              <span>
                <b>{step.title}</b>
                <small>{step.text}</small>
              </span>
            </div>
          ))}
          <p className="migration-note">{copy.migration.note}</p>
        </div>
      </section>

      <section className="marketing-section" id="services">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.services.kicker}</p>
            <h2>{copy.services.title}</h2>
          </div>
          <p>{copy.services.text}</p>
        </div>
        <div className="marketing-grid services-grid">
          {copy.services.cards.map(card => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section comparison-section" id="crm-comparison">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.comparison.kicker}</p>
            <h2>{copy.comparison.title}</h2>
          </div>
          <p>{copy.comparison.text}</p>
        </div>
        <div className="comparison-grid">
          {[copy.comparison.generic, copy.comparison.legalhub].map((column, index) => (
            <article className={index === 1 ? 'comparison-card legalhub' : 'comparison-card'} key={column.eyebrow}>
              <span>{column.eyebrow}</span>
              <h3>{column.title}</h3>
              <ul>
                {column.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section muted" id="security">
        <div className="section-heading-row">
          <div>
            <p className="marketing-kicker">{copy.security.kicker}</p>
            <h2>{copy.security.title}</h2>
          </div>
          <p>{copy.security.text}</p>
        </div>
        <div className="marketing-grid security-grid">
          {copy.security.cards.map(card => (
            <article key={card.title}><h3>{card.title}</h3><p>{card.text}</p></article>
          ))}
        </div>
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

      <section className="marketing-section faq" id="faq">
        <p className="marketing-kicker">{copy.faq.kicker}</p>
        <h2>{copy.faq.title}</h2>
        {copy.faq.items.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
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
          <a href="mailto:office@legalhubcrm.com">office@legalhubcrm.com</a>
          <a href="tel:+48730382448">{copy.footer.phoneLabel}: +48 730 382 448</a>
        </div>
      </footer>
    </main>
  )
}
