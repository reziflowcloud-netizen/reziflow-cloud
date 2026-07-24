# LegalHub CRM — Visual Brand Guide

Last updated: 2026-07-24

Status: production guide for Instagram content.

Purpose: a single practical visual system for ChatGPT Image Generation, Canva,
CapCut, and human designers.

## Source-of-truth order

1. `OWNER_INPUTS.md` — audience, language, CTA, public product scope, and claim
   guardrails.
2. An approved LegalHub CRM screenshot with fake demo data — exact UI appearance
   and screenshot content.
3. The real interface and logo tokens documented below — color, typography,
   surfaces, spacing, and visual language.
4. `MARKETING_POSITIONING.md`, `INSTAGRAM_STRATEGY.md`, and current
   publish-ready briefs — message and campaign context.

If a feature, claim, CTA, price, integration, or product screen is not approved
by these sources, do not invent it. Mark it `Needs clarification`.

Launch language: Ukrainian. Russian may be added later as a secondary language.

Approved launch CTAs:

- Primary: `Спробувати безкоштовно`
- Fallback: `Напишіть “DEMO” в Direct, щоб отримати доступ`
- Diagnostic: `Отримати безкоштовний аудит процесів`
- Audit keyword: `AUDIT`

Public product framing:

> LegalHub CRM — CRM для компаній по легалізації в Польщі. Допомагає вести
> заявки, клієнтів, справи, документи, строки, оплати й команду в одній системі.

---

## 1. Brand Visual Identity

### Visual positioning

LegalHub CRM should look like a premium operational workspace for legalization
companies in Poland: specialized, structured, calm, and credible.

The visual idea is:

> scattered work becomes a visible, manageable workflow.

The content is not a generic software ad and not a legal-advice page. It should
look like a focused B2B SaaS campaign built from the real product interface.

### Mood

- calm control instead of panic;
- operational clarity instead of decoration;
- expert and direct instead of corporate or ceremonial;
- modern but not futuristic;
- premium but not luxurious;
- specific to real work, not abstract productivity;
- useful before promotional.

### Visual keywords

1. Structured
2. Operational
3. Precise
4. Calm
5. Credible
6. Focused
7. Specialized
8. Premium B2B SaaS

### Desired viewer response

The visual should make a qualified viewer feel:

- “They understand how a legalization company works.”
- “This is a real product, not a concept.”
- “I can quickly see the important part.”
- “The system brings order without making work more complicated.”
- “This looks reliable enough for daily agency operations.”

### Visual language of the actual dashboard

The current CRM uses:

- a deep navy left sidebar;
- a light gray workspace;
- white cards and tables;
- thin neutral borders;
- cyan for active navigation, focus, and primary actions;
- compact status badges in semantic colors;
- small uppercase labels and strong numeric values;
- modular KPI cards, tables, filters, charts, and task panels;
- restrained shadows and 7–10 px UI radii;
- 14–28 px working spacing, with a dense but orderly information hierarchy.

Instagram content should amplify this language without turning it into a
glowing sci-fi dashboard.

### UI component geometry

Use these real interface proportions when recreating supporting cards or
dashboard-inspired layouts outside a screenshot:

| Element | Real UI treatment |
| --- | --- |
| Main card/stat card/table container | 10 px radius, 1 px border |
| Kanban card | 8 px radius |
| Button/navigation item | 8 px radius |
| Input/select | 7 px radius |
| Login/modal-style card | 14 px radius |
| Badge | 20 px pill radius, 3 px × 9 px padding |
| Stat icon tile | 44 × 44 px, 10 px radius |
| Page padding | 28 px horizontal, 20–24 px vertical |
| Card padding | 16–18 px |
| Grid gap | 14–16 px |
| Table cell padding | 10–14 px vertical, 14 px horizontal |

Button language:

- primary button: cyan fill, white text, 13 px/600 in the app;
- secondary button: workspace background, neutral border, main text;
- ghost button: transparent background, muted text;
- social-production CTA may be larger, but should preserve the same restrained
  geometry and contrast.

Badge language:

- compact semantic pills;
- tinted soft background with darker status text;
- color communicates state, not decoration;
- no oversized glossy capsules.

Spacing should feel modular and systematic. Use a practical 8 px base rhythm
for social templates: 8, 16, 24, 32, 48, 64, 96.

---

## 2. Color System

These colors are taken from the current LegalHub CRM UI and official logo
assets. Use HEX values exactly unless print/export constraints require a color
profile conversion.

### Primary

| Role | HEX | Use |
| --- | --- | --- |
| LegalHub cyan | `#06B6D4` | Primary CTA, active UI state, key outline, arrow, highlight |
| Cyan hover/deep | `#0891B2` | Darker CTA state, supporting accent, readable cyan text |
| Logo navy | `#08264A` | Brand wordmark, serious headline, premium dark anchor |
| Sidebar navy | `#08111F` | Dark covers, split layouts, dashboard-inspired panels |

The cyan is the main action color. Navy gives the brand authority and contrast.
Do not replace either with an unrelated blue.

### Background

| Role | HEX | Use |
| --- | --- | --- |
| CRM workspace | `#F4F5F7` | Default light Instagram background inspired by the app |
| Clean light alternative | `#F8FAFC` | Airier Story/feed background and screenshot stage |
| Deep background | `#07111D` | Occasional premium dark layout derived from the slate theme |

Light backgrounds should dominate the feed. Dark backgrounds are for contrast,
owner-focused messages, Reel covers, and CTA slides.

### Surface / Card

| Role | HEX | Use |
| --- | --- | --- |
| Main surface | `#FFFFFF` | Cards, screenshot stage, callouts, text panels |
| Dark surface | `#0F1B2D` | Dark-theme cards, only when a dark composition is needed |
| Light border | `#E5E7EB` | Card and table borders |
| Stronger neutral border | `#D1D5DB` | Inputs or elements requiring clearer separation |

### Accent

| Role | HEX | Use |
| --- | --- | --- |
| Bright cyan | `#67E8F9` | Active label on dark background, restrained glow |
| Logo amber | `#F2A100` | Small brand spark, warning cue, one focal detail |
| Operational teal | `#14B8A6` | Secondary positive workflow line or solution marker |
| Status blue | `#2563EB` | Informational status, secondary diagram step |
| Status violet | `#7C3AED` | Rare category/date accent; never a primary brand color |

Use one dominant accent and no more than one secondary accent per visual.

### Text

| Role | HEX | Use |
| --- | --- | --- |
| Main UI text | `#111827` | Body and product-like text on light surfaces |
| Deep headline | `#0F172A` | Instagram headline and strong card title |
| White | `#FFFFFF` | Text on navy/cyan/dark backgrounds |

### Muted text

| Role | HEX | Use |
| --- | --- | --- |
| Main muted | `#6B7280` | Supporting line, UI label, metadata |
| Slate muted | `#64748B` | Longer secondary copy on `#F8FAFC` |
| Dark-theme muted | `#9FC3D2` | Supporting copy on dark slate surfaces |

### Success

| Role | HEX | Use |
| --- | --- | --- |
| Success | `#16A34A` | Paid, completed, positive state |
| Success soft | `#DCFCE7` | Success badge background |
| Success light | `#ECFDF5` | Positive card tint |

### Warning / Error

| Role | HEX | Use |
| --- | --- | --- |
| Warning | `#F59E0B` | Deadline attention, incomplete step |
| Warning soft | `#FEF3C7` | Warning badge background |
| Warning text | `#92400E` | Text on warning-soft |
| Error | `#DC2626` | Overdue, debt, missing required action |
| Error soft | `#FEF2F2` | Error/risk background |
| Error border | `#FECACA` | Error/risk outline |

Red is a semantic risk color, not an engagement trick. Never use it to make an
ordinary CTA feel urgent.

### Color ratios

Recommended per visual:

- 70–80% background/surface;
- 15–25% navy/text/UI;
- 5–10% cyan;
- 0–5% amber, green, or red when semantically necessary.

Avoid rainbow dashboards. Product statuses may be multicolor inside a real
screenshot, but the surrounding Instagram composition stays restrained.

### Gradients

Allowed:

- very subtle navy-to-slate dark background;
- cyan fade used as a highlight field;
- faint cyan radial glow behind one screenshot fragment;
- real UI/chart gradients already present in the screenshot.

Recommended dark gradient:

```text
#08111F -> #0F172A
```

Do not use more than two gradient stops. Do not use purple-pink, neon rainbow,
metallic, glassmorphism, or “AI technology” gradients.

---

## 3. Typography

### Actual and closest typefaces

The current CRM uses:

```text
-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

The official logo SVG declares:

```text
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif
```

Production default for Instagram:

1. `Inter`
2. `Segoe UI`
3. the platform system sans-serif

Use Inter in Canva and CapCut when available. Do not introduce a decorative
display typeface.

### Type roles

| Role | Weight | Style |
| --- | --- | --- |
| Headline | Inter 800 | Compact, direct, 2–7 words for covers |
| Secondary headline | Inter 700 | One clear supporting idea |
| Body | Inter 400–500 | Short sentences, generous line spacing |
| Labels | Inter 600–700 | Small, compact; uppercase only for 1–3 word tags |
| CTA | Inter 700 | Action phrase, never a paragraph |
| UI-like number | Inter 700–800 | Large metric with small label |

### Instagram size hierarchy

Working sizes in a 1080 px-wide design:

| Element | Story/Reel | Feed 4:5 | Square |
| --- | ---: | ---: | ---: |
| Main headline | 82–120 px | 68–96 px | 64–88 px |
| Secondary headline | 48–64 px | 42–56 px | 40–52 px |
| Supporting line | 34–46 px | 30–40 px | 28–38 px |
| Microcopy/label | 24–30 px | 22–28 px | 22–26 px |
| CTA | 32–42 px | 30–38 px | 28–36 px |

These are starting ranges, not permission to fill the canvas. If the headline
does not fit, shorten it before reducing it below the range.

### Typography rules

- Use sentence case for Ukrainian copy.
- Keep headline line length near 12–20 characters when possible.
- Use 0.95–1.05 line height for large headlines.
- Use 1.25–1.45 line height for supporting copy.
- Use slight negative tracking only for very large headlines: `-1%` to `-2%`.
- Do not use all caps for Ukrainian headlines.
- Use uppercase only for short labels such as `ДЛЯ ВЛАСНИКА`.
- Avoid centered paragraphs; center only a short cover or final CTA.
- Keep most layouts left-aligned to echo the CRM.
- Use one typeface and up to three weights per visual.
- Never imitate screenshot UI text with a different font inside the screenshot.

---

## 4. Instagram Format System

Safe zones below are conservative LegalHub production zones. Instagram UI and
profile crops can change, so always preview the final asset in the publishing
flow before approval.

### Story — 1080 × 1920, 9:16

- Working safe area for essential content: `x 90–990`, `y 250–1600`.
- Keep headline top at or below `y 250`.
- Keep CTA and interactive-sticker background above `y 1600`.
- Reserve roughly the bottom 320 px for reply/share/navigation UI.
- Reserve roughly the top 250 px for account/progress UI.
- Use one message per frame.
- Recommended composition: 35–45% message, 45–60% visual, 10–15% CTA/brand.

### Reel / Reel cover — 1080 × 1920, 9:16

- Use the same essential-content safe area as Stories.
- Keep subtitles within `x 90–990` and preferably `y 1260–1540`.
- Keep key UI away from the rightmost 170 px, where interaction controls can
  cover details.
- Keep the cover headline in the visual center, approximately
  `x 100–980`, `y 500–1400`.
- The headline must remain readable in a small profile-grid preview and after
  center cropping.
- Always test the selected cover in Instagram before publishing.

### Feed post — 1080 × 1350, 4:5

- Safe margins: at least 72 px left/right and 96 px top/bottom.
- Keep headline within the top 420 px.
- Keep CTA above `y 1180`.
- Use the lower half for one large product fragment or a structured card.
- Do not place critical copy on the final 40 px at any edge.

### Square — 1080 × 1080, 1:1

- Safe margins: at least 72 px on all sides.
- Use for simple statements, diagrams, profile-support posts, and quote-like
  product truths.
- Maximum: headline, one supporting line, one visual cue, one small brand mark.
- Avoid complex screenshots unless the selected fragment remains legible.

### Carousel — 1080 × 1350, 4:5

- Use the same 72 px horizontal and 96 px vertical safety margins.
- Keep the page number and topic label in fixed positions across all slides.
- One slide = one idea.
- Do not split words or critical UI across slide boundaries.
- Slide 1: hook. Middle slides: explanation/checklist. Final slide: approved CTA.
- Use consistent screenshot scale across adjacent slides.
- Recommended length: 5–8 slides unless the content brief specifies otherwise.

---

## 5. Screenshot Treatment

This is the most important production rule:

> Never shrink an entire desktop screenshot until it becomes unreadable. Show
> one important UI fragment large.

### Source and privacy

- Use only approved screenshots from the demo organization.
- Use only fake demo data.
- Never publish real data and do not treat blur as sufficient protection.
- Do not show real names, phone numbers, emails, addresses, PESEL, passport
  data, real documents, real payments, real comments, credentials, API keys,
  tokens, OAuth screens, `.env`, or admin-only technical settings.
- Public screenshots require Valentyn’s final approval.

### Select one focal fragment

Examples:

- one dashboard KPI group;
- one lead row plus next-contact field;
- one case header plus status/responsible person;
- one documents block;
- one payments/debt block;
- one task card or deadline cluster;
- one calendar segment.

The focal fragment should occupy approximately:

- 65–90% of canvas width in a Story/Reel;
- 55–85% of canvas width in a feed post;
- enough height for original labels to remain readable on a phone.

### Crop

- Crop to the relevant card, row, panel, or workflow step.
- Preserve enough surrounding UI to show that the fragment belongs to LegalHub
  CRM.
- Do not cut through a label, button, badge, number, or status.
- Do not crop so tightly that the viewer loses the relationship between label
  and value.
- If two fragments are needed, use two separate frames/slides or a deliberate
  before/after split.

### Zoom

- Use 120–220% visual scale relative to the full desktop screenshot.
- Zoom into one feature at a time.
- In video, animate from context to detail in 0.3–0.6 seconds.
- Stop the motion long enough to read the fragment: normally 1.2–2.5 seconds.
- Never use repeated aggressive zoom punches.

### Perspective

- Default: flat and front-facing for maximum legibility.
- Optional premium perspective: 2–4 degrees only.
- Do not skew tables or text.
- Do not use extreme 3D rotations or device mockups that reduce readability.
- Perspective is for depth, not spectacle.

### Rounded corners

- Preserve the screenshot’s real internal UI radii.
- For the outer screenshot crop, use 20–28 px on Story/Reel and 16–24 px on
  feed assets.
- Do not apply pill-shaped corners to a desktop panel.

### Shadows

The actual light UI uses:

```text
0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
```

and a medium state:

```text
0 4px 6px -1px rgba(0,0,0,0.07),
0 2px 4px -1px rgba(0,0,0,0.04)
```

For social layouts, scale the depth carefully:

```text
0 24px 60px rgba(8,17,31,0.16)
```

Use a soft shadow with no hard black edge. One hero fragment may have one
shadow; nested callouts should use lighter shadows.

### Background blur

- The focal screenshot must remain sharp.
- A duplicated full screenshot may be enlarged and blurred behind it at
  18–36 px blur and 8–18% opacity.
- Use blur to create context, never to conceal real data.
- A plain `#F4F5F7`, `#F8FAFC`, or navy background is often stronger.

### Glow

- Cyan glow is optional and restrained.
- Use approximately `rgba(6,182,212,0.14–0.24)`.
- Apply it only behind the selected feature or around a focus outline.
- Do not glow every edge, card, icon, and arrow.

### Browser chrome and device frames

- Show minimal browser chrome only when it helps viewers understand that this
  is a real desktop product.
- Keep browser chrome neutral and secondary.
- Do not add a fake URL, fake browser controls, or a fake mobile app shell.
- Device/laptop mockups are allowed for hero or overview visuals, but not when
  they make the UI too small.
- For educational content, a direct large screenshot crop is preferred.

### Highlighting

Use one primary highlight method per frame:

- 2–4 px cyan outline;
- translucent cyan field;
- soft cyan glow;
- spotlight/mask;
- magnified fragment;
- one arrow plus one short label.

Do not combine outline, glow, three arrows, a circle, and a magnifier on the
same feature.

### Callouts, arrows, and annotations

- Place annotations outside the screenshot whenever possible.
- Use 2–5 word callouts.
- Use cyan for informational callouts, amber for attention, red only for a real
  overdue/debt/risk state.
- Use simple straight or gently curved arrows, 3–5 px thick.
- Arrowheads must point to a precise field, not a general region.
- Keep callouts larger than screenshot microcopy.
- Do not cover the actual UI value being explained.
- Never edit the screenshot’s label or value to “make the story clearer.”

### Recommended screenshot workflow

1. Capture approved demo data at a high desktop resolution.
2. Verify privacy and remove the capture if any real data is present.
3. Select one product fragment that proves the message.
4. Crop and scale the fragment without resampling it into blur.
5. Place it on a clean LegalHub background.
6. Add one focus treatment.
7. Add Instagram headline and supporting copy outside the UI.
8. Preview at phone size.
9. Ask: can a viewer read the highlighted UI without zooming?
10. Send the final screenshot-based visual to Valentyn for approval.

---

## 6. Story Template System

Global Story rule: one frame = one main thought. Prefer 7–18 Ukrainian words
total, excluding a tiny label or CTA. A multi-step explanation becomes a
sequence, not one crowded frame.

### A. Pain / Question

- Composition: 60% clean background, 25% one visual metaphor or small UI cue,
  15% response area.
- Headline: top-left inside the safe zone; one question, 5–12 words.
- Screenshot: optional; use a small but readable risk fragment or no screenshot.
- CTA/sticker: lower safe zone, one poll/question sticker.
- Text limit: headline + one short supporting line; maximum 24 words.
- Example: `Хто знає, що має статися по справі далі?`

### B. Product Feature

- Composition: headline at top, one large screenshot fragment in the middle,
  CTA at bottom.
- Headline: 4–9 words; name the outcome, not only the module.
- Screenshot: 65–85% width, sharp, with one highlight.
- CTA: `Спробувати безкоштовно` or `DEMO`, depending on the brief.
- Text limit: headline + one 8–14 word supporting line + CTA.
- Example focus: next contact, responsible person, case dates, documents.

### C. Before vs After

- Composition: vertical split or two sequential frames.
- Before: off-white/gray, Excel/chat/folder cue, restrained amber/red label.
- After: white/navy/cyan, one real CRM fragment, teal/cyan solution label.
- Headline: top center or top-left; 3–7 words.
- Screenshot: show the “after” fragment larger than the “before” cue.
- CTA: final frame only.
- Text limit: one short label per side, maximum 5 words each.
- Do not promise instant transformation or zero setup.

### D. Quick Tip

- Composition: small topic tag, numbered tip, one checklist or UI fragment.
- Headline: top-left; `Швидка перевірка:` plus one action.
- Screenshot: optional; if used, one field or badge only.
- CTA: low-pressure response such as `Збережіть` or a question; use approved
  product CTA only when the brief requires it.
- Text limit: 3 checklist lines, 3–6 words each.
- Example: check `відповідальний`, `наступна задача`, `важлива дата`.

### E. CTA / Demo

- Composition: navy or clean light background, one hero screenshot fragment,
  compact benefit line, prominent CTA.
- Headline: 3–7 words.
- Screenshot: 45–65% of frame; do not compete with the CTA.
- CTA: lower safe zone; exact approved wording.
- Text limit: headline + one line + CTA; maximum 22 words.
- Link cue: `Посилання в профілі` when applicable.

---

## 7. Feed Post Template System

### A. Problem

- 4:5 light or navy cover.
- Large 3–7 word pain statement.
- One operational cue: spreadsheet row, chat bubble, deadline badge, or missing
  owner label.
- No full product tour.
- Small logo/wordmark in a fixed corner.

### B. Feature

- Outcome-led headline in the upper third.
- One large real screenshot fragment in the lower two-thirds.
- One cyan outline/callout.
- Supporting line explains why the field matters.
- Final CTA remains separate from the screenshot.

### C. Before / After

- Two clear columns or top/bottom sections.
- Before uses neutral gray with one semantic warning.
- After uses white/navy/cyan and a real CRM crop.
- Use parallel labels: `Було` / `Стало` or a more specific pair.
- Do not create a fake “after” interface.

### D. Educational

- Use 5–8 slide carousel structure.
- Slide 1: strong diagnostic hook.
- Slides 2–6: one item per slide.
- Penultimate slide: workflow or approved screenshot proof.
- Final slide: approved CTA.
- Use numbers, thin dividers, and compact operational icons.

### E. Product CTA

- Use navy background or a white surface on navy.
- Headline states audience/outcome, not hype.
- Include one readable product fragment or logo mark, not both at equal scale.
- Use one approved CTA.
- No public price, trial duration, plan limit, or integration claim.

---

## 8. Reel Cover System

Main rule:

> The cover headline contains 2–7 words and is readable in the Instagram grid
> preview.

### Type 1. Pain Statement

- Large left-aligned headline.
- Light background with navy text or navy background with white text.
- One amber/red semantic cue only if there is real risk.
- Optional tiny spreadsheet/chat/calendar icon.
- Example: `Рядок — це ще не справа`

### Type 2. Product Focus

- One oversized screenshot fragment or UI card.
- Headline above or beside the fragment, never over dense UI.
- Cyan focus outline.
- Small LegalHub wordmark.
- Example: `Що видно по справі`

### Type 3. Owner / Outcome

- Dark navy composition.
- Large white headline with one cyan keyword.
- Optional dashboard KPI fragment.
- Minimal grid/line detail.
- Example: `Власник бачить процес`

### Cover QA

- Read it at approximately 180 px width.
- Keep the main words in the center crop.
- No more than two headline lines when possible.
- Do not use a full desktop screenshot as the background.
- Do not place key words under Reel UI.
- Do not use a caption-sized supporting paragraph.

---

## 9. Text Hierarchy

### Headline

- One main idea.
- 2–7 words for Reel covers; up to 12 words for Stories/feed.
- Highest contrast and largest size.
- States a pain, question, outcome, or product truth.

### Supporting line

- Explains the headline in one sentence.
- 8–18 words.
- Approximately 45–60% of headline size.
- Remove it when the screenshot already proves the idea.

### Microcopy

- Topic label, annotation, number, or context.
- 1–5 words.
- Never carries the main message.
- Must remain readable on a phone.

### CTA

- Use only an approved action.
- One CTA per visual.
- High contrast, separate from screenshot UI.
- Do not mimic an app button if it could be confused with a clickable product
  control.

### Core rule

> One visual = one main thought.

If the design needs two headlines, four arrows, six benefits, and two CTAs, it
is at least two visuals.

---

## 10. UI Highlight System

Choose one of the following:

### Zoom

Scale the selected field or card to 120–220%. Preserve sharp text and enough
context to understand the location.

### Soft glow

Place a cyan glow behind the selected region at 14–24% opacity. Use only on
neutral or dark backgrounds.

### Outline

Use a 2–4 px `#06B6D4` rounded outline with 8–12 px breathing room around the
actual feature.

### Arrow

Use one 3–5 px cyan arrow from external annotation to the exact target.
Amber may mark attention. Red is limited to a real risk state.

### Magnified fragment

Duplicate a small UI region into a larger sharp card connected by one thin
line. The magnified fragment must be pixel-consistent with the source.

### Darkening surrounding UI

Apply a navy overlay over non-focal screenshot regions at 20–45% opacity while
keeping the selected area clear. Do not alter the selected UI.

### Spotlight

Use a soft mask or vignette with one clear opening around the feature. Avoid
hard theatrical spotlights.

### Highlight rules

- One primary highlight method per frame.
- One focal feature per frame.
- An annotation never changes the source screenshot.
- Focus color follows meaning: cyan = information/action, green = success,
  amber = attention, red = risk/error.

---

## 11. Brand Elements

### LegalHub logo

Official logo colors:

- navy `#08264A`;
- cyan `#06B6D4`;
- amber `#F2A100`;
- white in the dark-logo variant.

Use:

- full wordmark on end cards, CTA slides, and spacious feed covers;
- simplified mark for a small corner signature or avatar-like placement;
- light logo on white/light backgrounds;
- dark-background logo variant on navy/slate backgrounds.

Do not:

- recolor the logo;
- stretch, rotate, outline, bevel, or add a heavy glow;
- place it on a busy screenshot;
- rebuild the wordmark in another font;
- use it larger than the message unless the visual is a brand card.

Minimum working size:

- full wordmark: approximately 160–220 px wide on a 1080 px canvas;
- mark: approximately 48–72 px;
- preserve clear space roughly equal to the mark’s central circle.

### Product name

Write exactly:

```text
LegalHub CRM
```

Use the product name once per visual unless repetition is part of a deliberate
end card.

### Small UI fragments

Use real UI chips, badges, cards, arrows, or table fragments as supporting
evidence. Do not recreate them approximately when a screenshot exists.

### Grid and line elements

- Thin 1–2 px lines.
- Cyan or neutral gray at 10–25% opacity.
- Use for workflow, alignment, or dashboard rhythm.
- Avoid decorative circuit boards and random network meshes.

### Gradients

Use only the restrained gradients defined in the color section. Most layouts
should work with flat color and surface contrast.

### Icons

- Prefer the simple outline style used in the sidebar.
- Use consistent 2 px strokes and rounded line caps.
- Use familiar operational symbols: task, calendar, document, user, payment,
  status, dashboard.
- Use one icon family per asset.
- Avoid random 3D icons, glossy emoji packs, clay renders, and provider logos.

---

## 12. Do / Don’t

1. **Do** use the real CRM palette. **Don’t** invent a fashionable new palette.
2. **Do** use approved screenshots with fake demo data. **Don’t** use real data,
   even if blurred.
3. **Do** show one UI fragment large. **Don’t** shrink the whole desktop screen
   until it is unreadable.
4. **Do** preserve screenshot content exactly. **Don’t** change names, values,
   buttons, labels, columns, statuses, or dates inside the screenshot.
5. **Do** place Instagram copy outside the UI. **Don’t** rewrite text inside the
   product screenshot.
6. **Do** use one visual idea. **Don’t** combine several unrelated benefits.
7. **Do** use short Ukrainian headlines. **Don’t** fill the canvas with a
   paragraph.
8. **Do** use clean B2B compositions. **Don’t** use a cheap marketing-template
   look.
9. **Do** use real operational context. **Don’t** use generic corporate stock
   photos of smiling office teams.
10. **Do** use simple outline icons. **Don’t** use random 3D illustrations.
11. **Do** use cyan as the action/focus color. **Don’t** use excessive
    gradients.
12. **Do** use amber/red only semantically. **Don’t** manufacture urgency with
    red decorations.
13. **Do** preserve whitespace. **Don’t** create visual clutter.
14. **Do** use one or two annotation devices. **Don’t** surround a feature with
    multiple arrows, circles, glows, and stickers.
15. **Do** keep the screenshot sharp. **Don’t** apply blur to the focal UI.
16. **Do** use real product modules. **Don’t** create fake UI or imagined
    features.
17. **Do** use browser/device frames only when helpful. **Don’t** let a laptop
    mockup make the product illegible.
18. **Do** keep status colors tied to meaning. **Don’t** use rainbow color for
    decoration.
19. **Do** use one approved CTA. **Don’t** add multiple competing actions.
20. **Do** use `LegalHub CRM` exactly. **Don’t** rename, abbreviate, or restyle
    the product name inconsistently.
21. **Do** keep logo proportions and colors. **Don’t** redraw or recolor it.
22. **Do** use Inter/Segoe UI/system sans. **Don’t** use decorative serif,
    script, condensed, or tech-display fonts.
23. **Do** preview every asset at phone size. **Don’t** approve only from a
    desktop canvas.
24. **Do** keep Reel-cover text in a conservative center zone. **Don’t** rely on
    edge placement that can be cropped.
25. **Do** separate pain and solution visually. **Don’t** shame teams for using
    Excel or WhatsApp.
26. **Do** show confirmed functions only. **Don’t** imply AI/OCR, e-signature,
    government integration, client portal, automatic billing, or unsupported
    automation.
27. **Do** use cautious product wording. **Don’t** promise guaranteed outcomes,
    legal results, security, or GDPR compliance.
28. **Do** use the approved launch CTA. **Don’t** publish pricing, VAT, trial,
    billing, plan, or limit claims without separate approval.
29. **Do** use provider-neutral workflow visuals. **Don’t** add integration
    logos or claims without approval.
30. **Do** send screenshot-based launch assets to Valentyn. **Don’t** publish
    unapproved screens, recordings, captions, covers, or Stories.

---

## 13. Image Generation Rules

### When a CRM screenshot is attached

Treat the screenshot as the source of truth.

The image model must:

- preserve the screenshot’s UI exactly;
- preserve all visible data, labels, values, controls, colors, spacing, and
  hierarchy exactly;
- avoid redrawing, regenerating, “improving,” translating, or restyling the UI;
- use only crop, scale, position, mild perspective, rounded outer crop, shadow,
  background treatment, and external highlight/annotation;
- place Instagram headline, supporting copy, and CTA outside the UI;
- produce a premium B2B SaaS campaign, not a concept interface.

The image model must not:

- change any data or UI element;
- invent missing UI beyond the screenshot;
- replace the CRM with an approximate dashboard;
- alter screenshot language;
- add a fake browser URL or mobile app;
- place generated text over dense UI;
- expose or infer private data;
- add unconfirmed features or provider logos.

### Preferred production workflow

For maximum screenshot accuracy:

1. Use ChatGPT Image Generation to create the background, lighting, supporting
   shapes, and composition concept.
2. Keep a clear reserved area for the screenshot.
3. Place the original screenshot as a locked layer in Canva or another layout
   tool.
4. Add final Ukrainian text in Canva/CapCut for spelling accuracy.
5. Add highlights as separate non-destructive layers.

This is preferred because generative editing can unintentionally mutate small
UI text. If the model cannot preserve the screenshot pixel-for-pixel, generate
the background/layout only and composite the original screenshot afterward.

### Prompt requirements

Every image-generation request should specify:

- format and dimensions;
- one content objective;
- exact headline/CTA or a request to leave text space;
- light or dark LegalHub background;
- the exact screenshot fragment to feature;
- preservation rule for attached UI;
- one highlight method;
- safe zone;
- “premium B2B SaaS, operational, clean, restrained”;
- exclusions: stock photos, random 3D, fake UI, excessive gradients, clutter.

### Output QA

- Compare the output against the source screenshot at 100% zoom.
- Reject any changed label, value, icon, row, field, or button.
- Verify Ukrainian spelling manually.
- Verify the focal UI at phone size.
- Verify that no real/private data is present.
- Verify that the copy makes only approved claims.

---

## 14. Master Design Prompt

Copy the following into a dedicated ChatGPT Visual Designer chat as the
permanent instruction:

```text
You are the permanent Visual Designer for LegalHub CRM Instagram content.

BRAND
LegalHub CRM is a specialized CRM and case-management workspace for companies
and consultants that help foreigners with legalization processes in Poland.
The visual identity is structured, operational, calm, precise, credible,
focused, and premium B2B SaaS. It must never look like a generic corporate ad,
a legal-advice account, a cheap social-media template, or futuristic AI art.

AUDIENCE AND LANGUAGE
Create for legalization companies, migration agencies, consultants, owners,
and operations teams in Poland. The current primary content language is
Ukrainian. Russian may be used later only when explicitly requested. The tone
is clear, practical, direct, expert, B2B, problem-aware, and without hype.

APPROVED PUBLIC FRAMING
Use only this safe product framing unless the user supplies another approved
brief:
“LegalHub CRM — CRM для компаній по легалізації в Польщі. Допомагає вести
заявки, клієнтів, справи, документи, строки, оплати й команду в одній системі.”
Do not invent functions, proof, customer metrics, testimonials, prices,
guarantees, legal claims, security/GDPR claims, or integrations.

APPROVED CTA
Primary: “Спробувати безкоштовно”
Fallback: “Напишіть “DEMO” в Direct, щоб отримати доступ”
Diagnostic: “Отримати безкоштовний аудит процесів”
Use one CTA per visual.

VISUAL SYSTEM
Use the real LegalHub palette:
- primary cyan #06B6D4;
- deeper cyan #0891B2;
- logo navy #08264A;
- sidebar navy #08111F;
- background #F4F5F7 or #F8FAFC;
- surface #FFFFFF;
- border #E5E7EB;
- main text #111827 or deep headline #0F172A;
- muted text #6B7280 or #64748B;
- success #16A34A with #DCFCE7;
- warning #F59E0B with #FEF3C7;
- error #DC2626 with #FEF2F2;
- logo amber #F2A100 as a small accent only.

Use Inter as the production typeface, with Segoe UI/system sans as fallback.
Headlines are bold, compact, usually 2–7 words on covers. Use one typeface and
no more than three weights. Keep most layouts left-aligned.

DESIGN LANGUAGE
Echo the real CRM: deep navy navigation, light workspace, white modular cards,
thin borders, subtle shadows, cyan active states, compact semantic badges,
clear KPI hierarchy, tables, task cards, dates, and structured spacing.
Use generous whitespace around the chosen focal feature. Use one main idea per
visual and one dominant accent.

SCREENSHOT SOURCE-OF-TRUTH RULE
When the user attaches a LegalHub CRM screenshot, it is the absolute source of
truth. Preserve the UI pixel-for-pixel. Never redraw, regenerate, translate,
restyle, simplify, improve, or change the screenshot. Never change any label,
value, name, date, icon, row, field, status, button, color, or UI element.
Never invent UI beyond the attached screenshot. The only allowed treatments
are crop, zoom, scale, position, mild 2–4 degree perspective, outer rounded
corners, shadow, background treatment, external glow/outline, arrows, and
annotations. Instagram text must be outside the UI.

Never shrink a full desktop screenshot to an unreadable size. Select one
important UI fragment and show it large. The focal screenshot remains sharp.
Use only approved fake demo data. Never use real personal, document, payment,
credential, token, API, OAuth, .env, or technical-admin data.

If generative editing cannot preserve small UI text exactly, create only the
background and composition with a reserved screenshot area. The original
screenshot will be composited as a locked layer in Canva. Prefer this workflow
over an approximate regenerated interface.

FORMATS AND SAFE ZONES
- Story/Reel: 1080x1920. Keep essential content inside x 90–990 and y 250–1600.
- Reel cover: keep the 2–7 word headline around x 100–980 and y 500–1400 so it
  survives small grid preview and center crops.
- Feed/Carousel: 1080x1350. Keep at least 72 px horizontal and 96 px vertical
  margins.
- Square: 1080x1080. Keep at least 72 px margins.
Always preview inside Instagram before publishing because UI crops can change.

HIGHLIGHTS
Use one primary focus method per frame: 120–220% zoom, 2–4 px cyan outline,
soft cyan glow, one arrow, one magnified fragment, or darkened surrounding UI.
Cyan means information/action, green success, amber attention, and red only a
real risk/error.

FORBIDDEN
No generic corporate stock photos. No random 3D illustrations. No glossy
emoji packs. No excessive gradients. No neon rainbow or purple AI aesthetic.
No fake UI. No changed screenshot content. No tiny unreadable screenshots.
No excessive text. No visual clutter. No multiple competing CTAs. No provider
logos or unconfirmed integrations. No prices, VAT, trial, billing, plan, or
limit claims unless supplied as separately approved copy. No AI/OCR,
e-signature, government integration, automatic billing, client portal, or
other unconfirmed features. No guaranteed legal outcomes, legal advice,
security guarantees, or GDPR guarantees.

WORKING METHOD
Before designing, identify:
1. the one main thought;
2. the format;
3. the exact approved copy;
4. the one screenshot fragment or visual cue;
5. the one focus treatment;
6. the one CTA.

For every result, provide:
- the proposed composition;
- exact text placement;
- screenshot crop/placement;
- safe-zone notes;
- Canva/CapCut implementation notes when relevant;
- a short QA checklist.

The result must look like a premium, restrained, product-led B2B SaaS campaign
built from the real LegalHub CRM interface.
```

---

## 15. Example Requests

These examples can be sent to a Visual Designer chat together with an approved
screenshot when required.

1. `Створи Story 1080×1920 з питанням “Хто відповідає за цю справу?” На світлому фоні, без скриншота, з місцем для poll sticker.`
2. `Зроби Product Feature Story про наступний контакт. Використай прикріплений фрагмент ліда без змін, збільш його й додай один cyan outline.`
3. `Створи Reel cover 1080×1920 з текстом “Рядок — це ще не справа”. Заголовок має читатися в Instagram grid preview.`
4. `Підготуй feed post 1080×1350 про контроль строків. Один headline, один великий фрагмент календаря, CTA “Спробувати безкоштовно”.`
5. `Зроби карусель із 6 слайдів: “Що має бути в активній справі”. Один пункт на слайд, без непідтверджених функцій.`
6. `Створи Before/After Story: до — рядок Excel, після — прикріплений case record. Не змінюй CRM screenshot і не обіцяй автоматичний перехід.`
7. `Зроби feature highlight для поля “відповідальний”: один zoom, одна стрілка, короткий callout, текст поза UI.`
8. `Створи темну owner-focused Reel cover з текстом “Власник бачить процес” і одним великим dashboard KPI fragment.`
9. `Підготуй Quick Tip Story: “Перевірте одну активну справу” + три пункти: відповідальний, наступна задача, важлива дата.`
10. `Зроби CTA Story з прикріпленим dashboard fragment, headline “Покажемо ваш робочий процес” і CTA “Напишіть “DEMO” в Direct”.`
11. `Створи educational square post “Статус — це ще не контекст” з одним case-status badge і короткою supporting line.`
12. `Підготуй CapCut layout для 20-секундного Reel: full-screen context -> zoom на documents block -> callout -> CTA end card.`
13. `Створи Story про оплату: використай тільки fake demo data, покажи один debt/payment fragment, червоний лише для реального unpaid state.`
14. `Зроби cover і фінальний слайд для каруселі про заявки без наступного контакту. Один CTA: “Спробувати безкоштовно”.`
15. `Згенеруй тільки premium LegalHub background для Story: #F8FAFC, subtle cyan glow, зарезервуй 760×900 px для оригінального CRM screenshot і не генеруй UI.`

---

## Final Production Checklist

- One visual has one main thought.
- Format and safe zones are correct.
- Ukrainian copy is manually proofread.
- Headline is readable at phone/grid size.
- Colors match the real LegalHub UI/logo.
- Screenshot uses approved fake demo data only.
- The original screenshot content is unchanged.
- One focal UI fragment is large and sharp.
- Instagram text is separate from UI.
- One highlight method and one CTA are used.
- No public price, plan, integration, legal, security, or unsupported feature
  claim appears.
- Logo is the official asset with correct color and proportions.
- Final asset is previewed in Instagram.
- Screenshot-based launch content is approved by Valentyn.
