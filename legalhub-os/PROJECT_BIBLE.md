# Project Bible

Last updated: 2026-07-07

Sources used for this initial version:

- `PROJECT_STATE.md`
- `HANDOFF.md`
- `DEPLOY_NOTES.md`
- `prisma/schema.prisma`
- `src/app` route map
- `src/lib/billing.ts`
- `src/lib/leads.ts`
- `src/lib/marketingI18n.ts`
- `src/lib/authI18n.ts`

## What is LegalHub CRM

LegalHub CRM is a SaaS CRM and case-management system for legalization
agencies in Poland.

The repository shows a public LegalHub website, registration/login flow, and an
internal CRM workspace for organizations, users, clients, cases, tasks, leads,
documents, billing/referrals, and integrations.

Production site visible from repository notes: `https://legalhubcrm.com`.

## Target audience

Visible from the repository:

- Legalization agencies and firms in Poland.
- One specialist, a small team, a growing agency, or a larger agency with
  multiple departments/offices.
- Teams managing immigration/legalization services such as Karta Pobytu, work
  permits, PESEL, meldunek, oswiadczenia, and similar processes.
- Users working in Russian, Ukrainian, Polish, and English interfaces/content.

Needs clarification:

- Primary decision maker: owner, operations manager, sales lead, legal
  consultant, or office administrator.
- Exact customer segments by company size, city, language, and service mix.
- Whether the product targets only legalization agencies or also broader
  immigration, relocation, HR, and legal-service companies.

## Core problem

Legalization work is often spread across chats, Excel/Google Sheets, Drive,
email, calendars, and memory. Leads can be lost, documents can be scattered,
deadlines can be missed, and managers may not see who is responsible or what
the next step is.

The product appears to solve this by giving each request/client/case a visible
status, responsible person, documents, deadlines, payments, history, and next
action inside one CRM.

## Main modules

- Public marketing site and pricing.
- Registration and login.
- Organization/workspace provisioning.
- Dashboard with analytics, quick start, and tutorial video controls.
- Leads: sources, statuses, contact history, messages, reminders, assignment,
  and lead-to-client/case conversion.
- Clients: personal data, phones, passport data, stay data, family links,
  travel history, previous Poland stays, and custom fields/sections.
- Cases: statuses/stages, services, responsible employees, MOS fields,
  contracts, payments, debt, documents, comments, status history, custom dates,
  document updates, and templates.
- Tasks and calendar.
- Settings: users, employees, statuses, services, sections, lead sources, case
  options, document templates, billing, integrations, referrals, import/export,
  organizations.
- Partner portal and referral tracking.
- Integrations and storage: Meta, Telegram/webhooks, Cloudinary, Dropbox,
  import/export, PostgreSQL, Vercel deployment.

## Key benefits

Repository-supported benefits:

- One workspace for leads, clients, cases, documents, payments, deadlines, and
  team ownership.
- Specialized around legalization workflows rather than generic sales CRM.
- Clear flow from lead/request to client and case.
- Manager visibility into active cases, new clients, new cases, debt,
  deadlines, and next actions.
- Role and access management with admin/employee users and restricted employee
  access.
- Responsible employee tracking for leads and cases.
- Customizable statuses, services, lead sources, sections, fields, and case
  options.
- Document upload/storage and document templates.
- Import/export for moving data from spreadsheets.
- Free plan and paid plans visible in billing/marketing code.
- Multilingual marketing/auth/CRM copy appears in Russian, Ukrainian, Polish,
  and English.

Needs clarification:

- Quantified outcomes and proof points.
- Customer testimonials, case studies, usage numbers, and retention data.
- Exact onboarding/support promise for paid plans.
- Security/compliance claims that are safe to use publicly.

## Positioning

Initial positioning:

LegalHub CRM is a specialized CRM for legalization companies in Poland that
brings requests, clients, cases, documents, deadlines, payments, and
responsible employees into one controlled workflow.

Possible short form:

LegalHub CRM helps legalization agencies in Poland keep every case under
control from first request to final decision.

Differentiation visible from repository:

- Built around legalization case flow, not a generic CRM pipeline.
- Combines lead intake, case management, documents, deadlines, payments, and
  team access in one product.
- Supports practical agency operations: import from Excel, employee roles,
  restricted access, document templates, storage integrations, and billing
  limits.

Needs clarification:

- Final brand voice.
- Competitive set.
- Strongest buying trigger.
- Main objection to overcome.
- Preferred language for primary campaigns.

## Open questions

- Who is the first-priority ICP for the next 90 days?
- Which country/language should marketing lead with: Polish, Russian,
  Ukrainian, or English?
- Are prices in the current code final and approved for marketing?
- Which services are core and which are examples only?
- What proof can be used: demos, screenshots, founder story, client quotes,
  customer numbers, before/after metrics?
- What claims about security, document storage, and legal compliance are
  approved?
- What is the preferred CTA: free registration, demo, WhatsApp/contact form,
  or consultation?
- Which channels matter first: Instagram, YouTube Shorts, SEO, LinkedIn, email,
  referrals, or paid ads?
- Are there existing brand guidelines, tone rules, logo rules, or forbidden
  phrases?
