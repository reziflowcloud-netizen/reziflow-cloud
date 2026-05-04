// src/components/Tr.tsx  — client component for translating any inline text
'use client'
import { useLanguage } from '@/context/LanguageContext'

export default function Tr({ k }: { k: string }) {
  const { t } = useLanguage()
  return <>{t(k)}</>
}
