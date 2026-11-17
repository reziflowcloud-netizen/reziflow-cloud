import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { privacyDocument } from '@/lib/legalDocuments'

export const metadata: Metadata = {
  title: 'Privacy Policy | LegalHub',
  description: privacyDocument.description,
}

export default function PrivacyPolicyPage() {
  return <LegalDocument document={privacyDocument} />
}