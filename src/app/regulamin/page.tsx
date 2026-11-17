import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { termsDocument } from '@/lib/legalDocuments'

export const metadata: Metadata = {
  title: 'Regulamin | LegalHub',
  description: termsDocument.description,
}

export default function RegulaminPage() {
  return <LegalDocument document={termsDocument} />
}