# PRODUCT_MAP - LegalHub CRM

Last updated: 2026-07-07

Status: repository-audited route, module, process, and feature map.

Scope of this document: describes what is visible in the repository. Anything not confirmed is marked Assumption or Needs clarification.

## Product Summary

LegalHub CRM is a multi-tenant SaaS CRM/case-management product for legalization companies in Poland. The application combines a public marketing/signup surface with an authenticated CRM workspace for organizations.

Core workflow:

1. Visitor or external system creates a lead/request.
2. Team qualifies the lead, tracks contact history, messages, source, reminders, and responsible person.
3. Qualified lead converts to client and optionally a case.
4. Team manages the client profile, legalization case, documents, deadlines, payments, comments, tasks, and history.
5. Admins configure services, statuses, users, employees, custom fields, templates, integrations, billing, and imports/exports.

## Route Map

### Public Routes

| Route | Purpose | Notes |
| --- | --- | --- |
| `/` | Public marketing landing page | Product positioning, tour, pricing, CTA. |
| `/pricing` | Pricing page | Uses marketing/pricing content and plan CTAs. |
| `/contact` | Contact/request page | Form creates CRM lead in default organization via `/api/contact`. |
| `/login` | Login page | Auth entry. |
| `/register` | Registration page | Creates organization and first admin user. Supports plan/ref query params. |
| `/privacy` | Privacy policy | Public trust/legal page. |
| `/regulamin` | Terms/regulations | Public legal page. |
| `/data-deletion` | Data deletion info | Useful for Meta app requirements. |
| `/delete-data` | Data deletion page | Public deletion-related page. |
| `/partner` | Partner portal | Opens by `code` and `token`; shows partner referral stats, commissions, payouts. |

### Main CRM Routes

| Route | Module | Purpose |
| --- | --- | --- |
| `/dashboard` | Dashboard | Financial/operational KPIs, charts, upcoming events, recent cases, quick start. |
| `/dashboard/income` | Dashboard report | Income details. |
| `/dashboard/debt` | Dashboard report | Debt/unpaid balances. |
| `/dashboard/new-cases` | Dashboard report | New cases analytics/list. |
| `/dashboard/new-clients` | Dashboard report | New clients analytics/list. |
| `/leads` | Leads | Table/board, filters, sorting, reminders, bulk actions. |
| `/leads/new` | Leads | Create lead. |
| `/leads/[id]` | Leads | Lead detail, edit, contact history, messages, reminders, convert. |
| `/clients` | Clients | Client list/search/sorting/columns. |
| `/clients/new` | Clients | Create client. |
| `/clients/[id]` | Clients | Client detail with personal, immigration, family, travel, cases, custom fields. |
| `/cases` | Cases | Case list/search/filter/sort, debt/value/responsible indicators. |
| `/cases/new` | Cases | Create case. |
| `/cases/[id]` | Cases | Case detail, payments, comments, documents, dates, tasks, templates. |
| `/stages` | Stages | Case/status overview matrix by client and status. |
| `/tasks` | Tasks | Kanban-style task board by priority; create/edit/delete tasks. |
| `/calendar` | Calendar | Month view of tasks and reminders. |
| `/employees` | Employees | Top-level employee view/page. |

### Settings Routes

| Route | Purpose |
| --- | --- |
| `/settings` | Settings hub. |
| `/settings/users` | Login users, roles, restricted access, avatars. |
| `/settings/employees` | Business employee/responsible-person management. |
| `/settings/statuses` | Case statuses. |
| `/settings/services` | Services offered by the organization. |
| `/settings/sections` | UI section visibility, custom sections, custom fields, quick start/tutorial settings. |
| `/settings/lead-sources` | Lead statuses and sources. |
| `/settings/case-options` | Case option dictionaries, including service-specific/options-style data. |
| `/settings/document-templates` | DOCX document templates and placeholders. |
| `/settings/billing` | Current plan, usage, limits, trial/period, plan features, contact/upgrade. |
| `/settings/integrations` | Webhooks, Meta, Google Sheets Apps Script, Telegram, Cloudinary/Dropbox storage, logs. |
| `/settings/referrals` | System-admin referral partner management. |
| `/settings/export` | Import/export flows for CRM data. |
| `/settings/organizations` | System-admin organization management. |

### API Route Groups

| API group | Purpose |
| --- | --- |
| `/api/auth/*` | Login, logout, current user, registration. |
| `/api/billing`, `/api/billing/contact` | Billing snapshot and billing contact intent. |
| `/api/contact` | Public contact form to CRM lead. |
| `/api/cases*` | Case CRUD, comments, payments, custom dates, document updates, documents, generated documents. |
| `/api/clients*` | Client CRUD, travel history. |
| `/api/leads*` | Lead CRUD, contacts, conversion, messages, reminders. |
| `/api/import`, `/api/import-leads`, `/api/export` | CSV import/export. |
| `/api/statuses`, `/api/task-priorities`, `/api/services`, `/api/case-options`, `/api/lead-statuses`, `/api/lead-sources` | Organization dictionaries/settings. |
| `/api/users`, `/api/employees` | User and employee management. |
| `/api/custom-sections`, `/api/custom-fields`, `/api/custom-field-values`, `/api/ui-section-settings` | Customization and UI settings. |
| `/api/document-templates` | Template CRUD. |
| `/api/documents/[id]/file`, `/api/cloudinary`, `/api/storage-settings` | Document storage/file access. |
| `/api/lead-webhook-settings`, `/api/lead-webhook-logs` | Lead webhook configuration and logs. |
| `/api/webhooks/leads/*` | Generic external lead webhook endpoints. |
| `/api/webhooks/meta/*` | Meta/Facebook leads and messages webhooks. |
| `/api/webhooks/telegram/*` | Telegram lead webhook endpoint. |
| `/api/meta/*` | Meta data deletion, OAuth, page selection, subscriptions, token diagnostics. |
| `/api/notifications/meta-messages` | Meta message notification/send-adjacent endpoint. |
| `/api/organizations*` | System-admin organization management. |
| `/api/referrals*`, `/api/partner/referrals` | Referral partners, commissions, payouts, partner portal data. |
| `/api/organization-settings`, `/api/user-preferences` | Settings/preferences. |
| `/api/fix-sequences` | Maintenance endpoint. |

## Main Modules And Feature Status

### Marketing Website

Status: implemented.

Features:

- Landing page and pricing page.
- Contact form.
- Registration CTA.
- Legal pages and data-deletion pages.
- Marketing copy positions the product for legalization companies in Poland.
- Public assets include LegalHub logo and overview video reference.

Open questions:

- Final public language strategy.
- Whether all plan/pricing copy is approved for ads.
- Whether there are proof points/testimonials to add.

### Signup, Auth, And Multi-Tenancy

Status: implemented.

Features:

- Login/logout/current user.
- Registration creates organization, user, and default settings.
- Per-organization data isolation through `organizationId`.
- Default/template statuses, priorities, services, and options can be copied.
- Referral code attribution during signup.
- Trial/free/manual plan handling.

Open questions:

- Final signup eligibility.
- Trial duration and production billing flow.
- Whether system-admin fallback login behavior is production-only or maintenance-only.

### Dashboard

Status: implemented.

Features:

- KPI cards for monthly income, debt, contracts signed without payment, clients, total cases, active cases.
- Charts for new cases and new clients over six months.
- Upcoming events/reminders.
- Recent cases table.
- Quick-start panel for admins/owners.
- Tutorial-video infrastructure.
- Report subpages for income, debt, new cases, and new clients.

Open questions:

- Exact KPI definitions for marketing copy.
- Whether all reports are customer-facing enough for screenshots.

### Leads / Requests

Status: implemented.

Features:

- Lead list in table and board modes.
- Filters, quick filters, sorting, visible columns.
- Lead statuses, sources, status reasons.
- Manual lead creation.
- Lead detail page.
- Contact history.
- Messages.
- Next-contact reminders.
- Lead phones.
- Responsible login user and business employee assignment.
- Bulk actions.
- CSV import with mapping/preview/duplicates.
- Lead conversion to client and optional case.
- Intake from webhooks, Meta, Telegram, Google Sheets script, public contact form.

Key data:

- Name/full name, phone, email, social handles.
- Source, status, temperature.
- Service interest, budget, urgency.
- Language, country, city.
- Deadline, last contact, next contact.
- Notes/comment and status reason.

Open questions:

- Which lead channels should be included in core marketing.
- Whether Meta messages are production-ready.

### Clients

Status: implemented.

Features:

- Client list.
- New client form.
- Client detail page.
- Multiple phones.
- Personal, passport, contact, address, stay, residence-card, fine, travel, and previous-stay data.
- Family links.
- Previous names.
- Custom sections/fields.
- Case relationships.
- Passport-expiry warning/task logic.
- Admin/owner deletion with related cleanup.

Key data:

- PESEL, passport, birth date/place, citizenship/nationality.
- Marital status, education, profession, status UKR.
- Parents, branch, legal title, rental agreement end.
- Entry date, residence-card number/issue/expiry.
- Address in origin country, previous residence, address in Poland.

Open questions:

- Which fields should be surfaced in marketing screenshots without overwhelming prospects.

### Cases

Status: implemented.

Features:

- Case list.
- New case form.
- Case detail.
- Status, service, case number, assigned user, employee, trustee.
- Stay purpose/type/sub-purpose.
- Contract fields and value/payment tracking.
- MOS documents, cabinet login/password, work-contract dates.
- Fingerprints, predicted decision, filing, personal appearance, legal stay deadline.
- Status history.
- Comments.
- Payments and debt.
- Payment-plan tasks.
- Custom dates and document update notes.
- Case documents with upload/preview/download/delete.
- DOCX generation from templates.
- Delete restrictions: admin/owner and archive-like case status.

Open questions:

- Which case types are core supported workflows vs configurable examples.
- Whether MOS/cabinet terminology should appear in public marketing.

### Documents

Status: implemented.

Features:

- Case document upload and storage.
- Cloudinary primary storage.
- Optional Dropbox copy.
- Document comments.
- Document template settings.
- DOCX generation with placeholders.
- Current template types in code: client contract, power of attorney.
- Placeholder data covers client, case, organization, today, payment plan/installments.

Open questions:

- Final library of approved templates.
- Legal review status of templates.
- Whether Dropbox should be marketed or kept as advanced setup.

### Tasks And Calendar

Status: implemented.

Features:

- Task board by priority.
- Create/edit/delete tasks.
- Priorities configurable.
- Due date and reminder date/note.
- Calendar month view.
- Dashboard upcoming events.
- Automatic task creation from certain case/client dates and lead next contacts.
- Links to clients/cases through metadata where available.

Open questions:

- Whether lead tasks should appear in the main calendar; current calendar excludes lead tasks based on reviewed behavior.

### Stages

Status: implemented.

Features:

- Status matrix by clients/cases.
- Case count, service tags, paid/value indicators.
- Links into cases.
- Uses configured case statuses.

Open questions:

- Whether stages are intended as manager overview only or will become an interactive pipeline.

### Users, Employees, And Access

Status: implemented.

Features:

- User roles: owner, admin, employee.
- Admin/owner privileges.
- System-admin concept.
- Restricted employee scope.
- User avatars.
- User CRUD.
- Separate business `Employee` entity for responsible person/trustee assignment.
- Employee CRUD/settings.

Important distinction:

- `User` controls login and access.
- `Employee` identifies the operational responsible person.

Open questions:

- Final customer-facing role labels.
- Whether owner role is internal or customer-facing.

### Organization Settings And Customization

Status: implemented.

Features:

- Case statuses.
- Lead statuses and lead sources.
- Task priorities.
- Services.
- Case options.
- UI section visibility.
- Custom sections.
- Custom fields and values.
- Organization settings including quick start/tutorial toggles.
- Document templates.

Open questions:

- Which settings are available per plan.

### Import / Export

Status: implemented.

Features:

- Export clients, cases, leads, payments, and all data.
- CSV import.
- Import preview and column mapping.
- Lead import with duplicate skip by contact details.
- Unknown case columns can become custom fields.
- Import template.

Open questions:

- What migration support can be promised publicly.

### Integrations

Status: implemented with external setup dependencies.

Features:

- Lead webhook endpoint per organization.
- Webhook access key.
- Weblium-friendly webhook URL.
- Field mapping into known lead fields.
- Auto-assignment for webhook leads: off, single user, round robin.
- Incoming request logs.
- Facebook Lead Ads webhook settings.
- Meta OAuth start/callback/select.
- Meta page subscription tooling.
- Meta token diagnostics.
- Instagram/Facebook message webhooks.
- Outgoing Meta messages from lead detail when configured.
- Google Sheets Apps Script sample forwarding new rows.
- Telegram webhook URL and setWebhook command guidance.
- Cloudinary storage and optional Dropbox copy.

Open questions:

- Production-readiness and support boundaries for each integration.
- Meta App Review / Advanced Access status.
- Whether Google Sheets should be advertised as native integration or script-based.

### Billing

Status: implemented as plan/limit management; payment processor not confirmed.

Features:

- Plan definitions.
- Usage metrics: users, clients, active cases, leads.
- Limits and custom overrides.
- Soft warning at 80 percent usage.
- Hard enforcement on create flows.
- Billing settings page.
- Billing contact flow.
- System-admin organization tools.

Plan definitions found:

| Plan | Price in code | Limits |
| --- | --- | --- |
| Free | 0 PLN forever | 1 user, 10 clients, 10 active cases, 20 leads. |
| Starter | 249 PLN/month | 3 users, 50 clients, 50 active cases, 80 leads. |
| Pro | 499 PLN/month | 10 users, 200 clients, 200 active cases, 300 leads. |
| Agency | from 849 PLN/month | Individual/unlimited limits in code. |
| Manual | Manual/internal | No automatic limits unless overridden. |

Needs clarification:

- Final public pricing.
- VAT/tax handling.
- External payment collection.
- Plan feature matrix beyond limits.

### Referrals And Partner Portal

Status: implemented; commercial rules need clarification.

Features:

- Referral partner create/edit/archive/delete for system admins.
- Referral codes and signup URLs.
- Partner portal URLs with code/token.
- Registration attribution by referral code.
- Manual commission creation.
- Manual payout marking.
- Partner portal shows invited organizations, commissions, payouts, and terms.

Needs clarification:

- Automatic vs manual commission rules.
- Final partner agreement and payout workflow.

## Data Model Map

### Tenant And Identity

- `Organization`
- `User`
- `Employee`

### Lead Management

- `Lead`
- `LeadStatus`
- `LeadPhone`
- `LeadContactHistory`
- `LeadMessage`
- `LeadWebhookLog`

### Client Management

- `Client`
- `ClientPhone`
- `ClientFamilyLink`
- `TravelHistory`
- `PreviousPolandStay`

### Case Management

- `Case`
- `CaseStatus`
- `Service`
- `CaseOption`
- `Payment`
- `Document`
- `CaseDocument`
- `Comment`
- `StatusHistory`
- `CaseCustomDate`
- `DocUpdate`

### Tasks And Settings

- `Task`
- `TaskPriority`
- `UiSectionSetting`
- `CustomSection`
- `CustomField`
- `CustomFieldValue`
- `DocumentTemplate`

### Referrals

- `ReferralPartner`
- `ReferralAttribution`
- `ReferralCommission`
- `ReferralPayout`

## User Roles And Permissions

| Role/entity | Status | Capabilities visible in code |
| --- | --- | --- |
| Website visitor | Implemented | View public pages, contact, register, login. |
| Organization admin | Implemented | Manage CRM data, settings, users, billing, destructive actions depending on endpoint. |
| Organization owner | Implemented | Privileged role; also participates in system-admin checks. |
| Employee user | Implemented | Standard authenticated CRM user. |
| Restricted employee user | Implemented | Scoped data access for assigned cases, clients, leads, and tasks. |
| System admin | Implemented | Cross-organization and referral administration. |
| Business employee | Implemented | Operational responsible person, not necessarily a login account. |
| Referral partner | Implemented | Limited portal access by code/token. |
| End client | Not found | No end-client portal route found. |

## Business Process Map

| Process | Covered by | Status |
| --- | --- | --- |
| Public demand capture | Landing, pricing, contact, register | Implemented. |
| Product inquiry to CRM lead | `/api/contact` | Implemented. |
| Organization signup | `/register`, `/api/auth/register` | Implemented. |
| Lead intake from external channels | Webhook, Meta, Telegram, Google Sheets script, import | Implemented with setup dependencies. |
| Lead qualification | Leads module | Implemented. |
| Follow-up management | Lead reminders, contact history, tasks | Implemented. |
| Lead conversion | `/api/leads/[id]/convert` | Implemented. |
| Client intake | Clients module | Implemented. |
| Legalization case execution | Cases module | Implemented. |
| Document storage | Cloudinary, optional Dropbox | Implemented with provider dependencies. |
| Document generation | DOCX templates | Implemented. |
| Deadline tracking | Tasks/calendar/dashboard | Implemented. |
| Payment/debt tracking | Case payments, dashboard debt/income | Implemented. |
| Team responsibility | Users, employees, assignments, restricted access | Implemented. |
| Custom process setup | Statuses, services, options, fields, templates | Implemented. |
| Spreadsheet migration | Import/export | Implemented. |
| Plan usage enforcement | Billing limits | Implemented. |
| Subscription payment collection | Payment processor | Needs clarification. |
| Referral partner program | Referrals and partner portal | Implemented; commercial automation needs clarification. |

## Implemented Feature Inventory

High-confidence implemented:

- Public marketing pages.
- Auth and registration.
- Multi-tenant organization model.
- Leads, clients, cases.
- Lead conversion.
- Tasks, reminders, calendar.
- Dashboard and report pages.
- Payments/debt tracking.
- Case document uploads.
- DOCX document generation.
- Custom fields/sections.
- Status/services/options management.
- Users/roles/restricted access.
- Employees/responsible people.
- CSV import/export.
- Webhook lead intake.
- Meta/Facebook/Instagram integration paths.
- Telegram integration path.
- Google Sheets Apps Script path.
- Cloudinary and optional Dropbox storage.
- Billing plans/limits.
- System-admin organization/referral tools.
- Partner portal.

## Future-Looking / Planned-Looking / Needs Verification

- Payment processor integration for subscription checkout and automatic billing.
- Automatic referral commission calculation from paid subscriptions.
- Agency package services: priority support, migration help, individual templates, advanced integrations.
- Client portal.
- Department/branch model.
- Accountant/manager roles beyond admin/employee.
- AI/OCR/e-signature/government API integrations.
- Fully approved Meta messaging workflow.
- Legally reviewed document template library.
- Approved security/GDPR marketing claims.

## Product Strengths For Marketing

Use these as core message pillars:

- Specialized for legalization agencies in Poland.
- One operational workspace from lead to case completion.
- Designed around client data complexity in legalization work.
- Helps control deadlines, documents, payments, and team responsibility.
- Configurable to each agency's process.
- Supports spreadsheet migration through import/export.
- Includes intake paths from forms, ads, messengers, Telegram, and Google Sheets-style workflows.
- Gives owners/admins dashboards for debt, income, active cases, and upcoming work.

Safe phrasing examples:

- "LegalHub CRM helps legalization agencies keep leads, clients, cases, documents, deadlines, payments, and tasks in one system."
- "Built around the workflow of legalization cases in Poland."
- "Import spreadsheets, configure statuses and services, and start managing cases in a structured CRM."
- "Connect external lead sources through webhooks and supported setup flows."

Avoid until clarified:

- "Fully automated billing."
- "Automatic partner payouts."
- "Official native Google Sheets integration."
- "Guaranteed compliance."
- "No setup required for Meta/Instagram."
- "All document templates are legally verified."

## Open Questions

Priority questions:

- What is the primary ICP for marketing now?
- Which plan/pricing details are final?
- Which integrations are production-ready and supported by the team?
- Is billing manual/contact-sales or integrated with a payment provider?
- What proof points can be used publicly?
- What language/market should paid traffic target first?
- Are templates legally reviewed?
- What exact onboarding promise is safe?
- What security/privacy claims are approved?
- Is an end-client portal planned or intentionally out of scope?
