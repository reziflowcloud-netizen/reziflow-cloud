export type MobileLeadSubtitleKind = 'phone' | 'instagram' | 'facebook' | 'email' | 'fallback'

export type MobileLeadSubtitle = {
  kind: MobileLeadSubtitleKind
  text: string
}

type MobileLeadSubtitleInput = {
  lead: {
    source?: string | null
    phone?: string | null
    email?: string | null
    instagram?: string | null
    facebook?: string | null
    messengerId?: string | null
  }
  displayName: string
  sourceLabel: (value?: string | null) => string
  phone?: string | null
  fallback: string
}

function clean(value: string | null | undefined) {
  return String(value || '').trim()
}

function normalized(value: string | null | undefined) {
  return clean(value).toLocaleLowerCase()
}

function instagramHandle(value: string) {
  if (!value || value.startsWith('@') || /^https?:\/\//i.test(value)) return value
  return `@${value}`
}

function labelIsAlreadyInName(displayName: string, channel: 'instagram' | 'facebook', label: string) {
  const name = normalized(displayName)
  return name.includes(channel) || (normalized(label).length > 2 && name.includes(normalized(label)))
}

export function getMobileLeadSubtitle({ lead, displayName, sourceLabel, phone, fallback }: MobileLeadSubtitleInput): MobileLeadSubtitle | null {
  const phoneValue = clean(phone) || clean(lead.phone)
  if (phoneValue) return { kind: 'phone', text: phoneValue }

  const source = normalized(lead.source)
  const messengerId = normalized(lead.messengerId)
  const instagramValue = clean(lead.instagram)
  const facebookValue = clean(lead.facebook)
  const instagramSource = source.includes('instagram') || messengerId.startsWith('instagram:')
  const facebookSource = source.includes('facebook') || source.includes('messenger') || messengerId.startsWith('facebook:')
  const isInstagram = instagramSource || (!facebookSource && Boolean(instagramValue))
  const isFacebook = facebookSource || (!instagramSource && Boolean(facebookValue))

  if (isInstagram) {
    if (instagramValue) return { kind: 'instagram', text: instagramHandle(instagramValue) }
    const label = sourceLabel(lead.source || 'instagram') || 'Instagram'
    return labelIsAlreadyInName(displayName, 'instagram', label) ? null : { kind: 'instagram', text: label }
  }

  if (isFacebook) {
    if (facebookValue && normalized(facebookValue) !== normalized(displayName)) {
      return { kind: 'facebook', text: facebookValue }
    }
    const label = sourceLabel(lead.source || 'facebook') || 'Facebook'
    return labelIsAlreadyInName(displayName, 'facebook', label) ? null : { kind: 'facebook', text: label }
  }

  const emailValue = clean(lead.email)
  if (emailValue) return { kind: 'email', text: emailValue }

  return fallback ? { kind: 'fallback', text: fallback } : null
}
