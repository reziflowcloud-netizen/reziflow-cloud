// src/components/PageHeader.tsx
'use client'
import { useLanguage } from '@/context/LanguageContext'
import Link from 'next/link'
import { ReactNode } from 'react'

interface Props {
  titleKey: string
  subtitleKey?: string
  subtitleValue?: string | number
  action?: { href?: string; labelKey: string; onClick?: () => void }
  children?: ReactNode
}

export default function PageHeader({ titleKey, subtitleKey, subtitleValue, action, children }: Props) {
  const { t } = useLanguage()
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{t(titleKey)}</div>
        {subtitleKey && (
          <div className="page-subtitle">
            {t(subtitleKey)}{subtitleValue !== undefined ? `: ${subtitleValue}` : ''}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {action && (
          action.href ? (
            <Link href={action.href} className="btn btn-primary">{t(action.labelKey)}</Link>
          ) : (
            <button onClick={action.onClick} className="btn btn-primary">{t(action.labelKey)}</button>
          )
        )}
        {children}
      </div>
    </div>
  )
}
