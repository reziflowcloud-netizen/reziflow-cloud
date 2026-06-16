const DEFAULT_CONTACT_EMAIL = 'office@legalhubcrm.com'

type ContactNotificationInput = {
  subject: string
  title: string
  lines: Array<[string, string | null | undefined]>
  message?: string | null
  replyTo?: string | null
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
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Contact email failed:', response.status, detail)
    return { sent: false, skipped: false, reason: `Resend error ${response.status}` }
  }

  return { sent: true, skipped: false }
}
