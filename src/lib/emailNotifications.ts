const DEFAULT_CONTACT_EMAIL = 'office@legalhubcrm.com'

type ContactNotificationInput = {
  subject: string
  title: string
  lines: Array<[string, string | null | undefined]>
  message?: string | null
  replyTo?: string | null
}

type RegistrationNotificationInput = {
  organizationId: string
  organizationName: string
  organizationSlug?: string | null
  adminName: string
  adminEmail: string
  plan?: string | null
  status?: string | null
  billingStatus?: string | null
  referralCode?: string | null
  landingPath?: string | null
  sourcePage?: string | null
}

type PasswordResetLanguage = 'ru' | 'uk' | 'pl' | 'en'

type PasswordResetEmailInput = {
  to: string
  resetUrl: string
  language: PasswordResetLanguage
}

function recipientsFromEnv() {
  const raw = process.env.CONTACT_EMAIL_TO || process.env.NOTIFICATION_EMAIL || DEFAULT_CONTACT_EMAIL
  return raw
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textBody(input: ContactNotificationInput) {
  return [
    input.title,
    '',
    ...input.lines
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`),
    input.message ? ['', 'Комментарий:', input.message] : '',
  ].flat().filter(Boolean).join('\n')
}

function htmlBody(input: ContactNotificationInput) {
  const rows = input.lines
    .filter(([, value]) => value)
    .map(([label, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#64748b;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;color:#0f172a;vertical-align:top;">${escapeHtml(String(value))}</td>
      </tr>
    `)
    .join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 14px;font-size:20px;">${escapeHtml(input.title)}</h2>
      <table style="border-collapse:collapse;margin-bottom:16px;">${rows}</table>
      ${input.message ? `
        <div style="margin-top:12px;padding:14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
          <strong style="display:block;margin-bottom:6px;">Комментарий</strong>
          <div>${escapeHtml(input.message).replace(/\n/g, '<br>')}</div>
        </div>
      ` : ''}
    </div>
  `
}

function replyToHeader(value?: string | null) {
  const email = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined
}

export async function sendContactNotification(input: ContactNotificationInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Contact email skipped: RESEND_API_KEY is not configured')
    return { sent: false, skipped: true, reason: 'RESEND_API_KEY is not configured' }
  }

  const to = recipientsFromEnv()
  if (!to.length) {
    console.warn('Contact email skipped: no recipients configured')
    return { sent: false, skipped: true, reason: 'No recipients configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.CONTACT_EMAIL_FROM || 'LegalHub CRM <notifications@legalhubcrm.com>',
      to,
      subject: input.subject,
      text: textBody(input),
      html: htmlBody(input),
      reply_to: replyToHeader(input.replyTo),
    }),
  }).catch(error => {
    console.error('Contact email request failed:', error)
    return null
  })

  if (!response) {
    return { sent: false, skipped: false, reason: 'Email provider request failed' }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Contact email failed:', response.status, detail)
    return { sent: false, skipped: false, reason: `Resend error ${response.status}` }
  }

  return { sent: true, skipped: false }
}

export async function sendRegistrationNotification(input: RegistrationNotificationInput) {
  const createdAt = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })

  return sendContactNotification({
    subject: `New LegalHub CRM registration: ${input.organizationName}`,
    title: 'New LegalHub CRM registration',
    replyTo: input.adminEmail,
    lines: [
      ['Organization', input.organizationName],
      ['Organization slug', input.organizationSlug],
      ['Organization ID', input.organizationId],
      ['Admin name', input.adminName],
      ['Admin email', input.adminEmail],
      ['Plan', input.plan],
      ['Organization status', input.status],
      ['Billing status', input.billingStatus],
      ['Referral code', input.referralCode],
      ['Landing path', input.landingPath],
      ['Registration page', input.sourcePage],
      ['Created at', `${createdAt} Europe/Warsaw`],
    ],
    message: 'A new organization was created in LegalHub CRM. You can reply directly to this email to contact the new administrator.',
  })
}

const PASSWORD_RESET_EMAIL_COPY: Record<PasswordResetLanguage, {
  subject: string
  title: string
  intro: string
  button: string
  expires: string
  ignore: string
}> = {
  ru: {
    subject: 'Восстановление пароля LegalHub CRM',
    title: 'Восстановление пароля',
    intro: 'Мы получили запрос на восстановление пароля для вашей учётной записи LegalHub CRM.',
    button: 'Создать новый пароль',
    expires: 'Ссылка действует 30 минут.',
    ignore: 'Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.',
  },
  uk: {
    subject: 'Відновлення пароля LegalHub CRM',
    title: 'Відновлення пароля',
    intro: 'Ми отримали запит на відновлення пароля для вашого облікового запису LegalHub CRM.',
    button: 'Створити новий пароль',
    expires: 'Посилання діє 30 хвилин.',
    ignore: 'Якщо ви не запитували відновлення пароля, просто проігноруйте цей лист.',
  },
  pl: {
    subject: 'Reset hasła LegalHub CRM',
    title: 'Reset hasła',
    intro: 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta LegalHub CRM.',
    button: 'Ustaw nowe hasło',
    expires: 'Link jest ważny przez 30 minut.',
    ignore: 'Jeśli nie prosisz o reset hasła, zignoruj tę wiadomość.',
  },
  en: {
    subject: 'Reset your LegalHub CRM password',
    title: 'Reset your password',
    intro: 'We received a request to reset the password for your LegalHub CRM account.',
    button: 'Create a new password',
    expires: 'This link is valid for 30 minutes.',
    ignore: 'If you did not request a password reset, you can ignore this email.',
  },
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { sent: false, skipped: true, reason: 'RESEND_API_KEY is not configured' }

  const copy = PASSWORD_RESET_EMAIL_COPY[input.language] || PASSWORD_RESET_EMAIL_COPY.ru
  const safeUrl = escapeHtml(input.resetUrl)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.CONTACT_EMAIL_FROM || 'LegalHub CRM <notifications@legalhubcrm.com>',
      to: [input.to],
      subject: copy.subject,
      text: `${copy.title}\n\n${copy.intro}\n\n${input.resetUrl}\n\n${copy.expires}\n${copy.ignore}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6;max-width:560px;margin:auto;">
          <h1 style="font-size:24px;">${escapeHtml(copy.title)}</h1>
          <p>${escapeHtml(copy.intro)}</p>
          <p style="margin:28px 0;"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0891b2;color:#fff;text-decoration:none;font-weight:700;">${escapeHtml(copy.button)}</a></p>
          <p>${escapeHtml(copy.expires)}</p>
          <p style="color:#64748b;">${escapeHtml(copy.ignore)}</p>
        </div>
      `,
    }),
  }).catch(error => {
    console.error('Password reset email request failed:', error instanceof Error ? error.name : 'UnknownError')
    return null
  })

  if (!response) return { sent: false, skipped: false, reason: 'Email provider request failed' }
  if (!response.ok) {
    console.error('Password reset email failed:', response.status)
    return { sent: false, skipped: false, reason: `Resend error ${response.status}` }
  }
  return { sent: true, skipped: false }
}
