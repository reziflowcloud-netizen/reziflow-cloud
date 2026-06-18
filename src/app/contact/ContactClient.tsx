'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import MarketingLanguageSelect from '@/components/MarketingLanguageSelect'
import { useMarketingLanguage } from '@/hooks/useMarketingLanguage'
import type { MarketingLang } from '@/lib/marketingI18n'

type ContactCopy = {
  kicker: string
  title: string
  text: string
  sent: string
  validation: string
  sendError: string
  name: string
  namePlaceholder: string
  contact: string
  contactPlaceholder: string
  company: string
  companyPlaceholder: string
  message: string
  messagePlaceholder: string
  sending: string
  submit: string
  note: string
}

const ruContactCopy: ContactCopy = {
  kicker: 'Связь с LegalHub',
  title: 'Расскажите, как вы хотите попробовать CRM',
  text: 'Оставьте минимум данных, и мы поможем понять, как LegalHub подойдет под ваш процесс: лиды, импорт базы, сотрудников и первые дела.',
  sent: 'Заявка отправлена. Мы сохранили ее в CRM и свяжемся с вами по указанному контакту.',
  validation: 'Заполните имя и контакт для связи.',
  sendError: 'Не удалось отправить заявку. Напишите нам на office@legalhubcrm.com или позвоните по номеру выше.',
  name: 'Ваше имя *',
  namePlaceholder: 'Напр.: Анна',
  contact: 'Телефон, email или Telegram *',
  contactPlaceholder: '+48..., email или @username',
  company: 'Компания',
  companyPlaceholder: 'Название компании',
  message: 'Что хотите уточнить?',
  messagePlaceholder: 'Например: хочу попробовать CRM, перенести базу или посмотреть демо',
  sending: 'Отправляем...',
  submit: 'Отправить заявку',
  note: 'Обязательные поля только имя и контакт. Можно также просто позвонить по номеру выше.',
}

const ukContactCopy: ContactCopy = {
  kicker: 'Звʼязок з LegalHub',
  title: 'Розкажіть, як ви хочете спробувати CRM',
  text: 'Залиште мінімум даних, і ми допоможемо зрозуміти, як LegalHub підійде під ваш процес: ліди, імпорт бази, співробітники та перші справи.',
  sent: 'Заявку відправлено. Ми зберегли її в CRM і звʼяжемося з вами за вказаним контактом.',
  validation: 'Заповніть імʼя та контакт для звʼязку.',
  sendError: 'Не вдалося відправити заявку. Напишіть нам на office@legalhubcrm.com або зателефонуйте за номером вище.',
  name: 'Ваше імʼя *',
  namePlaceholder: 'Напр.: Анна',
  contact: 'Телефон, email або Telegram *',
  contactPlaceholder: '+48..., email або @username',
  company: 'Компанія',
  companyPlaceholder: 'Назва компанії',
  message: 'Що хочете уточнити?',
  messagePlaceholder: 'Наприклад: хочу спробувати CRM, перенести базу або подивитися демо',
  sending: 'Відправляємо...',
  submit: 'Відправити заявку',
  note: 'Обовʼязкові поля тільки імʼя та контакт. Також можна просто зателефонувати за номером вище.',
}

const contactCopy: Record<MarketingLang, ContactCopy> = {
  en: ruContactCopy,
  ru: ruContactCopy,
  uk: ukContactCopy,
  pl: ruContactCopy,
}

export default function ContactClient() {
  const { lang } = useMarketingLanguage()
  const copy = contactCopy[lang] || ruContactCopy
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSent(false)

    if (!name.trim() || !contact.trim()) {
      setError(copy.validation)
      return
    }

    setSending(true)
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        contact,
        company,
        message,
        website,
        page: typeof window !== 'undefined' ? window.location.href : '/contact',
      }),
    }).catch(() => null)
    setSending(false)

    if (!response?.ok) {
      const data = await response?.json().catch(() => null)
      setError(lang === 'ru' ? data?.error || copy.sendError : copy.sendError)
      return
    }

    setSent(true)
    setName('')
    setContact('')
    setCompany('')
    setMessage('')
    setWebsite('')
  }

  return (
    <main className="contact-page">
      <div className="contact-shell">
        <section className="contact-copy">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 40 }}>
            <Link href="/" className="contact-brand" style={{ marginBottom: 0 }}>
              <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
            </Link>
            <MarketingLanguageSelect />
          </div>
          <p className="marketing-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
          <div className="contact-direct">
            <a href="tel:+48730382448">+48 730 382 448</a>
            <a href="mailto:office@legalhubcrm.com">office@legalhubcrm.com</a>
          </div>
        </section>

        <form className="contact-form" onSubmit={handleSubmit}>
          {sent && (
            <div className="register-ref-note">
              {copy.sent}
            </div>
          )}

          {error && (
            <div className="register-ref-note" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <input
            type="text"
            value={website}
            onChange={event => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ display: 'none' }}
          />

          <div className="form-group">
            <label className="label">{copy.name}</label>
            <input
              className="input"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={copy.namePlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">{copy.contact}</label>
            <input
              className="input"
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder={copy.contactPlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">{copy.company}</label>
            <input
              className="input"
              value={company}
              onChange={event => setCompany(event.target.value)}
              placeholder={copy.companyPlaceholder}
            />
          </div>

          <div className="form-group">
            <label className="label">{copy.message}</label>
            <textarea
              className="input"
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder={copy.messagePlaceholder}
            />
          </div>

          <button className="btn btn-primary register-submit" type="submit" disabled={sending}>
            {sending ? copy.sending : copy.submit}
          </button>
          <p className="contact-note">
            {copy.note}
          </p>
        </form>
      </div>
    </main>
  )
}
