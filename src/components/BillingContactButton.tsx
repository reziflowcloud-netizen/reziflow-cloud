'use client'

import { FormEvent, useEffect, useState } from 'react'

const OFFICE_EMAIL = 'office@legalhubcrm.com'
const OFFICE_PHONE = '+48 730 382 448'

type ContactForm = {
  name: string
  contact: string
  company: string
  message: string
}

type BillingContactButtonProps = {
  initialName?: string
  initialContact?: string
  initialCompany?: string
}

export default function BillingContactButton({
  initialName = '',
  initialContact = '',
  initialCompany = '',
}: BillingContactButtonProps) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<ContactForm>({
    name: initialName,
    contact: initialContact,
    company: initialCompany,
    message: '',
  })

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function setField<Key extends keyof ContactForm>(key: Key, value: ContactForm[Key]) {
    setError('')
    setSent(false)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(OFFICE_EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSent(false)

    if (!form.name.trim() || !form.contact.trim()) {
      setError('Заполните имя и контакт для связи.')
      return
    }

    setSending(true)
    const response = await fetch('/api/billing/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null)
    setSending(false)

    if (!response?.ok) {
      const data = await response?.json().catch(() => null)
      setError(data?.error || `Не удалось отправить заявку. Напишите нам напрямую: ${OFFICE_EMAIL}`)
      return
    }

    setSent(true)
    setForm(prev => ({ ...prev, message: '' }))
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Связаться
      </button>

      {open && (
        <div className="billing-contact-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="billing-contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-contact-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="billing-contact-head">
              <div>
                <h2 id="billing-contact-title">Связаться с LegalHub</h2>
                <p>Оставьте заявку, и мы поможем с тарифом, демо или переносом базы.</p>
              </div>
              <button
                type="button"
                className="billing-contact-close"
                aria-label="Закрыть окно"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="billing-contact-direct">
              <div>
                <span>Email</span>
                <strong>{OFFICE_EMAIL}</strong>
              </div>
              <button type="button" className="btn btn-secondary" onClick={copyEmail}>
                {copied ? 'Скопировано' : 'Скопировать email'}
              </button>
              <div>
                <span>Телефон</span>
                <strong>{OFFICE_PHONE}</strong>
              </div>
            </div>

            {sent && (
              <div className="billing-contact-success">
                Заявка отправлена. Мы свяжемся с вами по указанному контакту.
              </div>
            )}
            {error && (
              <div className="billing-contact-error">
                {error}
              </div>
            )}

            <form className="billing-contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Ваше имя *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={event => setField('name', event.target.value)}
                  placeholder="Напр.: Анна"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Телефон, email или Telegram *</label>
                <input
                  className="input"
                  value={form.contact}
                  onChange={event => setField('contact', event.target.value)}
                  placeholder="+48..., email или @username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Компания</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={event => setField('company', event.target.value)}
                  placeholder="Название компании"
                />
              </div>

              <div className="form-group">
                <label className="label">Что хотите уточнить?</label>
                <textarea
                  className="input"
                  rows={5}
                  value={form.message}
                  onChange={event => setField('message', event.target.value)}
                  placeholder="Например: хочу попробовать CRM, перенести базу или посмотреть демо"
                />
              </div>

              <button className="btn btn-primary billing-contact-submit" type="submit" disabled={sending}>
                {sending ? 'Отправляем...' : 'Отправить заявку'}
              </button>
              <p className="billing-contact-note">
                Обязательные поля только имя и контакт. Можно также просто позвонить по номеру выше.
              </p>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
