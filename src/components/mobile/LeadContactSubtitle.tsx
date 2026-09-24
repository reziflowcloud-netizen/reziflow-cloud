import { getMobileLeadSubtitle, type MobileLeadSubtitleKind } from '@/lib/mobileLeadSubtitle'
import styles from './LeadContactSubtitle.module.css'

type LeadContactSubtitleProps = {
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
  fallback: string
  phone?: string | null
  className?: string
}

function SubtitleIcon({ kind }: { kind: MobileLeadSubtitleKind }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className: styles.icon }

  if (kind === 'phone') return <svg {...common}><path d="M6.6 3.5 9 8l-2 2c1.4 3 3.8 5.4 6.8 6.8l2-2 4.5 2.4c.4.2.6.6.5 1-.4 2-2 3.3-4 3.3C9 21.5 2.5 15 2.5 7.2c0-2 1.4-3.6 3.3-4 .4-.1.7.1.8.3Z" /></svg>
  if (kind === 'instagram') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.2" cy="6.8" r=".7" fill="currentColor" stroke="none" /></svg>
  if (kind === 'facebook') return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}><path fill="currentColor" d="M13.7 20v-7h2.4l.4-2.8h-2.8V8.4c0-.8.2-1.4 1.4-1.4h1.5V4.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2H8.2V13h2.5v7h3Z" /></svg>
  if (kind === 'email') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>
}

export default function LeadContactSubtitle(props: LeadContactSubtitleProps) {
  const presentation = getMobileLeadSubtitle(props)
  if (!presentation) return null

  return (
    <div className={`${styles.root} ${props.className || ''}`.trim()} title={presentation.text} data-lead-subtitle={presentation.kind}>
      <span className={`${styles.iconWrap} ${styles[presentation.kind]}`} aria-hidden="true">
        <SubtitleIcon kind={presentation.kind} />
      </span>
      <span className={styles.text}>{presentation.text}</span>
    </div>
  )
}
