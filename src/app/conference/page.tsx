import type { Metadata } from 'next'
import ConferenceLanding from './ConferenceLanding'

export const metadata: Metadata = {
  title: 'LegalHub CRM — уся робота агенції в одній CRM',
  description: 'CRM для компаній з легалізації в Польщі.',
  alternates: { canonical: '/conference' },
}

export default function ConferencePage({ searchParams }: { searchParams?: { demo?: string } }) {
  return <ConferenceLanding demoUnavailable={searchParams?.demo === 'unavailable'} />
}
