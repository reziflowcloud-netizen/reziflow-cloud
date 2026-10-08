import type { Metadata, Viewport } from 'next'
import './globals.css'
import SystemTheme from '@/components/SystemTheme'
import { themeBootScript } from '@/lib/themeBoot'

export const metadata: Metadata = {
  title: 'LegalHub CRM — CRM для компаний по легализации в Польше',
  description: 'LegalHub помогает компаниям по легализации в Польше вести заявки, клиентов, документы, дедлайны, оплаты и сотрудников в одной CRM. Начните бесплатно без карты.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f5f7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LegalHub" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body><SystemTheme />{children}</body>
    </html>
  )
}
