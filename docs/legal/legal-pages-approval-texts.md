# LegalHub Legal Pages Approval Drafts

These proposed texts update the existing Privacy Policy and Data Deletion Instructions. They are not published. Reconcile the proposed update date with the actual future publication date. See [factual review and stage requirements](stage-a-stage-b-readiness.md) for the remaining owner/legal confirmations.

## Privacy Policy

Last updated: November 9, 2026

### Service Operator and Privacy Contact:

LegalHub CRM JDG Valentyn Verbelchuk  
Adres: 02-786 Warszawa, ul. Zamiany 8, lu 202  
NIP: 9512609364  
Kontakt: [office@legalhubcrm.com](mailto:office@legalhubcrm.com)

LegalHub is a customer relationship management system for immigration and legalization agencies. This Privacy Policy explains how LegalHub processes information when agencies use the service, including integrations with Meta products such as Facebook Messenger, Instagram Direct and Facebook Lead Ads.

### 1. Who Uses LegalHub

LegalHub is used by business customers, such as agencies and their employees, to manage leads, clients, cases, tasks, documents and communications. The agency using LegalHub is responsible for informing its own clients and leads how their personal data is processed in the agency's business.

The agency generally acts as controller for the client and lead data whose purposes and essential means of processing it determines. Where LegalHub processes that data on the agency's documented instructions, LegalHub acts as processor under the applicable data processing arrangement. LegalHub acts as controller for processing whose purposes and essential means it determines itself, such as its own service administration and security. The roles depend on the actual processing and contractual arrangements, not only on which system stores the data.

In the internal QA pilot, LegalHub determines the testing purposes for its own test App, Page, form and isolated CRM organization. The pilot is intended for synthetic submissions only. Meta administrator and account identifiers, access records and other technical information may still relate to individuals. An internal CRM organization is not by itself a separate legal entity.

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

Vercel provides hosting and application execution. Depending on the enabled feature, database, document-storage, email, scheduling and device-notification providers may also process information. The isolated QA Lead Ads flow uses Meta, an operator-managed local CRM and PostgreSQL database, and a temporary Cloudflare HTTPS relay when enabled. It does not route test lead records through the production CRM database. Meta also processes information under its own applicable terms and notices.

### 6. Data Storage and Security

LegalHub uses technical and organizational measures designed to protect data against unauthorized access, loss or misuse. CRM access is limited to authorized users of the connected organization. Storage depends on the integration. The dedicated Lead Ads adapter reads Page access tokens from private server configuration; its Page/form binding and delivery-receipt tables do not store those tokens. Other integrations may use organization settings. Credentials should be accessible only to authorized operators and should not be included in support requests or diagnostic reports.

### 7. Data Location

The current production Vercel deployment executes application functions in the United States (Washington, D.C. region, iad1). Database, backup, network and other processing locations depend on the provider and configuration. An EU database region does not mean that all service processing remains in the EEA. Test environments may use local infrastructure and a temporary HTTPS relay. A test environment's location is not evidence of the location of the production service. Information about applicable provider locations and international-transfer arrangements can be requested from the privacy contact below.

### 8. Data Retention

Data is retained while the agency uses LegalHub and as needed for operational, legal or security reasons. Agencies can delete records inside the CRM where the product provides deletion controls, or request broader deletion as described in our data deletion instructions.

Lead records, internal notifications, diagnostic records and delivery receipts are separate data categories. Minimal records used to prevent duplicate imports may be kept longer than ordinary diagnostic records. The dedicated Lead Ads adapter provides a separate operator-run mechanism to remove direct lead references from eligible older terminal delivery records, retain a minimal keyed record to prevent duplicate processing, and later remove that record. It is not an automatic deletion schedule and does not itself delete CRM leads, notifications, diagnostic files or backups. Deleting a lead or disabling an integration does not automatically erase every related record. Retention and deletion must follow the applicable documented procedure for each data category and environment, including any justified legal or security retention.

### 9. Your Rights and Data Deletion

Where the GDPR applies, you may have rights of access, rectification, erasure, restriction, portability and objection, subject to the applicable conditions. You may also withdraw consent where it is the basis of processing and lodge a complaint with a competent supervisory authority, including the Polish supervisory authority, UODO. Contact the relevant controller to exercise your rights.

Instructions for requesting deletion of CRM data and Meta integration data are available at [Data Deletion Instructions](https://legalhubcrm.com/data-deletion).

### 10. Contact

For privacy or data deletion requests, contact the organization that manages your case in LegalHub. If you are a LegalHub administrator and need service-level assistance, contact the LegalHub service owner at [office@legalhubcrm.com](mailto:office@legalhubcrm.com).

---

## Data Deletion Instructions

Last updated: November 9, 2026

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
