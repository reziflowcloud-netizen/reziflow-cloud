import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | LegalHub',
  description: 'Instructions for deleting data processed by LegalHub and Meta integrations.',
}

const updatedAt = 'November 9, 2026'

// Approval draft: confirm request ownership, response procedure, associated-data
// cleanup and backup retention before authorizing publication.

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
        <p>
          If your request concerns processing for which LegalHub is controller, or you need help identifying
          the responsible organization, contact the LegalHub privacy contact below. Where LegalHub acts as
          processor for an agency, the request is handled in accordance with that agency's instructions
          and the applicable data processing arrangement.
        </p>

        <p>Provide only the information needed to locate the records. This can include:</p>
        <ul>
          <li>your full name;</li>
          <li>the phone number, email address, Facebook profile or Instagram account you used to contact the agency;</li>
          <li>a short note that you want your LegalHub data deleted.</li>
        </ul>
        <p>
          Do not send passwords, access tokens, app secrets or unnecessary identity documents.
          Additional information may be requested where reasonably necessary to verify the request.
        </p>

        <h2>2. If You Are a LegalHub Administrator</h2>
        <p>
          Authorized administrators can use the deletion controls available in the CRM. Disconnecting a
          Meta integration and deleting stored data are separate actions. For the dedicated Lead Ads adapter,
          an authorized administrator or service operator disables the organization's relevant Page/form
          binding and stops processing for that binding. The service operator can also remove that app's
          subscription from the relevant Page and revoke or remove its credentials when appropriate.
          Existing leads, notifications and technical records are not erased merely by disconnecting the
          integration. Messenger and other Meta channels have separate intake and credential settings.
        </p>

        <h2>3. Meta Integration Data</h2>
        <p>
          If a Facebook or Instagram user requests deletion of data received through Meta integrations, the agency
          should remove the related lead, client, messages and notes from LegalHub, or request service-level
          deletion assistance if the data cannot be removed through the interface.
        </p>
        <p>
          For Lead Ads, identify the organization and, where known, the relevant Page, form or CRM lead
          record. The request may also cover related internal notifications, delivery-processing records
          and diagnostic files. Deleting a lead through the CRM does not automatically remove all those
          records. Where the interface does not provide the necessary controls, request service-level assistance.
        </p>

        <h2>4. Service-Level Deletion Request</h2>
        <p>
          If data cannot be deleted directly in the CRM interface, the agency administrator should contact
          LegalHub support at <a href="mailto:office@legalhubcrm.com" style={{ color: '#0891b2', fontWeight: 700 }}>office@legalhubcrm.com</a>,
          providing enough information to identify the organization and the records concerned. The responsible
          controller assesses the request, any necessary identity verification and any lawful retention exception;
          LegalHub assists where it acts as processor.
        </p>
        <p>
          Where the GDPR applies, the controller must respond without undue delay and normally within one
          month of receiving the request. A permitted extension of up to two further months requires notice
          and reasons within the first month. This response deadline is not a promise that every backup copy
          is erased immediately. If erasure is refused or limited, the controller must explain the reason
          and the available complaint or remedy options.
        </p>

        <h2>5. What Happens After Deletion</h2>
        <p>
          Active lead records, related notifications, delivery-processing metadata, diagnostic files and backup
          copies must be considered separately. Removing an active record does not instantly erase all copies.
          Any retained categories, reasons and applicable retention periods or criteria should be recorded when
          handling the request. Retained records are not used for marketing or unrelated purposes.
        </p>
        <p>
          Minimal records used to prevent duplicate imports may be kept longer than ordinary diagnostic data
          where necessary and justified. The dedicated Lead Ads adapter's separate cleanup mechanism requires
          an authorized operator to run it; it does not automatically delete leads, notifications, logs or backups.
          Ask the responsible organization or LegalHub privacy contact about the deletion scope and the
          applicable retention and backup procedure for your records.
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
