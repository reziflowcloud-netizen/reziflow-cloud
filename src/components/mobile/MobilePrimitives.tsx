'use client'

import Link from 'next/link'
import { useState, type HTMLAttributes, type ReactNode } from 'react'
import styles from './MobilePrimitives.module.css'

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function MobilePageShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes(styles.mobileOnly, styles.pageShell, className)} {...props} />
}

export function CompactMobileHeader({
  title,
  subtitle,
  backHref,
  primaryAction,
  overflowAction,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backHref?: string
  primaryAction?: ReactNode
  overflowAction?: ReactNode
  className?: string
}) {
  return (
    <header className={classes(styles.mobileOnly, styles.header, className)}>
      {backHref && <Link href={backHref} className={styles.iconButton} aria-label="Back">←</Link>}
      <div className={styles.headerCopy}>
        <h1>{title}</h1>
        {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
      </div>
      {primaryAction && <div className={styles.headerAction}>{primaryAction}</div>}
      {overflowAction && <div className={styles.headerOverflow}>{overflowAction}</div>}
    </header>
  )
}

export function MobileChipRail({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return <div className={classes(styles.mobileOnly, styles.chipRail, className)} role="list" aria-label={label}>{children}</div>
}

export function MobileSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={classes(styles.mobileOnly, styles.surface, className)} {...props} />
}

export type MobileBadgeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'violet'

export function MobileBadge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: MobileBadgeTone }) {
  return <span className={classes(styles.badge, styles[`badge_${tone}`], className)} {...props} />
}

export function CompactMobileSearchRow({
  search,
  filters,
  className,
}: {
  search: ReactNode
  filters?: ReactNode
  className?: string
}) {
  return (
    <div className={classes(styles.mobileOnly, styles.searchRow, className)}>
      <div className={styles.searchControl}>{search}</div>
      {filters && <div className={styles.filterControl}>{filters}</div>}
    </div>
  )
}

export function MobileAccordion({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode
  summary?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={classes(styles.mobileOnly, styles.accordion, className)}>
      <button type="button" className={styles.accordionTrigger} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className={styles.accordionLabel}>
          <strong>{title}</strong>
          {summary && <span>{summary}</span>}
        </span>
        <span className={classes(styles.chevron, open && styles.chevronOpen)} aria-hidden="true">⌄</span>
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </section>
  )
}

export function MobileBulkSelectionShell({
  selectedCount,
  countLabel,
  actions,
  cancelAction,
  className,
}: {
  selectedCount: number
  countLabel?: ReactNode
  actions: ReactNode
  cancelAction: ReactNode
  className?: string
}) {
  return (
    <div className={classes(styles.mobileOnly, styles.bulkBar, className)} role="region" aria-live="polite">
      <strong>{countLabel || selectedCount}</strong>
      <div className={styles.bulkActions}>{actions}</div>
      <div className={styles.bulkCancel}>{cancelAction}</div>
    </div>
  )
}

function MobileStateFrame({ tone, title, children, action }: { tone: 'loading' | 'empty' | 'error'; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={classes(styles.mobileOnly, styles.stateFrame, styles[`state_${tone}`])} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {children && <div>{children}</div>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  )
}

export function MobileLoadingState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <MobileStateFrame tone="loading" title={title}>{children}</MobileStateFrame>
}

export function MobileEmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <MobileStateFrame tone="empty" title={title} action={action}>{children}</MobileStateFrame>
}

export function MobileErrorState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <MobileStateFrame tone="error" title={title} action={action}>{children}</MobileStateFrame>
}
