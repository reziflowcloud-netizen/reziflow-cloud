import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | LegalHub',
  description: 'Privacy policy for LegalHub integrations and customer communication features.',
}

const updatedAt = 'July 1, 2026'

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 18px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, lineHeight: 1.65 }}>
        <Link href="/" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>LegalHub</Link>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '18px 0 8px' }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', marginBottom: 28 }}>Last updated: {updatedAt}</p>

        <section style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Administrator Danych:</h2>
          <p style={{ marginBottom: 0 }}>
            LegalHub CRM JDG Valentyn Verbelchuk<br />
            Adres: 02-786 Warszawa, ul. Zamiany 8, lu 202<br />
            NIP: 9512609364<br />
            Kontakt: <a href="mailto:office@legalhubcrm.com" style={{ color: '#0891b2', fontWeight: 700 }}>office@legalhubcrm.com</a>
          </p>
        </section>

        <p>
          LegalHub is a customer relationship management system for immigration and legalization agencies.
          This Privacy Policy explains how LegalHub processes information when agencies use the service,
          including integrations with Meta products such as Facebook Messenger, Instagram Direct and Facebook Lead Ads.
        </p>

        <h2>1. Who Uses LegalHub</h2>
        <p>
          LegalHub is used by business customers, such as agencies and their employees, to manage leads,
          clients, cases, tasks, documents and communications. The agency using LegalHub is responsible for
          informing its own clients and leads how their personal data is processed in the agency's business.
        </p>

        <h2>2. Information We Process</h2>
        <p>Depending on how an agency configures the CRM, LegalHub may process:</p>
        <ul>
          <li>contact details such as name, phone number, email address, Facebook profile, Instagram username or messenger identifier;</li>
          <li>messages sent to connected Facebook Pages or Instagram professional accounts;</li>
          <li>lead form data submitted through Facebook Lead Ads, websites, quizzes, Google Sheets or other connected forms;</li>
          <li>case details, service interests, notes, reminders, tasks and client status information;</li>
          <li>documents uploaded by CRM users for case management;</li>
          <li>technical information required to operate integrations, such as webhook payloads, delivery logs and access tokens stored for the connected organization.</li>
        </ul>

        <h2>3. How We Use Information</h2>
        <p>
          Information is processed only to provide and maintain the CRM service, based on Article 6(1)(b)
          of the GDPR (performance of a contract), including to:
        </p>
        <ul>
          <li>create and update leads and client records;</li>
          <li>show incoming messages from Facebook Messenger and Instagram Direct inside the CRM;</li>
          <li>allow authorized CRM users to reply to clients through connected Meta channels;</li>
          <li>assign leads to responsible employees and manage follow-up tasks;</li>
          <li>store documents and case history for the agency;</li>
          <li>diagnose integration errors and protect the service from misuse.</li>
        </ul>

        <h2>4. Meta Platform Data</h2>
        <p>
          When an agency connects Meta integrations, LegalHub receives only the data that Meta sends through
          the configured permissions and webhooks. This may include lead form fields, sender identifiers, message
          text, timestamps and profile data needed to display the conversation. LegalHub does not sell Meta
          Platform data and does not use it for advertising, profiling or unrelated purposes.
        </p>

        <h2>5. Sharing of Information</h2>
        <p>
          LegalHub does not sell personal information. Information may be processed by trusted service
          providers used to operate the CRM, such as hosting, database, file storage and deployment providers.
          Access is limited to what is necessary to provide the service and maintain security.
        </p>

        <h2>6. Data Storage and Security</h2>
        <p>
          LegalHub uses technical and organizational measures designed to protect data against unauthorized
          access, loss or misuse. CRM access is limited to authorized users of the connected organization.
          Integration tokens are stored as organization settings and should be managed only by authorized
          administrators.
        </p>

        <h2>7. Data Location</h2>
        <p>
          Data is processed and stored primarily on servers located within the European Economic Area (EEA).
        </p>

        <h2>8. Data Retention</h2>
        <p>
          Data is retained while the agency uses LegalHub and as needed for operational, legal or security
          reasons. Agencies can delete records inside the CRM where the product provides deletion controls, or
          request broader deletion as described in our data deletion instructions.
        </p>

        <h2>9. Data Deletion</h2>
        <p>
          Instructions for requesting deletion of CRM data and Meta integration data are available at{' '}
          <Link href="/data-deletion" style={{ color: '#0891b2', fontWeight: 700 }}>Data Deletion Instructions</Link>.
        </p>

        <h2>10. Contact</h2>
        <p>
          For privacy or data deletion requests, contact the organization that manages your case in LegalHub.
          If you are a LegalHub administrator and need service-level assistance, contact the LegalHub
          service owner at <a href="mailto:office@legalhubcrm.com" style={{ color: '#0891b2', fontWeight: 700 }}>office@legalhubcrm.com</a>.
        </p>
      </article>
    </main>
  )
}
