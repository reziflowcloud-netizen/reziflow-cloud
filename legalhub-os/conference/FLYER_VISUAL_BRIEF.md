# LegalHub CRM — DL Flyer Visual Brief

Last updated: 2026-09-11

Status: production brief; QR images must not be generated yet.

## 1. Deliverable

- Format: DL, 99 × 210 mm after trim.
- Sides: two.
- Color: full color, premium B2B SaaS.
- Orientation: portrait.
- Bleed: 3 mm on all sides, subject to printer confirmation.
- Artwork size with bleed: 105 × 216 mm.
- Safe area: keep essential text, logo, screenshot labels, and QR reservations at least 5 mm inside the trim.
- Output: printer-requested PDF standard plus a separate review PDF/PNG.
- Color conversion: design from the LegalHub brand HEX values, then convert using the print provider’s CMYK profile and approve a physical or contract proof. Do not invent CMYK values without the printer profile.

### Flyer language production model

- Primary: complete Ukrainian front and back.
- Alternate: a separate complete Polish front and back if a Polish print batch
  is needed.
- Keep the layout, screenshot, QR hierarchy, and information architecture
  identical across both single-language batches.
- Never put the complete Ukrainian version on one side and the complete Polish
  version on the other.
- Optional future fallback: if the owner later requests one bilingual physical
  flyer, create a new shortened mirrored UA/PL layout. The current full copy
  cannot be fitted into that option.

## 2. Creative direction

The flyer should feel like a real, specialized operational product:

- structured;
- calm;
- precise;
- credible;
- premium but not luxurious;
- product-led rather than decorative;
- clearly connected to the actual LegalHub CRM interface.

Visual concept:

> Scattered agency work becomes one visible, manageable workflow.

Avoid:

- generic corporate stock photography;
- legal gavels, courthouse columns, flags, passports, or immigration clichés;
- glossy 3D icons;
- futuristic AI visuals;
- neon or purple-pink gradients;
- fake UI;
- provider logos or integration claims;
- tiny full-screen screenshots;
- pricing or unapproved proof.

## 3. Brand system

### Colors

- Primary action / focus: #06B6D4.
- Deeper cyan: #0891B2.
- Logo navy: #08264A.
- Sidebar navy: #08111F.
- Light workspace: #F4F5F7.
- Clean light background: #F8FAFC.
- White surface: #FFFFFF.
- Border: #E5E7EB.
- Main text: #111827.
- Deep headline: #0F172A.
- Muted text: #6B7280 or #64748B.
- Amber accent: #F2A100, used only as a small semantic accent.

Recommended coverage:

- 70–80% background and white surfaces;
- 15–25% navy and text;
- 5–10% cyan;
- no more than 5% amber or semantic status color.

### Typography

- Inter.
- Segoe UI or system sans only as fallback.
- Headline: Inter 800.
- Section title: Inter 700.
- Body: Inter 400–500.
- Labels and CTA: Inter 700.
- Left alignment is the default.
- Use sentence case; uppercase only for short labels.

Suggested print sizes:

- headline: 20–24 pt, depending on chosen language;
- positioning: 9.5–11 pt;
- benefits: 8.4–9.2 pt;
- section headings / QR labels: 9.5–11 pt;
- body and explanations: 8–9 pt;
- footer: 7.5–8.5 pt.

Do not reduce essential text below 7.5 pt. Shorten copy first.

### UI geometry

- White cards with thin neutral borders.
- Small 2–3 mm corner radii in print, proportionally echoing the 8–10 px UI radii.
- Restrained shadows only; no hard black edge.
- One cyan highlight method on the screenshot.
- Thin alignment and workflow lines at low opacity.

## 4. Front layout

Use coordinates relative to the 99 × 210 mm trimmed page. Keep all elements inside x = 5–94 mm.

### Zone A — brand and category

- y = 5–20 mm.
- Official full LegalHub CRM logo at top left.
- Category eyebrow beneath or aligned to the logo.
- Preserve official logo colors and proportions.

### Zone B — headline

- y = 23–52 mm.
- Two to four lines maximum.
- Deep navy text on a light background.
- One cyan word or short cyan rule may provide focus; do not recolor the entire headline.

### Zone C — positioning

- y = 55–72 mm.
- One compact paragraph.
- Maximum four lines at final size.

### Zone D — hero product screenshot

- y = 76–130 mm.
- One real, approved screenshot composition.
- Width: 84–89 mm.
- Flat, front-facing crop; optional perspective no more than 2 degrees.
- Outer crop radius: approximately 2–3 mm.
- One soft shadow and one 0.3–0.5 mm cyan outline around the focal dashboard region.
- Preserve enough of the navy sidebar to identify the product, but do not show a full desktop screen at unreadable scale.

Exact screenshot:

- source: existing approved demo organization only;
- screen: dashboard;
- crop: left navigation fragment plus the top KPI group and either upcoming events or recent cases;
- focal proof: active cases / upcoming work / debt or another approved KPI group already visible in the real dashboard;
- exclude: browser URL, admin-only settings, technical integration screens, credentials, real people, real payments, real contact data;
- data: fake demo data only;
- treatment: no regenerated UI, no edited labels or values.

### Zone E — benefits

- y = 135–184 mm.
- Four short rows from FLYER_COPY.md.
- Use small outline icons from one consistent family: lead, calendar/task, document, payment/team.
- Icons support scanning; they do not replace the text.
- Use a 4–5 mm vertical rhythm.

### Zone F — turn cue

- y = 188–202 mm.
- Compact cyan arrow or cyan text CTA.
- Keep this as a directional cue, not a second product button.

## 5. Back layout

Use coordinates relative to the 99 × 210 mm trimmed page. Keep all elements inside x = 5–94 mm.

### Zone A — audience

- y = 5–30 mm.
- Short uppercase label.
- One compact audience paragraph.
- Optional thin cyan divider.

### Zone B — problem / solution

- y = 33–75 mm.
- White card on #F4F5F7 or a navy card with white text.
- One short heading plus the approved problem/solution paragraph.
- Use one restrained visual line showing Excel / chats / folders → LegalHub CRM. Use generic outline cues, not provider logos.

### Zone C — two QR reservations

- y = 80–164 mm.
- Two columns with unequal hierarchy.
- QR codes are not generated in this task.
- Place clearly marked non-scannable placeholder frames only.
- Each placeholder must say QR PLACEHOLDER / DO NOT PRINT AS FINAL.

Primary QR 1:

- left column, approximately 54% of available width;
- reserved QR artwork size: 32 × 32 mm;
- allow the QR generator’s required quiet zone inside the reserved area;
- cyan-tinted or white card with stronger border;
- label: Дізнатися більше or Dowiedz się więcej;
- explanation from FLYER_COPY.md;
- visual rank: primary.

Secondary QR 2:

- right column, approximately 40% of available width;
- reserved QR artwork size: 26 × 26 mm, never below 25 × 25 mm without a successful print test;
- allow the QR generator’s required quiet zone inside the reserved area;
- white or navy-outline card;
- label: Відкрити демо or Otwórz demo;
- explanation from FLYER_COPY.md;
- add a compact DEMO label;
- visual rank: fast alternative, not a competing primary.

The two QR cards must not use identical size, fill, or label weight.

### Zone D — footer

- y = 169–205 mm.
- Website first, then Instagram and email.
- Use simple outline icons only if they remain legible.
- Do not repeat the full product description.

## 6. QR production requirements

Do not generate QR codes now.

When Development or production supplies the final QR artwork:

- QR 1 must encode the flyer landing trackable URL from CONFERENCE_TRACKING.md;
- QR 2 must encode the flyer demo trackable URL from CONFERENCE_TRACKING.md;
- do not encode login, password, session token, personal data, or a shortened URL whose ownership is unclear;
- use dark modules on a high-contrast light background;
- do not place a logo in the QR unless scanning reliability is verified;
- preserve the generator-defined quiet zone;
- export as vector when possible;
- test the imposed print PDF, not only the source design;
- test at 100% physical size, normal indoor conference lighting, and typical hand-held distance;
- test each QR on multiple iOS and Android devices before printing.

## 7. Landing-page visual system

The flyer and landing page should feel like one campaign.

### Mobile-first landing rules

Primary target:

- a modern phone viewport reached from a physical QR scan;
- approximately 360–430 CSS px wide, with a verification pass at 320 px;
- desktop remains supported but is the secondary layout.

Top-of-page composition:

- compact top bar with the LegalHub CRM logo and the existing main-website
  language switcher;
- the switcher exposes all four existing website languages;
- do not invent language names or codes in this brief: reuse existing website
  languages and their current labels;
- Development reuses the current website localization/routing/translation
  mechanism and preserves the selected language through conference navigation
  where technically reasonable;
- no full desktop navigation is required on mobile;
- show the product category, core promise, and both main CTAs very early;
- CTA controls use a minimum practical touch target of 44 × 44 CSS px and may
  become full-width stacked buttons.

Screenshot composition:

- never scale down a full desktop CRM view until its UI becomes unreadable;
- one screenshot block communicates one idea;
- make one real desktop-CRM crop large enough to read without pinch zoom;
- use dedicated mobile crops for dashboard, lead next contact, case context,
  documents, tasks/calendar, and payments;
- place headings and annotations outside the UI;
- keep sections compact: one heading, one short explanation, and one visual or
  small card set;
- desktop may use a wider layout or paired assets, but it must not determine
  the mobile crop.

Mobile performance:

- export responsive screenshot sizes in WebP/AVIF and keep a lossless source;
- preload only the real hero image used above the fold;
- lazy-load below-fold module and demo assets;
- provide explicit image width/height or aspect ratio to avoid layout shift;
- avoid autoplay video, decorative animation, large desktop-only payloads, and
  heavy visual effects;
- keep logo, language switcher, hero message, and CTAs usable before optional
  imagery finishes loading.

### Landing hero asset

Asset name:

conference-hero-dashboard

Capture:

- dashboard from the existing demo organization;
- desktop viewport around 1440 × 900 or higher;
- include the real navy sidebar, top KPI cards, upcoming events, and recent cases when readable;
- fake demo data only.

Treatment:

- preserve the original screenshot pixel-for-pixel;
- show the dashboard context in a large desktop crop;
- highlight one KPI/upcoming-work cluster with a single cyan outline or soft glow;
- light #F8FAFC stage, white surface, restrained shadow;
- no fake browser address;
- responsive mobile version uses a tighter KPI/upcoming-events crop rather than shrinking the desktop view;
- mobile crop is the primary production asset; the wide desktop composition is
  a secondary derivative.

### Modules / features assets

Asset 1: conference-feature-leads

- lead list or board;
- show status, responsible person, and next-contact context;
- crop one readable group of rows/cards;
- avoid real names, phone numbers, emails, social handles, or notes.

Asset 2: conference-feature-case

- case detail;
- show case header, status, service, responsible person, and one relevant date cluster;
- do not show cabinet credentials, passport, PESEL, or real personal data.

Asset 3: conference-feature-documents

- case documents block;
- show file list and document context using fake filenames only;
- do not show document previews containing personal information.

Asset 4: conference-feature-tasks-calendar

- task board or calendar segment;
- show one clear due-date or reminder cluster;
- use semantic warning/red only if that state is real in the demo screenshot.

Asset 5: conference-feature-payments

- payment/debt block or approved dashboard KPI group;
- fake values only;
- do not create fake numbers inside the artwork; capture existing approved demo values.

Use three assets on the live page by default: leads, case, and tasks/calendar. Documents and payments are optional alternating assets if the page remains concise.

### Demo section asset

Asset name:

conference-demo-entry

Preferred composition:

- one large approved case-detail crop;
- two smaller supporting crops: leads with next contact and dashboard upcoming work;
- all crops from the same existing demo account;
- no newly invented demo records;
- the existing shared demo is interactive, and visitors may edit, change
  statuses, create, or delete fake demo data;
- one cyan focus treatment across the composition;
- small caption: “Demo data” / “Dane demonstracyjne” / “Тестові дані,” matching the selected page language.

Primary mobile version:

- one large case-detail crop only;
- do not stack three tiny screenshots.

Secondary desktop version:

- the three-crop composition may be used only when every focal UI element
  remains readable.

## 8. Exact asset checklist

Brand:

- [ ] Official LegalHub CRM full-color logo for light backgrounds, vector.
- [ ] Official LegalHub CRM white/dark-background logo, vector.
- [ ] Approved simplified mark, vector, if available.
- [ ] Inter font files or licensed production access.

Flyer:

- [ ] 1440 × 900 or higher dashboard source screenshot from the existing demo account.
- [ ] One approved dashboard crop for the front.
- [ ] Light and dark proof of the front.
- [ ] Back with two non-scannable QR placeholders.
- [ ] Final QR 1 vector supplied only after destination QA.
- [ ] Final QR 2 vector supplied only after demo-route QA.
- [ ] 100% physical proof.

Landing hero:

- [ ] Desktop dashboard hero, minimum 1600 px rendered width.
- [ ] Mobile dashboard crop, minimum 900 px rendered width.
- [ ] WebP/AVIF exports plus lossless source.
- [ ] Localized alt text.
- [ ] Existing four-language website switcher is visible at the top.
- [ ] Existing website localization mechanism is reused.
- [ ] Selected website language is preserved through conference navigation
      where technically reasonable.
- [ ] Hero message and both CTAs appear very early on mobile.
- [ ] Mobile page is checked at 320, 360, 390, and 430 CSS px widths.
- [ ] Touch targets are at least 44 × 44 CSS px.
- [ ] Only the hero image is preloaded; below-fold screenshots are lazy-loaded.

Modules:

- [ ] Leads / next-contact crop.
- [ ] Case header / dates / responsible crop.
- [ ] Documents crop.
- [ ] Tasks or calendar crop.
- [ ] Payments/debt crop.

Demo:

- [ ] Desktop demo composition.
- [ ] Single-crop mobile fallback.
- [ ] Localized “demo data” label.

Approvals:

- [ ] Privacy check confirms fake data only.
- [ ] Pixel comparison confirms screenshot UI was not altered.
- [ ] Valentyn approves every public screenshot.
- [ ] Ukrainian flyer spelling proof completed for the primary print batch.
- [ ] Polish flyer spelling proof completed if the alternate batch is used.
- [ ] All four existing website-language conference translations pass content
      QA using the existing site locale names and codes.

## 9. Screenshot QA

- The screenshot comes from the existing demo organization.
- All data is fake and safe for public display.
- No real name, phone, email, address, PESEL, passport, document, payment, comment, credential, API key, OAuth screen, or admin-only technical setting is visible.
- No UI label, value, icon, row, field, status, or button is regenerated or edited.
- One focal fragment remains readable at actual print size and on a mobile screen.
- Copy stays outside the UI.
- One highlight method is used.
- Final screenshot-based artwork is approved by Valentyn.
