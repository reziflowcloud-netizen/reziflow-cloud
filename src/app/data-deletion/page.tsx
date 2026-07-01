import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | LegalHub',
  description: 'Instructions for deleting data processed by LegalHub and Meta integrations.',
}

const updatedAt = 'July 1, 2026'

export default function DataDeletionPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 18px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, lineHeight: 1.65 }}>
        <Link href="/" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>LegalHub</Link>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '18px 0 8px' }}>Data Deletion Instructions</h1>
        <p style={{ color: '#64748b', marginBottom: 28 }}>Last updated: {updatedAt}</p>

        <p>
          These instructions explain how to request deletion of personal data processed by LegalHub,
          including data received through Facebook Messenger, Instagram Direct and Facebook Lead Ads integrations.
        </p>

        <h2>1. If You Are a Client or Lead of an Agency</h2>
        <p>
          LegalHub is used by agencies to manage their client relationships and case work. If you contacted
          an agency through Facebook, Instagram, a website form or another channel and want your data deleted,
          please contact that agency directly and ask them to remove your information from LegalHub.
        </p>

        <p>Your request can include:</p>
        <ul>
          <li>your full name;</li>
          <li>the phone number, email address, Facebook profile or Instagram account you used to contact the agency;</li>
          <li>a short note that you want your LegalHub data deleted.</li>
        </ul>

        <h2>2. If You Are a LegalHub Administrator</h2>
        <p>
          Administrators can delete or anonymize records from inside the CRM where deletion controls are available.
          For connected Meta channels, administrators can also disconnect the integration by removing Page Access
          Tokens and disabling message intake in CRM settings.
        </p>

        <h2>3. Meta Integration Data</h2>
        <p>
          If a Facebook or Instagram user requests deletion of data received through Meta integrations, the agency
          should remove the related lead, client, messages and notes from LegalHub, or request service-level
          deletion assistance if the data cannot be removed through the interface.
        </p>

        <h2>4. Service-Level Deletion Request</h2>
        <p>
          If data cannot be deleted directly in the CRM interface, the agency administrator should contact
          LegalHub support at <a href="mailto:office@legalhubcrm.com" style={{ color: '#0891b2', fontWeight: 700 }}>office@legalhubcrm.com</a>,
          providing enough information to identify the organization and the records to delete.
          LegalHub will process valid deletion requests within a reasonable period, unless retention is
          required for legal, security or fraud-prevention reasons.
        </p>

        <h2>5. What Happens After Deletion</h2>
        <p>
          Deleted records are removed from active CRM views. Some technical logs, backups or security records may
          remain for a limited period where required to operate and protect the service. These records are not used
          for marketing or unrelated purposes.
        </p>

        <h2>6. Privacy Policy</h2>
        <p>
          More information about how LegalHub processes data is available in the{' '}
          <Link href="/privacy" style={{ color: '#0891b2', fontWeight: 700 }}>Privacy Policy</Link>.
        </p>
      </article>
    </main>
  )
}
