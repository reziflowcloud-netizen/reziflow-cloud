// src/components/ClientLayout.tsx
'use client'
import { LanguageProvider } from '@/context/LanguageContext'
import { ReactNode } from 'react'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
