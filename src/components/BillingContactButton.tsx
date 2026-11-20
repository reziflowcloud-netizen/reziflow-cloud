'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { billingContactText } from '@/lib/billingContactI18n'

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
  const { lang } = useLanguage()
  const text = billingContactText[lang] || billingContactText.ru
  const id = useId()
  const dialog = useRef<HTMLElement>(null)
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
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
      if (event.key !== 'Tab') return
      const fields = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href]')
      if (!fields?.length) return
      const first = fields[0], last = fields[fields.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previous?.focus() }
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
      setError(text.required)
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
      setError(`${text.error} ${OFFICE_EMAIL}`)
      return
    }

    setSent(true)
    setForm(prev => ({ ...prev, message: '' }))
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        {text.button}
      </button>

      {open && (
        <div className="billing-contact-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            ref={dialog}
            className="billing-contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="billing-contact-head">
              <div>
                <h2 id={`${id}-title`}>{text.title}</h2>
                <p>{text.description}</p>
              </div>
              <button
                type="button"
                className="billing-contact-close"
                aria-label={text.close}
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
                {copied ? text.copied : text.copy}
              </button>
              <div>
                <span>{text.phone}</span>
                <strong>{OFFICE_PHONE}</strong>
              </div>
            </div>

            {sent && (
              <div className="billing-contact-success" role="status">
                {text.sent}
              </div>
            )}
            {error && (
              <div className="billing-contact-error" role="alert">
                {error}
              </div>
            )}

            <form className="billing-contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor={`${id}-name`}>{text.name} *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={event => setField('name', event.target.value)}
                  id={`${id}-name`}
                  placeholder={text.namePlaceholder}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor={`${id}-contact`}>{text.contact} *</label>
                <input
                  className="input"
                  value={form.contact}
                  onChange={event => setField('contact', event.target.value)}
                  id={`${id}-contact`}
                  placeholder={text.contactPlaceholder}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor={`${id}-company`}>{text.company}</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={event => setField('company', event.target.value)}
                  id={`${id}-company`}
                  placeholder={text.companyPlaceholder}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor={`${id}-message`}>{text.message}</label>
                <textarea
                  className="input"
                  rows={5}
                  value={form.message}
                  onChange={event => setField('message', event.target.value)}
                  id={`${id}-message`}
                  placeholder={text.messagePlaceholder}
                />
              </div>

              <button className="btn btn-primary billing-contact-submit" type="submit" disabled={sending}>
                {sending ? text.sending : text.send}
              </button>
              <p className="billing-contact-note">
                {text.note}
              </p>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
