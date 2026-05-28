'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ContactClient() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const subject = encodeURIComponent('Заявка с сайта LegalHub CRM')
    const body = encodeURIComponent([
      `Имя: ${name}`,
      `Контакт: ${contact}`,
      company ? `Компания: ${company}` : '',
      message ? `Вопрос: ${message}` : '',
    ].filter(Boolean).join('\n'))

    window.location.href = `mailto:office@legalhubcrm.com?subject=${subject}&body=${body}`
    setSent(true)
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
              Заявка подготовлена в почтовом клиенте. Если письмо не открылось, напишите нам напрямую на email или позвоните.
            </div>
          )}

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

          <button className="btn btn-primary register-submit" type="submit">Отправить заявку</button>
          <p className="contact-note">
            Обязательные поля только имя и контакт. Можно также просто позвонить по номеру выше.
          </p>
        </form>
      </div>
    </main>
  )
}
