import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LegalHub CRM — CRM для компаний по легализации в Польше',
  description: 'LegalHub помогает компаниям по легализации в Польше вести заявки, клиентов, документы, дедлайны, оплаты и сотрудников в одной CRM. Начните бесплатно без карты.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LegalHub" />
        <meta name="theme-color" content="#06b6d4" />
      </head>
      <body>{children}</body>
    </html>
  )
}
