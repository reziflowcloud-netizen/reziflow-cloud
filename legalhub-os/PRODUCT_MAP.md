# Product Map

Last updated: 2026-07-07

This map is based on repository structure and visible schema/routes only.
Anything not visible in the repository is marked `Needs clarification`.

## Pages/routes

Public and legal pages:

- `/` - public marketing landing page.
- `/pricing` - pricing page.
- `/contact` - contact page.
- `/privacy` - privacy policy page.
- `/regulamin` - terms/regulations page.
- `/data-deletion` - data deletion page.
- `/delete-data` - data deletion page/flow.

Authentication and onboarding:

- `/login` - login.
- `/register` - organization registration.

Main CRM:

- `/dashboard` - CRM dashboard.
- `/dashboard/income` - income dashboard.
- `/dashboard/debt` - debt dashboard.
- `/dashboard/new-cases` - new cases dashboard view.
- `/dashboard/new-clients` - new clients dashboard view.
- `/leads` - leads list/board.
- `/leads/new` - new lead.
- `/leads/[id]` - lead detail/card.
- `/clients` - clients list.
- `/clients/new` - new client.
- `/clients/[id]` - client detail/card.
- `/cases` - cases list.
- `/cases/new` - new case.
- `/cases/[id]` - case detail/card.
- `/stages` - case stages view.
- `/tasks` - tasks.
- `/calendar` - calendar.
- `/employees` - employees/responsible people area.

Settings and administration:

- `/settings` - settings hub.
- `/settings/users` - app users and roles.
- `/settings/employees` - responsible employees/trustees.
- `/settings/statuses` - case statuses.
- `/settings/services` - services.
- `/settings/sections` - UI sections, quick start, tutorial video settings.
- `/settings/lead-sources` - lead sources.
- `/settings/case-options` - case option dictionaries.
- `/settings/document-templates` - document templates.
- `/settings/billing` - billing and limits.
- `/settings/integrations` - integrations.
- `/settings/referrals` - referral settings.
- `/settings/export` - import/export.
- `/settings/organizations` - organizations and first administrators.

Partner/referral:

- `/partner` - partner portal.

API route families visible in repository:

- Auth: `/api/auth/*`
- Billing: `/api/billing/*`
- Cases, clients, leads, tasks, users, employees, services, statuses.
- Documents and document templates.
- Custom sections, custom fields, UI section settings.
- Import/export.
- Organizations and organization settings.
- Referrals and partner referrals.
- Meta OAuth/subscriptions/webhooks/messages.
- Telegram lead webhook.
- Storage settings, Cloudinary, Dropbox-related document fields.

## Modules

- Marketing website.
- Authentication and organization registration.
- Multi-organization CRM workspace.
- Dashboard and analytics.
- Lead management.
- Client management.
- Case management.
- Document management and templates.
- Payments, debt, and billing usage limits.
- Tasks and calendar.
- Employee/responsible-person management.
- User roles and restricted access.
- Settings and process customization.
- Import/export.
- Partner/referral program.
- Integrations and webhooks.
- Tutorial videos and quick-start onboarding.

## Features

Lead features:

- Lead sources: manual, Instagram, Facebook, quiz, Meta Ads, website, and
  customizable sources.
- Lead statuses with colors, ordering, and optional required reasons.
- Lead contact data: name, phone, email, Instagram, Facebook, Messenger ID,
  city, voivodeship, country, language, service interest, budget, urgency.
- Multiple phones with WhatsApp, Telegram, and Viber flags.
- Contact history, messages, next contact, last contact, reminders.
- Responsible employee assignment.
- Lead-to-client/case conversion.
- Webhook logs and external lead intake.

Client features:

- Core profile, phones, email, city.
- Passport, PESEL, birth, citizenship, nationality, marital/family fields.
- Address/stay data in Poland.
- Physical and travel-history fields.
- Previous Poland stays.
- Family links between clients.
- Custom sections and custom fields.

Case features:

- Case number and status.
- Service, stay purpose/type/sub-purpose, case options.
- Responsible app user and responsible employee.
- Contract fields, agency contract fields, employer contract fields.
- MOS number, MOS sent dates, cabinet login/password fields.
- Filing, personal appearance, legal stay, predicted decision, fingerprints,
  custom dates.
- Total value, paid amount, payments, debt.
- Documents, Cloudinary/Dropbox storage metadata, document templates.
- Comments, status history, document updates.

Admin/settings features:

- Users with roles: admin and employee.
- Restricted access for employee users.
- Responsible employees/trustees independent from app-user access.
- Organizations, plans, billing status, trials, and custom billing limits.
- Services, statuses, task priorities, lead sources, case options.
- UI section visibility, custom sections, custom fields.
- Tutorial video buttons and dashboard quick start visibility.
- Import/export.
- Integrations and storage settings.

## User roles

Visible roles and access concepts:

- `owner` - privileged role used in access checks and system/admin logic.
- `admin` - organization administrator; can manage settings and many admin-only
  resources.
- `employee` - standard app user.
- Restricted employee - an employee with `restrictedAccess`, scoped through
  assigned `User.id`.
- Responsible employee/trustee - `Employee` business entity used on leads and
  cases; not the same as an app `User` and should not be described as granting
  login access.
- Referral partner - visible through partner portal/referral entities; exact
  login/access model needs clarification.

Needs clarification:

- Whether `owner` is used by LegalHub internal admins only or also by customer
  organizations.
- Which roles should appear in public marketing copy.

## Business processes

Visible process flows:

1. Visitor reads public website or pricing.
2. Visitor registers an organization and first admin.
3. Organization configures services, statuses, employees, users, sections,
   lead sources, case options, document templates, integrations, and billing.
4. Leads arrive manually, from website/contact, import, Meta/Facebook/Instagram,
   Telegram, or other webhook paths.
5. Team qualifies leads, records contact history/messages, schedules next
   contact, assigns a responsible employee, and converts qualified leads into
   clients/cases.
6. Team manages client profiles and legal case data.
7. Case moves through statuses/stages with deadlines, documents, payments,
   comments, document updates, and responsible ownership.
8. Managers monitor dashboard, income, debt, new clients/cases, tasks, and
   calendar.
9. Admins export/import data, adjust billing and limits, and manage partner or
   referral relationships.

Needs clarification:

- Exact sales process for LegalHub CRM itself.
- Exact onboarding process offered to customers.
- Which integrations are production-ready versus partially implemented.

## Data/entities visible from repository

Prisma models:

- `User`
- `Organization`
- `ReferralPartner`
- `ReferralAttribution`
- `ReferralCommission`
- `ReferralPayout`
- `LeadStatus`
- `Lead`
- `LeadPhone`
- `LeadWebhookLog`
- `LeadContactHistory`
- `LeadMessage`
- `DocumentTemplate`
- `UiSectionSetting`
- `CustomSection`
- `CustomField`
- `CustomFieldValue`
- `Client`
- `ClientPhone`
- `ClientFamilyLink`
- `Case`
- `Payment`
- `Document`
- `Comment`
- `StatusHistory`
- `Task`
- `CaseStatus`
- `TaskPriority`
- `Service`
- `CaseOption`
- `Employee`
- `CaseCustomDate`
- `DocUpdate`
- `CaseDocument`
- `TravelHistory`
- `PreviousPolandStay`

## Visible plans and limits

From repository billing/marketing code:

- Free: 1 user, up to 10 clients, up to 10 active cases, up to 20 leads.
- Starter: up to 3 users, 50 clients, 50 active cases, 80 leads.
- Pro: up to 10 users, 200 clients, 200 active cases, 300 leads.
- Agency: individual/unlimited limits.
- Manual: internal/manual administration plan.

Needs clarification:

- Whether prices and limits are final for campaigns.
- Whether all plans are live in production.
