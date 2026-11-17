import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { deletionDocument } from '@/lib/legalDocuments'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | LegalHub',
  description: deletionDocument.description,
}

export default function DataDeletionPage() {
  return <LegalDocument document={deletionDocument} />
}