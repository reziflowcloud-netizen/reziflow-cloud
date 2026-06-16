'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function ContactClient() {
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
      setError('Заполните имя и контакт для связи.')
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
      setError(data?.error || 'Не удалось отправить заявку. Напишите нам на office@legalhubcrm.com или позвоните по номеру выше.')
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
          <Link href="/" className="contact-brand">
            <img src="/assets/legalhub/legalhub-photo-logo-wide-transparent.png" alt="LegalHub" />
          </Link>
          <p className="marketing-kicker">Связь с LegalHub</p>
          <h1>Расскажите, как вы хотите попробовать CRM</h1>
          <p>
            Оставьте минимум данных, и мы поможем понять, как LegalHub подойдет под ваш процесс:
            лиды, импорт базы, сотрудников и первые дела.
          </p>
          <div className="contact-direct">
            <a href="tel:+48730382448">+48 730 382 448</a>
            <a href="mailto:office@legalhubcrm.com">office@legalhubcrm.com</a>
          </div>
        </section>

        <form className="contact-form" onSubmit={handleSubmit}>
          {sent && (
            <div className="register-ref-note">
              Заявка отправлена. Мы сохранили ее в CRM и свяжемся с вами по указанному контакту.
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
            <label className="label">Ваше имя *</label>
            <input
              className="input"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Напр.: Анна"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Телефон, email или Telegram *</label>
            <input
              className="input"
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder="+48..., email или @username"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Компания</label>
            <input
              className="input"
              value={company}
              onChange={event => setCompany(event.target.value)}
              placeholder="Название компании"
            />
          </div>

          <div className="form-group">
            <label className="label">Что хотите уточнить?</label>
            <textarea
              className="input"
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Например: хочу попробовать CRM, перенести базу или посмотреть демо"
            />
          </div>

          <button className="btn btn-primary register-submit" type="submit" disabled={sending}>
            {sending ? 'Отправляем...' : 'Отправить заявку'}
          </button>
          <p className="contact-note">
            Обязательные поля только имя и контакт. Можно также просто позвонить по номеру выше.
          </p>
        </form>
      </div>
    </main>
  )
}
