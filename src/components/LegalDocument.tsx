import Link from 'next/link'
import type { LegalDocumentContent } from '@/lib/legalDocuments'

export default function LegalDocument({ document }: { document: LegalDocumentContent }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 18px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 'clamp(18px, 4vw, 32px)', lineHeight: 1.65, overflowWrap: 'anywhere' }}>
        <Link href="/" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>LegalHub</Link>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 34px)', lineHeight: 1.15, margin: '18px 0 8px' }}>{document.title}</h1>
        <p style={{ color: '#64748b', marginBottom: 28 }}>Last updated: {document.updatedAt}</p>
        {document.sections.map(section => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
            {section.links && <ul>{section.links.map(link => (
              <li key={link.href}><Link href={link.href} style={{ color: '#0891b2', fontWeight: 700 }}>{link.label}</Link></li>
            ))}</ul>}
          </section>
        ))}
      </article>
    </main>
  )
}
