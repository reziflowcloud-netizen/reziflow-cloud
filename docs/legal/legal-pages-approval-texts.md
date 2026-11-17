# LegalHub Legal Pages Approval Drafts

**General-service approval drafts, revised 17 November 2026. NOT PUBLISHED OR APPROVED.** PR #14/#15's separate QA pages concern historical QA Apps and are not the notice for Production App 1627116975561049. These texts preserve the existing proposed general-service notice and make targeted factual corrections for the released adapter. No executable /privacy, /data-deletion or other public route is changed here. Set the effective date only when an accurate final version is approved and published. Remaining provider/contract/retention decisions below are not public placeholders to deploy.

## Privacy Policy

Proposed update: to be set on approved publication (draft revised November 17, 2026)

### Service Operator and Privacy Contact:

VALENTYN VERBELCHUK, trading as LegalHub CRM (Polish sole proprietor)<br>
Adres: 02-786 Warszawa, ul. Zamiany 8, lok. 202<br>
NIP: 9512609364  
Kontakt: [office@legalhubcrm.com](mailto:office@legalhubcrm.com)

LegalHub is a customer relationship management system for immigration and legalization agencies. This Privacy Policy explains how LegalHub processes information when agencies use the service, including integrations with Meta products such as Facebook Messenger, Instagram Direct and Facebook Lead Ads.

### 1. Who Uses LegalHub

LegalHub is used by business customers, such as agencies and their employees, to manage leads, clients, cases, tasks, documents and communications. The agency using LegalHub is responsible for informing its own clients and leads how their personal data is processed in the agency's business.

The agency generally acts as controller for the client and lead data whose purposes and essential means of processing it determines. Where LegalHub processes that data on the agency's documented instructions, LegalHub acts as processor under the applicable data processing arrangement. LegalHub acts as controller for processing whose purposes and essential means it determines itself, such as its own service administration and security. The roles depend on the actual processing and contractual arrangements, not only on which system stores the data.

For its own internal review and testing, LegalHub determines the purposes of processing associated with its own App, Page, form and isolated CRM organization. Contact submissions are restricted to synthetic data. Meta administrator and account identifiers, access records and other technical information may still relate to individuals. An internal CRM organization is not by itself a separate legal entity. The Production Lead Ads App is LegalHub CRM Lead Ads, ID 1627116975561049; its creation and review preparation do not activate customer lead intake.

### 2. Information We Process

Depending on how an agency configures the CRM, LegalHub may process:

- contact details such as name, phone number, email address, Facebook profile, Instagram username or messenger identifier;

- messages sent to connected Facebook Pages or Instagram professional accounts;

- lead form data submitted through Facebook Lead Ads, websites, quizzes, Google Sheets or other connected forms;

- case details, service interests, notes, reminders, tasks and client status information;

- documents uploaded by CRM users for case management;

- technical information used to operate integrations, including webhook data, authorized Page and form identifiers, lead identifiers, timestamps, processing status, error codes and records used to prevent duplicate processing;

- access tokens and other integration credentials, handled separately from lead contact records.

### 3. How We Use Information

Information is processed to provide and maintain the CRM service, including to:

- create and update leads and client records;

- show incoming messages from Facebook Messenger and Instagram Direct inside the CRM;

- allow authorized CRM users to reply to clients through connected Meta channels;

- assign leads to responsible employees and manage follow-up tasks;

- store documents and case history for the agency;

- diagnose integration errors and protect the service from misuse.

The agency is responsible for identifying and communicating the legal basis for its processing of client and lead data. A service contract between an agency and LegalHub does not by itself establish Article 6(1)(b) GDPR as the basis for processing every client's or lead's data.

Where LegalHub acts as controller, Article 6(1)(b) applies only to processing necessary for a contract with the individual or steps requested by that individual before entering a contract. Applicable legal obligations may require processing under Article 6(1)(c). Service security and misuse diagnosis may rely on legitimate interests under Article 6(1)(f), subject to the required necessity and balancing assessment. Where processing relies on consent, consent can be withdrawn without affecting the lawfulness of earlier processing. The applicable basis must be assessed for each purpose; submitting a Meta form is not blanket consent to unrelated processing.

### 4. Meta Platform Data

When an agency connects Meta integrations, LegalHub receives only the data that Meta sends through the configured permissions and webhooks. This may include lead form fields, sender identifiers, message text, timestamps and profile data needed to display the conversation. LegalHub does not sell Meta Platform data and does not use it for advertising, profiling or unrelated purposes.

For organizations using the dedicated Lead Ads adapter, a Meta webhook identifies an available lead. The service uses an authorized Page access token to retrieve submitted form fields and create a lead in the connected CRM organization. Fields may include name, email address, telephone number and other configured form responses. The CRM may assign the lead to an authorized employee and create an internal notification. Delivery-processing metadata is kept separately from the lead's contact details. Feature availability depends on the environment and configuration; this description does not mean that every integration is enabled for every organization.

### 5. Sharing of Information

LegalHub does not sell personal information. Information may be processed by trusted service providers used to operate the CRM, such as hosting, database, file storage and deployment providers. Access is limited to what is necessary to provide the service and maintain security.

Vercel provides hosting and application execution; Supabase provides the configured production PostgreSQL database. Other enabled features may use document-storage, email, scheduling and device-notification providers, which must be identified for the actual flow. Meta also processes information under its own applicable terms and notices.

Historical isolated QA used an operator-managed local CRM/PostgreSQL in Poland and, during separately controlled tests, Cloudflare Quick Tunnel followed by ngrok Free as HTTPS relays. Those temporary test endpoints are stopped; neither is the current production Lead Ads ingress. A future isolated review demonstration must identify its actual providers before it starts. Synthetic contact answers do not eliminate personal administrator, network or account metadata. The public QA notice remains limited to its identified historical App and process; it is not a customer-service notice for App 1627116975561049.

### 6. Data Storage and Security

LegalHub uses technical and organizational measures designed to protect data against unauthorized access, loss or misuse. CRM access is limited to authorized users of the connected organization. Storage depends on the integration. The dedicated Lead Ads adapter reads Page access tokens from private server configuration; its Page/form binding and delivery-receipt tables do not store those tokens. Other integrations may use organization settings. Credentials should be accessible only to authorized operators and should not be included in support requests or diagnostic reports.

### 7. Data Location

The configured production PostgreSQL database is in Ireland. The confirmed Vercel production deployment executes application functions in the United States (Washington, D.C. region, iad1). Database residency does not mean all service processing remains in the EEA. Network, support, logs, backups and optional services may have additional locations; the approved provider schedule must identify the applicable processing and transfer arrangements. Local encrypted release-recovery copies held by the operator in Poland are distinct from provider backups. A test environment's location is not evidence of the production service's location.

### 8. Data Retention

Data is retained while the agency uses LegalHub and as needed for operational, legal or security reasons. Agencies can delete records inside the CRM where the product provides deletion controls, or request broader deletion as described in our data deletion instructions.

Lead records, internal notifications, diagnostic records and delivery receipts are separate data categories. The dedicated adapter's operator-run receipt cleanup can remove direct lead references from eligible terminal records older than 30 days and retain a minimal keyed deduplication record. Minimal-record removal becomes eligible only after 366 days from the original receipt creation; pending/processing records are excluded. These are code-enforced eligibility limits, not proof of a running automatic cleanup schedule or an adopted retention timetable. The mechanism does not delete CRM Leads, notifications, logs or backups. Disabling the integration or deleting a Lead does not automatically erase every related record. Customer retention criteria and an operator-run schedule must be approved for each actual category/flow; the historical QA cleanup schedule does not govern SL customer data.

### 9. Your Rights and Data Deletion

Where the GDPR applies, you may have rights of access, rectification, erasure, restriction, portability and objection, subject to the applicable conditions. You may also withdraw consent where it is the basis of processing and lodge a complaint with a competent supervisory authority, including the Polish supervisory authority, UODO. Contact the relevant controller to exercise your rights.

Instructions for requesting deletion of CRM data and Meta integration data are available at [Data Deletion Instructions](https://legalhubcrm.com/data-deletion).

### 10. Contact

For privacy or data deletion requests, contact the organization that manages your case in LegalHub. If you are a LegalHub administrator and need service-level assistance, contact the LegalHub service owner at [office@legalhubcrm.com](mailto:office@legalhubcrm.com).

---

## Data Deletion Instructions

Proposed update: to be set on approved publication (draft revised November 17, 2026)

These instructions explain how to request deletion of personal data processed by LegalHub, including data received through Facebook Messenger, Instagram Direct and Facebook Lead Ads integrations.

### 1. If You Are a Client or Lead of an Agency

LegalHub is used by agencies to manage their client relationships and case work. If you contacted an agency through Facebook, Instagram, a website form or another channel and want your data deleted, please contact that agency directly and ask them to remove your information from LegalHub.

If your request concerns processing for which LegalHub is controller, or you need help identifying the responsible organization, contact the LegalHub privacy contact below. Where LegalHub acts as processor for an agency, the request is handled in accordance with that agency's instructions and the applicable data processing arrangement.

Provide only the information needed to locate the records. This can include:

- your full name;

- the phone number, email address, Facebook profile or Instagram account you used to contact the agency;

- a short note that you want your LegalHub data deleted.

Do not send passwords, access tokens, app secrets or unnecessary identity documents. Additional information may be requested where reasonably necessary to verify the request.

### 2. If You Are a LegalHub Administrator

Authorized administrators can use the deletion controls available in the CRM. Disconnecting a Meta integration and deleting stored data are separate actions. For the dedicated Lead Ads adapter, an authorized administrator or service operator disables the organization's relevant Page/form binding and stops processing for that binding. The service operator can also remove that app's subscription from the relevant Page and revoke or remove its credentials when appropriate. Existing leads, notifications and technical records are not erased merely by disconnecting the integration. Messenger and other Meta channels have separate intake and credential settings.

### 3. Meta Integration Data

If a Facebook or Instagram user requests deletion of data received through Meta integrations, the agency should remove the related lead, client, messages and notes from LegalHub, or request service-level deletion assistance if the data cannot be removed through the interface.

For Lead Ads, identify the organization and, where known, the relevant Page, form or CRM lead record. The request may also cover related internal notifications, delivery-processing records and diagnostic files. Deleting a lead through the CRM does not automatically remove all those records. Where the interface does not provide the necessary controls, request service-level assistance.

For the internal QA pilot, contact the same privacy contact and identify the test App, Page, form or synthetic record. The operator must consider the isolated QA database, related notifications, diagnostic files and any retained QA copies separately. Production database deletion is not part of this isolated pilot's cleanup procedure.

### 4. Service-Level Deletion Request

If data cannot be deleted directly in the CRM interface, the agency administrator should contact LegalHub support at [office@legalhubcrm.com](mailto:office@legalhubcrm.com), providing enough information to identify the organization and the records concerned. The responsible controller assesses the request, any necessary identity verification and any lawful retention exception; LegalHub assists where it acts as processor.

Where the GDPR applies, the controller must respond without undue delay and normally within one month of receiving the request. A permitted extension of up to two further months requires notice and reasons within the first month. This response deadline is not a promise that every backup copy is erased immediately. If erasure is refused or limited, the controller must explain the reason and the available complaint or remedy options.

### 5. What Happens After Deletion

Active lead records, related notifications, delivery-processing metadata, diagnostic files and backup copies must be considered separately. Removing an active record does not instantly erase all copies. Any retained categories, reasons and applicable retention periods or criteria should be recorded when handling the request. Retained records are not used for marketing or unrelated purposes.

Minimal records used to prevent duplicate imports may be kept longer than ordinary diagnostic data where necessary and justified. The dedicated Lead Ads adapter's separate cleanup mechanism requires an authorized operator to run it; it does not automatically delete leads, notifications, logs or backups. Ask the responsible organization or LegalHub privacy contact about the deletion scope and the applicable retention and backup procedure for your records.

### 6. Privacy Policy

More information about how LegalHub processes data is available in the [Privacy Policy](https://legalhubcrm.com/privacy).

---

## Approval gates — not part of the public notice

1. Complete the provider schedule for the actual review/customer route: contracting entity, enabled service, applicable accepted DPA/transfer basis, storage and remote-access countries. Vercel's US function region and Supabase's Ireland database alone do not answer Meta's all-countries question. Public supplier-country lists do not prove every listed optional service receives Platform Data. Do not publish a fabricated SCC/EEA-only assurance.
2. Approve concrete retention criteria and an operator/frequency for Leads, notifications, pending/terminal receipts, minimal dedupe records, logs and backups. No customer policy is enacted by the 30/366-day code limits. Do not silently extend the historical QA deadlines.
3. Approve an executable linked-record deletion procedure: verify the controller and request scope privately; disable only the relevant binding if requested; identify related Lead/Notification/receipt/log/copy records; use reviewed product controls or a separately authorised exact-target maintenance operation; record lawful exceptions and backup reconciliation. A draft is not permission to run Production deletion SQL or erase independent Meta/provider records. On restore, reconcile recorded deletion decisions before resuming use; do not promise immediate physical deletion of all provider backups.
4. Historical QA manual cleanup remains the separately approved 24-hour credentials / 7-day QA artifacts / 30-day deidentified report procedure, subject to its existing exact deadlines and authorisations. A new review operation requires an explicit closure timestamp and copy inventory; it does not reset old deadlines.
5. Owner confirmed no Meta-data national-security disclosures in the previous twelve months and no listed government-request measures currently implemented. The [proposed procedure](government-data-requests-draft.md) is for separate actual adoption; it is not an existing security claim to copy into Meta or this policy.
6. A signed SL DPA and SL form notice are required before its actual instructed customer flow, not as prerequisites for a demonstration using only owned resources and synthetic contacts. Preserve the [Article 28 draft](article-28-dpa-draft.md) as unsigned until the parties and schedules are completed.
7. Review the final publication text, cross-links, date and exact App scope separately. No approval, legal-page deployment or Meta Privacy/Deletion URL assignment is performed by editing this file.
