'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import { getConferenceCopy } from '@/lib/conferenceI18n'
import { trackConferenceEvent } from '@/lib/conferenceTrackingClient'
import type { ConferenceLanguage } from '@/lib/conferenceTrackingCore'
import styles from './conference.module.css'

const CAMPAIGN = 'conference_legalization_poland'
const REGISTER_HREF = `/register?plan=free&utm_source=conference&utm_medium=conference_landing&utm_campaign=${CAMPAIGN}&utm_content=register_cta`
const DEMO_HREF = `/conference/demo?utm_source=conference&utm_medium=conference_landing&utm_campaign=${CAMPAIGN}&utm_content=demo_cta`
const MAIN_SITE_HREF = `/?utm_source=conference&utm_medium=conference_landing&utm_campaign=${CAMPAIGN}&utm_content=main_website`
const WEBSITE_HREF = 'https://legalhubcrm.com/'
const PHONE_HREF = 'tel:+48730382448'
const INSTAGRAM_HREF = 'https://www.instagram.com/legalhubcrm/'

function ArrowIcon() {
  return <span className={styles.arrow} aria-hidden="true">→</span>
}

function BenefitIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5" />
      </svg>
    )
  }

  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m8 12 3 3 6-7" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9S14.4 18.5 12 21M12 3C9.6 5.5 8.3 8.5 8.3 12S9.6 18.5 12 21" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.7" r=".8" className={styles.instagramDot} />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.4 3.5 10 8.1 7.9 10a15.3 15.3 0 0 0 6.1 6.1l1.9-2.1 4.6 2.6-.8 3.1c-.2.8-.9 1.3-1.7 1.3C9.7 21 3 14.3 3 6c0-.8.5-1.5 1.3-1.7Z" />
    </svg>
  )
}

function CtaButtons({
  demo,
  register,
  language,
  ctaLocation,
}: {
  demo: string
  register: string
  language: ConferenceLanguage
  ctaLocation: 'hero' | 'final'
}) {
  return (
    <div className={styles.actions}>
      <a href={DEMO_HREF} className={styles.secondaryButton}>
        <span>{demo}</span><ArrowIcon />
      </a>
      <a
        href={REGISTER_HREF}
        className={styles.primaryButton}
        onClick={() => trackConferenceEvent('conference_register_click', { language, ctaLocation })}
      >
        <span>{register}</span>
      </a>
    </div>
  )
}

export default function ConferenceLanding({ demoUnavailable }: { demoUnavailable: boolean }) {
  const { lang } = useMarketingLanguage('uk')
  const copy = getConferenceCopy(lang)

  useEffect(() => {
    document.title = copy.meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.meta.description)
  }, [copy])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      trackConferenceEvent('conference_page_view', { language: lang })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [lang])

  return (
    <main className={styles.page} lang={lang}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <header className={styles.header}>
            <a href={MAIN_SITE_HREF} className={styles.logo} aria-label="LegalHub CRM">
              <Image
                src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png"
                alt="LegalHub CRM"
                width={1131}
                height={274}
                priority
              />
            </a>
            <div className={styles.language}><MarketingLanguageSelect defaultLang="uk" /></div>
          </header>

          {demoUnavailable && <div className={styles.alert} role="alert">{copy.demoUnavailable}</div>}

          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <span className={styles.eyebrow}>{copy.hero.eyebrow}</span>
              <h1>
                <span>{copy.hero.title}</span>
                <strong>{copy.hero.accent}</strong>
              </h1>
              <p>{copy.hero.text}</p>
            </div>

            <figure className={styles.dashboardFrame}>
              <div className={styles.dashboardCrop}>
                <Image
                  src="/assets/legalhub/conference-dashboard-approved.png"
                  alt={copy.hero.imageAlt}
                  width={1532}
                  height={868}
                  priority
                />
              </div>
            </figure>

            <div className={styles.heroActions}>
              <CtaButtons demo={copy.hero.demo} register={copy.hero.register} language={lang} ctaLocation="hero" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefits} id="overview">
        <div className={styles.benefitsInner}>
          <div className={styles.benefitList}>
            {copy.benefits.map((item, index) => (
              <article key={item.title}>
                <div className={styles.icon}><BenefitIcon index={index} /></div>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.note}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5C14.5 16.3 14 17 14 18h-4c0-1-.5-1.7-1.5-2.5Z" />
            </svg>
            <p>{copy.note}</p>
          </div>

          <CtaButtons demo={copy.hero.demo} register={copy.hero.register} language={lang} ctaLocation="final" />

          <footer className={styles.footer}>
            <a href={WEBSITE_HREF}>
              <GlobeIcon />
              <span>legalhubcrm.com</span>
            </a>
            <i className={styles.footerDivider} aria-hidden="true" />
            <a href={PHONE_HREF} aria-label="Позвонить: +48 730 382 448">
              <PhoneIcon />
              <span>+48 730 382 448</span>
            </a>
            <i className={styles.footerDivider} aria-hidden="true" />
            <a href={INSTAGRAM_HREF} target="_blank" rel="noreferrer">
              <InstagramIcon />
              <span>@legalhubcrm</span>
            </a>
          </footer>
        </div>
      </section>
    </main>
  )
}
