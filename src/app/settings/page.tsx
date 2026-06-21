// src/app/settings/page.tsx
'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export default function SettingsPage() {
  const { t } = useLanguage()
  const [canManageAll, setCanManageAll] = useState(false)
  const [canManageBilling, setCanManageBilling] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setCanManageAll(Boolean(data.canManageAll))
        setCanManageBilling(data?.role === 'admin' || data?.role === 'owner')
      })
      .catch(() => {
        setCanManageAll(false)
        setCanManageBilling(false)
      })
  }, [])

  const items = useMemo(() => [
    {
      href: '/settings/statuses',
      icon: '🔵',
      title: t('statuses_title'),
      desc: t('statuses_sub'),
    },
    {
      href: '/settings/lead-sources',
      icon: '◎',
      title: t('lead_sources_title'),
      desc: t('lead_sources_sub'),
    },
    {
      href: '/settings/services',
      icon: '🛠',
      title: t('services_title'),
      desc: t('services_sub'),
    },
    {
      href: '/settings/case-options',
      icon: '📋',
      title: t('case_options_title'),
      desc: t('case_options_sub'),
    },
    {
      href: '/settings/employees',
      icon: '👨‍💼',
      title: t('employees_title'),
      desc: t('employees_sub'),
    },
    {
      href: '/settings/users',
      icon: '🔐',
      title: t('users'),
      desc: t('users_settings_sub'),
    },
    ...(canManageBilling ? [{
      href: '/settings/billing',
      icon: 'PLN',
      title: t('billing_title'),
      desc: t('billing_sub'),
    }] : []),
    {
      href: '/settings/sections',
      icon: '▦',
      title: t('sections_title'),
      desc: t('sections_sub'),
    },
    {
      href: '/settings/document-templates',
      icon: '📄',
      title: t('document_templates_title'),
      desc: t('document_templates_sub'),
    },
    {
      href: '/settings/organizations',
      icon: '🏢',
      title: t('organizations_title'),
      desc: t('organizations_settings_sub'),
    },
    ...(canManageAll ? [{
      href: '/settings/referrals',
      icon: '%',
      title: t('referrals_title'),
      desc: t('referrals_sub'),
    }] : []),
    {
      href: '/settings/export',
      icon: '📦',
      title: t('export_title'),
      desc: t('export_sub'),
    },
    {
      href: '/settings/integrations',
      icon: '🔌',
      title: t('integrations_title'),
      desc: t('integrations_sub'),
    },
  ], [canManageAll, canManageBilling, t])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">{t('settings_title')}</div>
        <Link href="/dashboard" className="btn btn-secondary">{t('back')}</Link>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, maxWidth: 900 }}>
          {items.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', height: '100%' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
