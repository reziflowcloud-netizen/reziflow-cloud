import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Regulamin | LegalHub',
  description: 'Regulamin korzystania z uslugi LegalHub CRM.',
}

const updatedAt = 'July 1, 2026'

export default function RegulaminPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 18px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, lineHeight: 1.65 }}>
        <Link href="/" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>LegalHub</Link>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '18px 0 8px' }}>Regulamin LegalHub CRM</h1>
        <p style={{ color: '#64748b', marginBottom: 28 }}>Last updated: {updatedAt}</p>

        <h2>1. Usluga</h2>
        <p>
          LegalHub CRM jest usluga typu SaaS przeznaczona dla agencji legalizacyjnych do zarzadzania leadami,
          klientami, sprawami, zadaniami, dokumentami oraz komunikacja z klientami.
        </p>

        <h2>2. Klient i Administrator</h2>
        <p>
          Klientem jest organizacja korzystajaca z LegalHub CRM. Administratorem uslugi LegalHub jest
          LegalHub CRM JDG Valentyn Verbelchuk, NIP: 9512609364, kontakt:{' '}
          <a href="mailto:office@legalhubcrm.com" style={{ color: '#0891b2', fontWeight: 700 }}>office@legalhubcrm.com</a>.
        </p>

        <h2>3. Powierzenie przetwarzania danych</h2>
        <p>
          Akceptując niniejszy Regulamin, Klient powierza Administratorowi (LegalHub) przetwarzanie danych
          osobowych w rozumieniu art. 28 RODO na zasadach określonych w Polityce Prywatności.
        </p>

        <h2>4. Dokumenty powiazane</h2>
        <p>
          Szczegolowe zasady dotyczace prywatnosci, lokalizacji danych, bezpieczenstwa i usuwania danych
          sa opisane w{' '}
          <Link href="/privacy" style={{ color: '#0891b2', fontWeight: 700 }}>Privacy Policy</Link>
          {' '}oraz{' '}
          <Link href="/data-deletion" style={{ color: '#0891b2', fontWeight: 700 }}>Data Deletion Instructions</Link>.
        </p>
      </article>
    </main>
  )
}
