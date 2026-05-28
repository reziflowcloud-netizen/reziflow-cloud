// src/app/settings/page.tsx
'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export default function SettingsPage() {
  const { t } = useLanguage()
  const [canManageAll, setCanManageAll] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setCanManageAll(Boolean(data.canManageAll)))
      .catch(() => setCanManageAll(false))
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
      title: 'Источники лидов',
      desc: 'Список источников для фильтров, карточек и создания лидов',
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
      title: 'Поля дела',
      desc: 'Цель пребывания, тип занятости, тип договора, документы для MOS',
    },
    {
      href: '/settings/employees',
      icon: '👨‍💼',
      title: 'Сотрудники',
      desc: 'Ответственные сотрудники и доверители',
    },
    {
      href: '/settings/users',
      icon: '🔐',
      title: 'Пользователи',
      desc: 'Управление доступом к системе',
    },
    {
      href: '/settings/sections',
      icon: '▦',
      title: 'Поля и сектора',
      desc: 'Показывать или скрывать блоки в карточке клиента и деле',
    },
    {
      href: '/settings/document-templates',
      icon: '📄',
      title: 'Шаблоны документов',
      desc: 'DOCX-бланки договоров и доверенностей для автоматического заполнения',
    },
    {
      href: '/settings/organizations',
      icon: '🏢',
      title: 'Организации',
      desc: 'Фирмы, тарифы и первый администратор для каждой компании',
    },
    ...(canManageAll ? [{
      href: '/settings/referrals',
      icon: '%',
      title: 'Рефералы',
      desc: 'Партнерские ссылки, приглашенные организации и начисления',
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
      title: 'Интеграции',
      desc: 'Webhook для заявок с сайта, квиза, рекламы и внешних сервисов',
    },
  ], [canManageAll, t])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">{t('settings_title')}</div>
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
