# LegalHub CRM — Conference Tracking

Last updated: 2026-09-11

Status: provider-neutral tracking specification. Analytics provider: Needs implementation decision.

## 1. Naming convention

Working campaign identifier:

conference_legalization_poland

This is intentionally event-neutral because the conference name and date were not provided. If the team replaces it with an official event slug, replace it everywhere before printing and keep it unchanged for the entire campaign.

UTM fields:

- utm_source identifies the offline conference campaign source.
- utm_medium separates the physical flyer from the conference landing page.
- utm_campaign uses one stable campaign identifier.
- utm_content identifies the exact link or CTA.

Do not put personal data, credentials, passwords, demo session tokens, or attendee identifiers in URL parameters.

Localization rule:

- the URL examples below remain the canonical working destinations;
- Development must inspect and reuse the main website’s existing localization
  routing and translation conventions for all four current website languages;
- do not invent locale prefixes, query parameters, language names, or codes in
  this document;
- preserve the selected website language through conference navigation where
  technically reasonable while retaining the UTM values;
- the language switcher and localized routes must reuse existing website
  languages.

## 2. Exact trackable URLs

### Flyer landing QR

Purpose:

- primary QR on the flyer;
- opens the conference landing page.

URL:

https://legalhubcrm.com/conference?utm_source=conference&utm_medium=offline_flyer&utm_campaign=conference_legalization_poland&utm_content=qr_landing

### Flyer demo QR

Purpose:

- secondary fast-route QR on the flyer;
- opens the safe access route for the existing demo account.

URL:

https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=offline_flyer&utm_campaign=conference_legalization_poland&utm_content=qr_demo

### Conference landing register button

Purpose:

- all “Спробувати безкоштовно” / “Wypróbuj bezpłatnie” buttons on the conference page.

URL:

https://legalhubcrm.com/register?plan=free&utm_source=conference&utm_medium=conference_landing&utm_campaign=conference_legalization_poland&utm_content=register_cta

If multiple placements need comparison, keep this as the canonical URL and add an internal property such as cta_location. Do not create different public URLs unless the team needs placement-level UTM reporting.

### Demo open from conference landing

Purpose:

- all “Відкрити демо” / “Otwórz demo” buttons on the conference page.

URL:

https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=conference_landing&utm_campaign=conference_legalization_poland&utm_content=demo_cta

### Main website button

Purpose:

- “Основний сайт” / “Strona główna” link on the conference page.

URL:

https://legalhubcrm.com/?utm_source=conference&utm_medium=conference_landing&utm_campaign=conference_legalization_poland&utm_content=main_website

## 3. Required events

Analytics provider:

Needs implementation decision.

### conference_page_view

Fire:

- once when the conference landing page is successfully viewed;
- do not fire for the demo route unless the demo route intentionally renders the landing page.

Recommended properties:

- page_path;
- page_language;
- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- referrer_domain;
- device_category;
- first_visit_id or anonymous_session_id, subject to consent and privacy implementation.

Do not send full referrer URLs if they can contain personal or sensitive query data.

### conference_demo_open

Fire:

- when a visitor explicitly clicks a demo CTA on the conference page; and
- when the flyer demo route is successfully opened.

Recommended properties:

- demo_origin: flyer_qr or conference_landing;
- cta_location: hero, modules, conference_section, final, header, or qr;
- page_language;
- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- demo_route_result: success or failure;
- demo_session_mode: interactive_shared;

Avoid double counting:

- treat the click as the intent event and demo route success as a result property or separate internal diagnostic;
- if the provider cannot update one event, fire one public conversion event on successful route open and keep click diagnostics under a different internal event name.

### conference_register_click

Fire:

- when a visitor clicks a conference registration CTA.

Recommended properties:

- cta_location: hero, conference_section, final, header, or sticky_mobile;
- page_language;
- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- destination_path: /register;
- selected_plan: free, because it is present in the approved route.

### conference_register_complete

Fire:

- only after the registration has completed successfully and the organization/account has been created according to the existing registration flow;
- do not fire on form view, form start, validation error, or button click.

Recommended properties:

- page_language;
- original_utm_source;
- original_utm_medium;
- original_utm_campaign;
- original_utm_content;
- registration_origin: conference_landing or demo, if known;
- time_from_first_conference_visit_bucket, optional;
- anonymous campaign visit identifier, subject to consent and privacy implementation.

Do not send:

- email;
- phone;
- name;
- organization name;
- password;
- session token;
- document or case data.

## 4. Attribution behavior

- Capture the five approved UTM values on the first conference entry.
- Preserve them through the conference landing page, demo route, and registration flow using the project’s approved first-party mechanism.
- Do not overwrite the original campaign attribution merely because the visitor moves from the landing page to the demo route.
- If both first-touch and last-touch are supported, store both clearly.
- Set a documented expiry window. Needs implementation decision.
- Respect the site’s consent and privacy rules. Needs implementation decision.
- Do not use fingerprinting or hidden attendee identifiers.

Recommended attribution priority:

1. Exact conference UTM values.
2. Demo origin or registration origin.
3. CTA location.
4. Selected page language from the existing website locale mechanism.

## 5. Demo route requirements

Route:

https://legalhubcrm.com/conference/demo

Required behavior:

1. Accept approved UTM parameters.
2. Create or attach a safe server-side session for the existing shared demo account.
3. Redirect the visitor directly into the approved first demo view.
4. Never expose login, password, reusable session token, or internal credential in the URL, QR code, HTML, logs, or client-visible error.
5. Do not create a new conference organization.
6. Do not seed a separate conference-specific dataset. Records created,
   edited, or deleted by visitors remain ordinary fake data inside the
   existing shared demo account.
7. Use only the existing demo account and its approved fake data.
8. Keep the demo interactive: visitors may click, edit, change statuses, and
   create or delete fake demo data.
9. Do not make the conference demo read-only.
10. Preserve campaign attribution and the selected existing website language
    for later registration where technically and legally approved.
11. Provide a safe failure state with localized links back to the conference
    page and to free registration.

Needs Development decision:

- shared-state reset and recovery behavior after visitors edit/create/delete
  demo data;
- which admin-only or technically sensitive areas remain excluded without
  restricting normal interactive CRM use;
- session TTL;
- rate limiting and abuse protection;
- concurrent visitor handling;
- logout and session cleanup;
- exclusion of admin-only technical settings;
- monitoring and alerting;
- how a demo visitor proceeds to create their own organization without confusing demo and production sessions.

## 6. CTA-location map

| Element | cta_location | Event |
| --- | --- | --- |
| Hero registration button | hero | conference_register_click |
| Hero demo button | hero | conference_demo_open |
| Header demo button | header | conference_demo_open |
| Modules demo button | modules | conference_demo_open |
| Conference-section demo button | conference_section | conference_demo_open |
| Conference-section registration button | conference_section | conference_register_click |
| Final registration button | final | conference_register_click |
| Final demo button | final | conference_demo_open |
| Sticky mobile registration button | sticky_mobile | conference_register_click |
| Flyer landing QR | qr | conference_page_view after landing loads |
| Flyer demo QR | qr | conference_demo_open after route succeeds |

## 7. Reporting view

Minimum campaign report:

- conference page views;
- demo opens by origin;
- registration clicks;
- completed registrations;
- page-view-to-demo rate;
- page-view-to-register-click rate;
- register-click-to-complete rate;
- QR 1 versus QR 2 activity;
- language split across all four existing website languages.

Do not publish conversion benchmarks until real baseline data exists.

## 8. Pre-launch QA

URLs:

- [ ] Every URL resolves on HTTPS.
- [ ] UTM values remain intact after redirects.
- [ ] No credential or token appears in the address bar.
- [ ] Main website and Instagram links open correctly.
- [ ] Registration destination is approved.

Flyer:

- [ ] QR 1 encodes the exact flyer landing URL.
- [ ] QR 2 encodes the exact flyer demo URL.
- [ ] Both are tested from the final imposed print PDF.
- [ ] Both are tested on a physical proof.

Events:

- [ ] conference_page_view fires once per intended page view.
- [ ] conference_demo_open records the correct origin.
- [ ] conference_register_click records the correct CTA location.
- [ ] conference_register_complete fires only after successful completion.
- [ ] No event contains personal data or credentials.
- [ ] Duplicate firing in client/server transitions is checked.

Attribution:

- [ ] Flyer landing attribution survives navigation to registration.
- [ ] Landing demo attribution survives the demo route.
- [ ] Original conference attribution is available at registration completion.
- [ ] Consent and retention behavior are approved.

## 9. Implementation handoff for Development

Conference landing page:

- implement all four existing main-website languages;
- inspect and reuse the current website localization, routing, translation,
  fallback, and visible language-switcher conventions;
- do not create a separate localization architecture or invent locale codes;
- preserve the selected language through conference, demo, registration, and
  return navigation where technically reasonable;
- build the concise section order specified there;
- connect every CTA to the exact trackable URL in this file;
- use approved real product screenshots with fake demo data;
- keep screenshot copy outside the UI;
- add accessible alt text and keyboard-visible focus states;
- treat modern phones reached from QR scans as the primary layout;
- keep the language switcher accessible at the top and both hero CTAs visible
  very early;
- use thumb-friendly controls, compact sections, large readable CRM crops, and
  one product idea per screenshot block;
- avoid long mobile navigation and unreadable scaled desktop screenshots;
- optimize responsive images and initial rendering for mobile QR traffic;
- support desktop as the secondary layout.

Demo access route:

- implement /conference/demo as a server-controlled entry into the existing demo account;
- do not place credentials or a session token in the URL;
- do not create another organization or pre-seed a separate
  conference-specific dataset;
- keep the shared demo interactive so visitors may edit, change statuses,
  create, and delete fake demo data;
- do not impose a read-only conference mode;
- apply the concurrency, reset/recovery, abuse-protection, session, and expiry
  decisions listed above;
- preserve provider-neutral campaign attribution where approved;
- provide a safe error and recovery route.

Tracking:

- choose the analytics provider and document the decision;
- implement the four required event names exactly;
- validate their trigger rules and properties;
- exclude personal data and credentials;
- test UTM persistence across landing, demo, and registration;
- document the attribution expiry and consent behavior.

Production:

- do not generate or print QR codes until both routes and all UTMs are verified;
- provide final vector QR artwork to the designer only after QA;
- retest the final print-ready PDF and one physical proof.
