import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LegalHub — CRM для агентств легализации',
  description: 'Облачная CRM для иммиграционных агентств',
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
