# PROJECT_BIBLE - LegalHub CRM

Last updated: 2026-07-07

Status: repository-audited source of truth for marketing, positioning, and product understanding.

Rule: do not turn an item into a marketing claim unless it is either supported by the repository or marked as an Assumption / Needs clarification.

## Sources Reviewed

- `legalhub-os/AGENTS.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, `TASK_LOG.md`, previous `PROJECT_BIBLE.md`, previous `PRODUCT_MAP.md`.
- Root project notes: `PROJECT_STATE.md`, `HANDOFF.md`, `DEPLOY_NOTES.md`.
- Product data model: `prisma/schema.prisma`.
- App routes and pages under `src/app`.
- Navigation and CRM shell components under `src/components`.
- Core libraries: `src/lib/auth.ts`, `src/lib/apiScope.ts`, `src/lib/billing.ts`, `src/lib/organizationProvisioning.ts`, `src/lib/leads.ts`, `src/lib/documentTemplates.ts`, integration helpers.
- Marketing and pricing copy in `src/lib/marketingI18n.ts`, `src/app/page.tsx`, `src/app/pricing/page.tsx`, `src/app/contact`, `src/app/register`.

No `.env` values or secrets were read.

## 1. What LegalHub CRM Is

LegalHub CRM is a multi-tenant SaaS CRM and case-management system for companies that help foreigners with legalization processes in Poland.

The repository supports this definition through:

- Public marketing, pricing, contact, registration, login, privacy, terms, and data-deletion pages.
- Organization-based tenancy: each CRM account belongs to an `Organization`.
- Internal CRM modules for leads, clients, cases, documents, payments, tasks, calendar, employees, settings, import/export, integrations, billing, and referral partners.
- Legalization-specific data fields for clients and cases: passport data, PESEL, stay basis, residence card data, legal stay deadlines, fines, travel history, previous Poland stays, MOS/cabinet fields, work-contract dates, filing and appearance dates.
- Public positioning strings that describe the product as a CRM for legalization companies in Poland.

Short product description:

> LegalHub CRM helps legalization agencies in Poland manage the full workflow from incoming requests to client files, cases, documents, deadlines, payments, team responsibilities, and follow-up actions.

What it is not proven to be:

- A generic CRM for all industries. The code and copy are strongly tailored to legalization/immigration workflows.
- A fully automated billing/payment product. Billing plans, limits, statuses, contact-upgrade flows, and organization settings exist, but a payment processor checkout/subscription integration was not confirmed in the reviewed files.
- A client portal for end customers. No end-client login/portal was found in the current route map.

## 2. Who The Product Is For

Evidence-backed audience:

- Legalization companies in Poland.
- Immigration/legal-service agencies helping foreigners in Poland.
- Solo legalization specialists.
- Small legalization teams.
- Growing agencies with multiple employees.
- Teams that manage residence, work, PESEL, address registration, and related cases.

Likely buyer/user groups:

- Agency owner or founder: buys the product, manages billing, team, templates, statuses, services, and access.
- Operations/admin manager: needs visibility into workload, cases, deadlines, payments, and responsible people.
- Case specialist/employee: works with assigned leads, clients, tasks, and cases.
- Marketing/sales intake person: processes leads from forms, Meta, Telegram, Google Sheets, manual entry, or CSV import.
- Referral partner: tracks invited organizations and commissions through a limited partner portal.

Assumption:

- The primary buyer is likely the agency owner or operations lead, because billing, organization settings, users, reports, and access controls are admin/owner-oriented.

Needs clarification:

- Whether the ideal ICP is solo specialists, 2-10 person agencies, larger agencies, or a prioritized segment.
- Whether law firms are a target segment or whether messaging should stay focused on legalization agencies.
- Whether B2B employers hiring foreigners are a target segment.
- Whether end customers/foreigners should ever be addressed directly in marketing.

## 3. Core Product Promise

Repository-supported promise:

LegalHub CRM centralizes the operational workflow for legalization agencies:

- Capture requests.
- Qualify and follow up with leads.
- Convert qualified leads into clients and cases.
- Store client, immigration, passport, stay, travel, family, and contact data.
- Track case status, responsible employee, service, legal deadlines, MOS/cabinet details, documents, comments, and status history.
- Manage tasks, reminders, calendar events, payment plans, received payments, debt, and income indicators.
- Configure services, statuses, lead sources, options, document templates, custom fields, and integrations per organization.

Safe marketing formulation:

> One workspace for leads, clients, legalization cases, documents, deadlines, payments, and team control.

Claims that need care:

- "Launch in 5 minutes" appears in marketing copy and quick-start flow, but should be validated against the actual onboarding experience before paid ads.
- "Free forever" is represented in plan definitions and public pricing copy, but final pricing/legal approval is needed before campaign use.
- "Advanced integrations" appears as an Agency plan feature, while actual integration readiness depends on external providers, tokens, permissions, and setup.

## 4. Main Modules

### Public Marketing And Acquisition

Implemented:

- Home/landing page.
- Pricing page.
- Contact page.
- Privacy policy, terms, Meta/data deletion pages.
- Registration and login.
- Contact-form API that creates a CRM lead in the default organization.

Business role:

- Explain the product.
- Capture product inquiries.
- Allow self-registration into a new organization.
- Support Meta app publication requirements through public policy/deletion pages.

### Authentication And Organization Provisioning

Implemented:

- Login/logout/current-user APIs.
- Register API.
- New organization creation with plan, billing status/trial status, slug, and first admin user.
- Default organization fallback for internal/admin use.
- Copying default/template services, statuses, and case options into new organizations when available.
- Trial settings for paid plans and active/manual handling for Free.
- Referral attribution during registration via referral code.

Needs clarification:

- Final production signup rules.
- Whether all plans should be self-serve.
- Whether organization creation should remain open to all visitors.

### Dashboard And Reporting

Implemented:

- Dashboard with income, debt, contracts signed without payment, clients, total cases, active cases.
- Last-six-month charts for new cases and new clients.
- Upcoming events/reminders and recent cases.
- Quick-start/onboarding panel for admins/owners.
- Subpages for income, debt, new cases, and new clients.
- Scope-aware data access for restricted users.

Marketing angle:

- Managers can see operational and financial signals without stitching spreadsheets together.

### Leads / Requests

Implemented:

- Lead list with table and board views.
- Manual lead creation.
- Lead detail page.
- Lead statuses and lead sources.
- Lead filters: today, overdue, unassigned, no next contact, status/source/reason.
- Lead sorting and visible-column preferences.
- Bulk actions: status, responsible employee, source, delete.
- Lead reminders backed by tasks.
- Contact history.
- Lead messages.
- Lead phones.
- Lead temperature, service interest, budget, urgency, source, city/country/language, social handles.
- Conversion from lead to client and optionally case.
- CSV lead import with preview/mapping/duplicate skip.
- Webhook and Meta/Telegram intake paths.
- Assignment to both login user (`assignedTo`) and business responsible employee (`employee`).

Needs clarification:

- Which lead channels are officially supported in production marketing.
- Whether outgoing Meta messages should be advertised yet, given Meta permissions/app-review constraints.

### Clients

Implemented:

- Client list with search, filters, sorting, and configurable visible columns.
- New client page.
- Client detail page.
- Core contact details and multiple phones.
- Personal and immigration-related fields: PESEL, passport, birth data, citizenship, nationality, marital status, education, profession, status UKR, parents, prior names, addresses, stay basis, legal title, rental end date.
- Residence card and legal-stay data.
- Fines.
- Travel history.
- Previous Poland stays.
- Family links.
- Custom sections/fields.
- Passport-expiry task/reminder creation.
- Client deletion with related cleanup for admin/owner.

Marketing angle:

- Legalization agencies can keep case-relevant client data in a structured CRM instead of scattered notes and spreadsheets.

### Cases

Implemented:

- Case list with filters, sorting, value/debt display, service/status/responsible employee.
- New case page.
- Case detail page.
- Case number, status, service, responsible user, responsible business employee, trustee, notes.
- Case-specific legalization fields: stay purpose, stay type, sub-purpose, contract type, work-contract dates, MOS documents, cabinet login/password, fingerprints date, filing date, personal-appearance date, predicted decision date, legal stay deadline.
- Status history.
- Comments.
- Payments received and debt.
- Payment-plan/reminder tasks.
- Custom dates with task creation.
- Document update notes.
- Case documents: upload, preview/download/delete, Cloudinary primary storage, optional Dropbox copy.
- DOCX document generation from templates.
- Case deletion is admin/owner-only and requires archive-like status.

Marketing angle:

- The product is built around legalization case operations, not only generic contacts and pipeline cards.

### Documents And Templates

Implemented:

- Document templates in settings.
- Template types currently represented in code: client contract and power of attorney.
- DOCX generation with placeholders for client, case, organization, today, and payment-plan/installment data.
- Uploaded case documents with metadata, comments, Cloudinary file storage, optional Dropbox duplication.

Needs clarification:

- Final list of built-in templates.
- Whether custom templates are included in every paid plan or mainly Agency/service-led setup.
- Whether generated documents are legally reviewed.

### Tasks, Reminders, And Calendar

Implemented:

- Task page with Kanban-style priority columns.
- Create, edit, delete tasks.
- Task priorities configurable per organization.
- Due date and reminder date/note.
- Link tasks to clients and case-related metadata.
- Calendar month view.
- Dashboard upcoming events.
- Automatic task creation from selected case/client dates in several workflows.

Marketing angle:

- Helps prevent missed deadlines, forgotten follow-ups, and unpaid installments.

### Stages / Case Status Overview

Implemented:

- Stages page showing clients/cases grouped by statuses.
- Status matrix with case counts, value/paid indicators, service tags, and links to cases.
- Uses organization case statuses.

Marketing angle:

- Gives managers a process overview across the agency.

### Employees, Users, And Access

Implemented:

- Login users with roles: `owner`, `admin`, `employee`.
- Admin/owner are privileged inside an organization.
- System admin concept via owner role or configured admin emails.
- Employee users can have `restrictedAccess`.
- Restricted users are scoped to assigned cases, clients, leads, and tasks.
- Separate `Employee` entity for business responsibility/trustee use.
- Employee settings page and top-level employees page.
- User management: create/edit/delete users, avatar upload, role selection, restricted access.

Important distinction:

- `User` = authentication and access control.
- `Employee` = business responsible person shown on leads/cases and used operationally.

Needs clarification:

- Whether `owner` should be marketed or kept as internal/system role.
- Whether restricted employee financial visibility is desired for all customers.

### Settings And Customization

Implemented:

- Organization settings hub.
- Users.
- Employees.
- Case statuses.
- Lead statuses/sources.
- Services.
- Case options.
- UI section visibility.
- Custom sections and custom fields for client/case data.
- Document templates.
- Billing.
- Integrations.
- Export/import.
- Organizations page for system admins.
- Referrals page for system admins.

Marketing angle:

- Agencies can adapt statuses, services, sources, fields, and templates to their own process.

### Import / Export

Implemented:

- Export endpoint and settings page.
- Exports for clients, cases, leads, payments, and all data.
- CSV import with preview and mapping.
- Lead import with mapping and duplicate handling.
- Import template.
- Unknown imported case columns can become custom fields.

Marketing angle:

- Migration from spreadsheets is supported at the product level.

Needs clarification:

- Whether migration help is a paid plan feature, service package, or manual support.

### Integrations And Storage

Implemented:

- Generic lead webhook with access key.
- Weblium-friendly URL pattern.
- Field mapping from external forms into lead fields.
- Auto-assignment for webhook leads: off, single user, or round robin.
- Facebook Lead Ads webhook.
- Meta OAuth flow and page selection.
- Instagram/Facebook message webhook handling.
- Outgoing Meta messages from lead detail when configured.
- Meta token diagnostics and subscription tooling.
- Google Sheets Apps Script sample that forwards new rows into CRM webhook.
- Telegram webhook URL for parsing lead notifications/messages into leads.
- Incoming webhook logs.
- Cloudinary as primary document storage.
- Optional Dropbox copy for newly uploaded documents.

Needs clarification:

- Which integrations are production-ready enough for public claims.
- Meta integrations depend on external Meta permissions, tokens, page setup, and App Review.
- Google Sheets support is via Apps Script/webhook guidance, not a native Google API connection in the reviewed code.
- Dropbox support depends on a stored access token and settings.

### Billing And Plans

Implemented:

- Plan definitions and usage limits:
  - Free: 1 user, 10 clients, 10 active cases, 20 leads.
  - Starter: 3 users, 50 clients, 50 active cases, 80 leads, 249 PLN/month in code.
  - Pro: 10 users, 200 clients, 200 active cases, 300 leads, 499 PLN/month in code.
  - Agency: individual/unlimited limits, from 849 PLN/month in code.
  - Manual: internal/admin-managed plan.
- Billing snapshot API.
- Billing settings page.
- Usage metering for users, clients, active cases, and leads.
- Soft warnings at 80 percent usage.
- Hard limit checks when creating users, clients, active cases, or leads.
- Billing contact action.
- Organization-level custom limit overrides.

Needs clarification:

- Final public prices and plan packaging.
- Whether taxes/VAT are included.
- Whether there is any external payment provider integration outside reviewed code.
- Trial length and conversion process.
- What exactly "Agency" includes in service/support terms.

### Referrals And Partner Portal

Implemented:

- System-admin referral partner management.
- Referral codes and signup URLs.
- Partner portal URLs with partner token.
- Referral attribution during organization registration.
- Manual commission creation for attributed organizations.
- Manual payout marking.
- Partner portal showing invited organizations, commissions, payouts, and terms.

Needs clarification:

- Whether commissions are intentionally manual or should be automatically calculated from paid invoices.
- Final partner program terms.
- Whether the partner portal is ready for public partner recruitment.

## 5. User Roles And Access Concepts

Repository-supported roles/entities:

| Concept | Evidence | Meaning |
| --- | --- | --- |
| `owner` | `User.role`, system-admin checks | Privileged role; also used for system-level access in some code. |
| `admin` | `User.role`, settings/billing checks | Organization admin. Can manage many settings, users, billing, and destructive actions. |
| `employee` | `User.role` | Standard CRM user. Can be restricted. |
| Restricted employee | `User.restrictedAccess`, `apiScope.ts` | Employee whose access is limited to assigned leads, cases, clients, and tasks. |
| System admin | `isSystemAdmin` | Owner/configured admin email with cross-organization tools such as organizations/referrals. |
| Business employee | `Employee` model | Operational responsible person/trustee; not the same as a login user. |
| Referral partner | `ReferralPartner` and `/partner` | External partner with limited portal access by code/token. |
| Website visitor | Public pages/contact/register | Can browse marketing pages, contact sales, or register. |

Not found:

- End-client portal role.
- Accountant-specific role.
- Manager role separate from admin.
- Department/branch roles beyond generic organization/user/employee structures.

Assumption:

- "Owner/admin/employee" can be translated into marketing language as "agency owner/admin/team member", but the exact customer-facing naming should be approved.

## 6. Business Processes Covered

### Lead-To-Case Pipeline

Supported flow:

1. Lead enters manually, by contact form, import, webhook, Meta, Telegram, or Google Sheets script.
2. Lead gets status/source/responsible person/next contact.
3. Team tracks contact history, messages, reminders, and status reasons.
4. Qualified lead converts into client and optionally case.
5. Lead employee assignment can carry into the new case.

### Client Intake And Profile Management

Supported flow:

1. Create or convert client.
2. Store identity, contact, passport, address, stay, residence-card, family, travel, and historical-stay data.
3. Add custom fields/sections when default CRM fields are insufficient.
4. Create reminders for critical dates such as passport expiry.

### Legalization Case Management

Supported flow:

1. Create case for an existing/new client.
2. Assign service, status, responsible user/employee, trustee, contract value, and relevant dates.
3. Track status history and comments.
4. Add documents, update notes, custom dates, and tasks.
5. Generate documents from templates.
6. Archive/delete only under controlled conditions.

### Deadline And Reminder Management

Supported flow:

1. Tasks are created manually or from client/case dates.
2. Tasks appear in task board, calendar, dashboard upcoming events, and relevant entity pages.
3. Priorities and due/reminder dates guide follow-up.

### Payments And Debt Control

Supported flow:

1. Case has total value and total paid.
2. Payments can be added and edited.
3. Debt is computed and shown in case list/dashboard.
4. Planned payments can be represented as tasks/reminders and used in document template data.
5. Dashboard and subpages surface income/debt/new-case indicators.

### Team And Access Management

Supported flow:

1. Admin creates users.
2. Admin sets role and optional restricted access.
3. Users and employees can be assigned to operational records.
4. Restricted scope limits records returned by APIs.

### Organization Setup And Customization

Supported flow:

1. Organization is provisioned on registration.
2. Default statuses/services/options can be copied in.
3. Admin configures statuses, services, options, fields, document templates, section visibility, and integrations.

### Import, Export, And Migration

Supported flow:

1. Import clients/cases/leads via CSV.
2. Preview and map imported columns.
3. Export data sets for reporting or backup.

### Referral Program

Supported flow:

1. System admin creates referral partner.
2. Partner gets signup and portal URLs.
3. Organization registration with referral code creates attribution.
4. System admin manually adds commission and marks payouts.
5. Partner portal shows invited organizations and commission/payout data.

## 7. Customer Pains The Product Solves

Evidence-backed or strongly inferred from implemented features:

- Leads arrive from too many places: forms, social, messengers, spreadsheets, ads, Telegram notifications.
- Follow-ups are missed when next-contact dates are kept in memory or chat.
- Client data is too complex for generic contact cards.
- Legalization cases require specialized dates, documents, statuses, and history.
- Documents and notes are scattered across drives, chats, and local computers.
- Managers lack a clean overview of debts, income, active cases, and upcoming deadlines.
- Teams need to know who is responsible for each lead/case.
- Agencies need configurable services, statuses, sources, and fields because every agency process differs.
- Migration from Excel/CSV is painful.
- Generic CRMs do not model residence/work/legalization workflows out of the box.

Assumptions to validate with customers:

- Agencies are losing revenue because hot leads are not contacted quickly enough.
- Missed legalization deadlines create the highest perceived risk.
- Payment/debt control is a major buying trigger.
- Owners want fewer separate tools rather than best-in-class separate tools.

## 8. Marketing Advantages To Use Carefully

Safe advantages supported by code:

- Built specifically for legalization companies in Poland.
- Combines requests/leads, clients, cases, documents, deadlines, payments, and tasks in one system.
- Lead-to-client-to-case conversion workflow.
- Legalization-specific client and case fields.
- Dashboard for operational and financial control.
- Configurable statuses, services, lead sources, case options, custom sections, and custom fields.
- Team access control with admin/employee roles and restricted employee scope.
- Import/export support for spreadsheet-based migration.
- Document templates and generated DOCX files.
- Case document storage with Cloudinary and optional Dropbox copy.
- Webhook intake for external forms/services.
- Meta/Facebook/Instagram, Telegram, and Google Sheets intake paths exist in code, with setup dependencies.
- Free plan and public plan tiers exist in code.
- Quick-start/onboarding UI exists for admins/owners.
- Referral partner portal exists.

Marketing statements that should be marked or reviewed:

- "No leads will ever be lost" - too absolute; use "helps prevent lost leads".
- "Automatic Meta/Instagram communication" - only if tokens, permissions, and App Review are in place.
- "Automatic partner payouts" - not supported by reviewed code; payouts appear manual.
- "Full billing automation" - not confirmed.
- "GDPR-compliant" - legal review needed even though privacy/data deletion pages exist.
- "Secure document storage" - can say "document storage via Cloudinary with optional Dropbox copy" but avoid broad security claims without evidence.
- "Works for every immigration/legal process" - too broad; use specific supported workflows or "adaptable statuses/services".

## 9. Functions Already Implemented

High-confidence implemented features:

- Public landing/pricing/contact/legal pages.
- Registration/login/session handling.
- Organization provisioning.
- Billing plan definitions, plan limits, usage snapshots, and limit enforcement.
- Dashboard, reports, quick start, tutorial-video infrastructure.
- Lead CRUD, board/table, filters, contact history, messages, reminders, conversion, import.
- Client CRUD, detailed data model, travel/history/family/phones/custom fields.
- Case CRUD, status history, comments, dates, tasks, payments, documents, templates.
- Tasks and calendar.
- Stages/status overview.
- Users, employees, roles, restricted access.
- Services, statuses, lead sources, case options, UI sections, custom sections/fields.
- Document template management and DOCX generation.
- CSV import/export.
- Lead webhooks, field mapping, assignment, logs.
- Meta/Facebook/Instagram lead/message integration paths.
- Telegram webhook lead intake path.
- Google Sheets Apps Script forwarding path.
- Cloudinary storage and optional Dropbox copy.
- System-admin organization management.
- Referral partner management and partner portal.

## 10. Future / Planned-Looking Or Needs-Verification Areas

Items that look planned, service-led, externally dependent, or incomplete from a marketing-proof standpoint:

- Self-serve payment processor checkout/subscriptions: not confirmed in reviewed code.
- Agency-plan promises: priority support, migration help, individual templates, advanced integrations need commercial/process confirmation.
- Automatic partner commission calculation from paid invoices: not confirmed; reviewed referral commission flow is manual.
- Multi-department/multi-office workflows: mentioned in plan copy, but no explicit department model was found.
- End-client portal: not found.
- Dedicated accountant/manager roles: not found.
- E-signature, OCR, AI, document recognition, or official government API integrations: not found.
- Full production readiness of Meta outgoing messages: depends on Meta tokens, permissions, page setup, and App Review.
- Tutorial video completeness: UI and settings exist; final video coverage/assets need confirmation.
- Legal/security/GDPR claims: require legal/product approval.

## 11. Positioning Drafts

### Short Positioning

LegalHub CRM is a CRM for legalization agencies in Poland that brings leads, clients, cases, documents, deadlines, payments, and team tasks into one workspace.

### Practical Positioning

For legalization agencies that have outgrown spreadsheets and chat-based coordination, LegalHub CRM gives the team a structured workflow from incoming request to client case, documents, deadlines, payments, and responsible employee.

### Owner-Focused Value Proposition

Run a legalization agency with clearer control: see active cases, upcoming deadlines, unpaid balances, new clients, lead follow-ups, and team responsibility from one CRM.

### Specialist-Focused Value Proposition

Know what to do next for each client: follow-ups, documents, dates, comments, payments, and case status stay connected to the client and case record.

## 12. Messaging Guardrails

Use:

- "Legalization agencies in Poland".
- "Helps manage".
- "Centralizes".
- "Tracks".
- "Supports".
- "Can be configured".
- "Webhook-based integrations".
- "Optional Dropbox copy".
- "Plan definitions in code show...".

Avoid unless validated:

- "Guaranteed".
- "Fully automated".
- "Compliant".
- "Official integration with [provider]".
- "Works without setup".
- "Replaces legal expertise".
- "Automatically pays partners".
- "Unlimited" except when tied to the Agency plan definition and reviewed with pricing.

## 13. Open Questions

Product and market:

- What is the primary ICP for the next 90 days: solo specialists, small agencies, or larger agencies?
- Which services should be named in ads: karta pobytu, work permits, PESEL, meldunek, oswiadczenia, or broader "legalization cases"?
- Which languages should public marketing officially support?
- What are the top three buying triggers from real customers?
- Which proof points exist: active agencies, number of cases, revenue, testimonials, demos, screenshots, case studies?

Pricing and packaging:

- Are Free, Starter, Pro, and Agency prices final?
- Is VAT included?
- Is there a trial for paid plans, and how long is it in production?
- Is billing manual/contact-sales or connected to a payment processor?
- Which features belong to which plan beyond usage limits?

Sales and onboarding:

- What is the main CTA: free registration, demo, consultation, or contact?
- Is migration assistance included or paid?
- What onboarding promise can be safely made?
- Are tutorial videos complete and approved?

Integrations:

- Which integrations are production-ready enough for ads?
- Has Meta App Review/Advanced Access been completed for lead and message workflows?
- Should Google Sheets be marketed as "Apps Script/webhook" rather than "native integration"?
- Is Telegram intake officially supported or an advanced/manual setup?

Compliance and trust:

- What security and privacy claims have legal approval?
- Where are documents stored in production and under whose accounts?
- What backup/retention/deletion policy should marketing mention?
- Are generated document templates legally reviewed?

Product roadmap:

- Is a client portal planned?
- Are automatic billing, subscriptions, and partner commissions planned?
- Are departments/branches planned?
- Are OCR/AI/e-signature/government integrations planned?
