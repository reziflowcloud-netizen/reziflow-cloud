import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReziFlow — Система управления делами',
  description: 'CRM для иммиграционных агентств',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
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
        <meta name="apple-mobile-web-app-title" content="ReziFlow" />
        <meta name="theme-color" content="#e03131" />
      </head>
      <body>{children}</body>
    </html>
  )
}
