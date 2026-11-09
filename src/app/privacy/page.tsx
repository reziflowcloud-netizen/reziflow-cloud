import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | LegalHub',
  description: 'Privacy policy for LegalHub integrations and customer communication features.',
}

const updatedAt = 'November 9, 2026'

// Approval draft: verify roles/DPA, legal bases, provider regions/transfers,
// retention and backup procedures before authorizing publication.

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 18px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, lineHeight: 1.65 }}>
        <Link href="/" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>LegalHub</Link>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '18px 0 8px' }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', marginBottom: 28 }}>Last updated: {updatedAt}</p>

        <section style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Service Operator and Privacy Contact:</h2>
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
        <p>
          The agency generally acts as controller for the client and lead data whose purposes and essential
          means of processing it determines. Where LegalHub processes that data on the agency's documented
          instructions, LegalHub acts as processor under the applicable data processing arrangement.
          LegalHub acts as controller for processing whose purposes and essential means it determines itself,
          such as its own service administration and security. The roles depend on the actual processing
          and contractual arrangements, not only on which system stores the data.
        </p>

        <h2>2. Information We Process</h2>
        <p>Depending on how an agency configures the CRM, LegalHub may process:</p>
        <ul>
          <li>contact details such as name, phone number, email address, Facebook profile, Instagram username or messenger identifier;</li>
          <li>messages sent to connected Facebook Pages or Instagram professional accounts;</li>
          <li>lead form data submitted through Facebook Lead Ads, websites, quizzes, Google Sheets or other connected forms;</li>
          <li>case details, service interests, notes, reminders, tasks and client status information;</li>
          <li>documents uploaded by CRM users for case management;</li>
          <li>technical information used to operate integrations, including webhook data, authorized Page and form identifiers, lead identifiers, timestamps, processing status, error codes and records used to prevent duplicate processing;</li>
          <li>access tokens and other integration credentials, handled separately from lead contact records.</li>
        </ul>

        <h2>3. How We Use Information</h2>
        <p>
          Information is processed to provide and maintain the CRM service, including to:
        </p>
        <ul>
          <li>create and update leads and client records;</li>
          <li>show incoming messages from Facebook Messenger and Instagram Direct inside the CRM;</li>
          <li>allow authorized CRM users to reply to clients through connected Meta channels;</li>
          <li>assign leads to responsible employees and manage follow-up tasks;</li>
          <li>store documents and case history for the agency;</li>
          <li>diagnose integration errors and protect the service from misuse.</li>
        </ul>
        <p>
          The agency is responsible for identifying and communicating the legal basis for its processing
          of client and lead data. A service contract between an agency and LegalHub does not by itself
          establish Article 6(1)(b) GDPR as the basis for processing every client's or lead's data.
        </p>
        <p>
          Where LegalHub acts as controller, Article 6(1)(b) applies only to processing necessary for a
          contract with the individual or steps requested by that individual before entering a contract.
          Applicable legal obligations may require processing under Article 6(1)(c). Service security and
          misuse diagnosis may rely on legitimate interests under Article 6(1)(f), subject to the required
          necessity and balancing assessment. Where processing relies on consent, consent can be withdrawn
          without affecting the lawfulness of earlier processing. The applicable basis must be assessed for
          each purpose; submitting a Meta form is not blanket consent to unrelated processing.
        </p>

        <h2>4. Meta Platform Data</h2>
        <p>
          When an agency connects Meta integrations, LegalHub receives only the data that Meta sends through
          the configured permissions and webhooks. This may include lead form fields, sender identifiers, message
          text, timestamps and profile data needed to display the conversation. LegalHub does not sell Meta
          Platform data and does not use it for advertising, profiling or unrelated purposes.
        </p>
        <p>
          For organizations using the dedicated Lead Ads adapter, a Meta webhook identifies an available
          lead. The service uses an authorized Page access token to retrieve submitted form fields and
          create a lead in the connected CRM organization. Fields may include name, email address,
          telephone number and other configured form responses. The CRM may assign the lead to an
          authorized employee and create an internal notification. Delivery-processing metadata is kept
          separately from the lead's contact details. Feature availability depends on the environment
          and configuration; this description does not mean that every integration is enabled for every organization.
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
          Storage depends on the integration. The dedicated Lead Ads adapter reads Page access tokens from
          private server configuration; its Page/form binding and delivery-receipt tables do not store those
          tokens. Other integrations may use organization settings. Credentials should be accessible only to
          authorized operators and should not be included in support requests or diagnostic reports.
        </p>

        <h2>7. Data Location</h2>
        <p>
          Processing and storage locations depend on the hosting, database, backup and integration providers
          used for the relevant environment. Test environments may use local infrastructure and a temporary
          HTTPS relay. A test environment's location is not evidence of the location of the production service.
          Information about applicable provider locations and international-transfer arrangements can be
          requested from the privacy contact below.
        </p>

        <h2>8. Data Retention</h2>
        <p>
          Data is retained while the agency uses LegalHub and as needed for operational, legal or security
          reasons. Agencies can delete records inside the CRM where the product provides deletion controls, or
          request broader deletion as described in our data deletion instructions.
        </p>
        <p>
          Lead records, internal notifications, diagnostic records and delivery receipts are separate data
          categories. Minimal records used to prevent duplicate imports may be kept longer than ordinary
          diagnostic records. The dedicated Lead Ads adapter provides a separate operator-run mechanism to
          remove direct lead references from eligible older terminal delivery records, retain a minimal
          keyed record to prevent duplicate processing, and later remove that record. It is not an automatic
          deletion schedule and does not itself delete CRM leads, notifications, diagnostic files or backups.
          Deleting a lead or disabling an integration does not automatically erase every related record.
          Retention and deletion must follow the applicable documented procedure for each data category
          and environment, including any justified legal or security retention.
        </p>

        <h2>9. Your Rights and Data Deletion</h2>
        <p>
          Where the GDPR applies, you may have rights of access, rectification, erasure, restriction,
          portability and objection, subject to the applicable conditions. You may also withdraw consent
          where it is the basis of processing and lodge a complaint with a competent supervisory authority,
          including the Polish supervisory authority, UODO. Contact the relevant controller to exercise your rights.
        </p>
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
