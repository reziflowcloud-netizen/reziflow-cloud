# LegalHub CRM — Mobile UX Implementation Specification

Status: Development handoff derived from approved mobile mockups  
Last updated: 2026-09-15  
Primary target viewport: 390–430 px

## 1. Purpose and scope

This document converts the approved LegalHub CRM mobile mockups into an
implementation specification for Development. It defines presentation and
interaction rules only. It does not introduce new product functionality.

The desktop LegalHub CRM remains visually unchanged. The mobile experience is
a separate responsive presentation layer over the existing business logic,
data, routes, permissions, APIs, CRUD operations, side effects, and
authentication.

On mobile, do not scale down desktop tables, matrices, Kanban boards, or dense
multi-column forms. Present the same data and actions through mobile-specific
cards, vertical lists, compact segmented controls, horizontally scrollable
chip rails, accordions, and bottom sheets.

### Source-of-truth order

1. The eleven approved mobile mockups and the decisions recorded in this
   specification define mobile presentation.
2. The current application defines business logic, data availability,
   permissions, validation, side effects, and route behavior.
3. [VISUAL_BRAND_GUIDE.md](./VISUAL_BRAND_GUIDE.md) defines LegalHub visual
   tokens and brand guardrails.
4. Existing desktop pages define available data and functions, but are not
   mobile layout references.

If a field, action, status, priority, stage, or entity is not present in the
current product, do not add it to mobile. If approved mobile presentation and
current implementation appear to conflict, preserve business logic and raise
the presentation mismatch before implementing a new behavior.

### Responsive boundary

Use the project's existing mobile boundary:

- mobile presentation: viewport width `<= 768px`;
- existing desktop/tablet presentation: viewport width `>= 769px`;
- primary visual QA widths: 390 px, 414 px, and 430 px.

The `768px` boundary is already used by the shared styles, page-specific media
queries, `MobileNav`, and Tasks mobile detection. Do not change the desktop
layout above this boundary as part of the mobile implementation.

## 2. Master visual system

The approved mobile screens use the existing LegalHub Slate/Cyan theme. Do not
create a separate mobile brand system.

### Color tokens

| Role | Token/value | Usage |
| --- | --- | --- |
| Page background | `#07111D` / existing slate gradient | Main mobile canvas |
| Navigation background | `#030B14` / `--sidebar-bg` | Fixed bottom navigation |
| Card/sheet surface | `#0F1B2D` / `--surface` | Cards, accordions, bottom sheets |
| Input surface | `#081625` / `--input-bg` | Search, selects, compact fields |
| Primary cyan | `#06B6D4` / `--brand` | Primary actions and active states |
| Cyan hover/deep | `#0891B2` / `--brand-hover` | Pressed/hover support |
| Active light cyan | `#67E8F9` | Active labels on dark surfaces |
| Main text | `#E0F2FE` and white | Titles and primary values |
| Muted text | `#9FC3D2` / `--muted` | Secondary labels and metadata |
| Border | `#28536A` / `--border` | Cards, inputs, dividers |
| Success | `#16A34A` | Paid, valid, completed states |
| Warning | `#F59E0B` | Attention, burning priority, near deadline |
| Error | `#DC2626` | Overdue, debt, destructive/risk states |
| Informational blue | `#2563EB` | Informational statuses |
| Violet | `#7C3AED` | Existing configured category/reminder accents |

Semantic colors communicate state only. Red must not be used as a decorative
CTA color or broad glow. Use tinted backgrounds and thin borders for badges;
reserve strong color for the icon, label, value, or a narrow card edge.

### Geometry and spacing

- Base spacing rhythm: 8 px.
- Page horizontal padding: 16 px.
- Typical vertical gap: 8–12 px; major section gap: 16–20 px.
- Card padding: 14–16 px.
- Mobile card radius: 12–14 px.
- Input/button radius: 8–10 px.
- Badge/chip radius: pill/fully rounded.
- Bottom-sheet top radius: approximately 24 px.
- Borders: 1 px; use stronger borders only for active or warning states.
- Use restrained existing Slate shadows; do not introduce glassmorphism or
  neon effects.

### Typography

Use the existing product stack, with Inter as the preferred design match:

```text
Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
```

Recommended hierarchy derived from the approved mockups:

| Role | Size | Weight | Notes |
| --- | ---: | ---: | --- |
| Screen title | 24–28 px | 700–800 | Compact, left aligned |
| Section title | 18–22 px | 700–800 | One clear level below screen title |
| Card/entity title | 16–18 px | 700 | Prefer one line; allow two when necessary |
| Body/value | 14–16 px | 500–700 | Primary mobile reading size |
| Metadata/label | 12–14 px | 500–600 | Never shrink to fit desktop density |
| Bottom-nav label | 10–12 px | 600 | One line, stable labels |

### Icons and controls

- Use one consistent outline icon family with approximately 2 px strokes.
- Standard icons: 20–24 px; bottom-navigation icon box: approximately 28–30 px.
- Icon tiles may use the existing 44 × 44 px treatment.
- Minimum interactive target: 44 × 44 CSS px, including icon-only controls.
- Primary buttons use cyan fill and white text; secondary buttons use dark
  surfaces, neutral/cyan borders, and light text.
- Status, priority, and temperature use compact semantic pills.

### Safe areas

- Respect `env(safe-area-inset-top)` where the webview/browser layout exposes
  a top inset.
- Fixed bottom navigation includes `env(safe-area-inset-bottom)`.
- Every scroll container must have bottom padding equal to the complete bottom
  navigation height plus the bottom safe-area inset and at least 12 px of
  breathing room.
- Bottom sheets end above, or explicitly account for, the fixed navigation and
  the bottom safe area according to the approved pattern.

## 3. Shared mobile shell

The mobile shell is shared by all authenticated CRM screens at `<= 768px`.

### Compact page header

- Keep the title and optional one-line context/statistic compact.
- Place the primary action in the header or immediately below it without
  turning the header into a desktop toolbar.
- Move secondary actions into an overflow menu when the approved screen shows
  this pattern.
- Detail screens may use a back affordance and identity/contact summary.
- The fixed bottom navigation is the only global navigation visible on mobile;
  the desktop sidebar is hidden.

### Reusable presentation components

Development should prefer shared presentation components for:

- mobile shell and compact header;
- fixed bottom navigation;
- More bottom sheet;
- horizontal chip/tab rail;
- compact search and filter row;
- summary/KPI card;
- entity card and nested case row;
- status/priority/temperature badge;
- accordion section;
- bulk-selection bar;
- task/agenda card;
- loading, empty, saving, and error wrappers using existing product behavior.

These components may share data adapters with desktop components. They must not
duplicate API calls, permission checks, mutation rules, or domain logic.

## 4. Global bottom navigation

The bottom navigation is fixed and identical on every approved mobile screen.
Its order never changes:

1. `Пульт` → `/dashboard`
2. `Ліди` → `/leads`
3. `Справи` → `/cases`
4. `Клієнти` → `/clients`
5. `Ще` → opens the More bottom sheet

### Active-state mapping

| Current section | Active bottom-nav item |
| --- | --- |
| Dashboard | `Пульт` |
| Leads and Lead Detail | `Ліди` |
| Cases and Case Detail | `Справи` |
| Clients and Client Detail | `Клієнти` |
| Tasks | `Ще` |
| Stages | `Ще` |
| Calendar | `Ще` |
| Settings | `Ще` |

### Behavior and layout

- Fixed to the bottom edge and visible across the authenticated mobile shell.
- Five equal-width items; no horizontal scrolling and no alternative item set.
- Current item uses cyan icon/text and the approved thin cyan top indicator.
- Account for the iPhone bottom safe area.
- Use the current effective mobile navigation height of approximately 72 px,
  plus `env(safe-area-inset-bottom)`.
- Content must never be hidden behind the navigation.
- Opening `Ще` does not replace the five main items.

## 5. More bottom sheet

`Ще` is not a standalone page. The previously drafted standalone More page is
superseded and is not an implementation reference.

Tapping `Ще` opens a modal bottom sheet over the current page. The underlying
page remains mounted, keeps its scroll position and state, and receives a dark
backdrop. The fixed five-item bottom navigation remains visible and unchanged,
with `Ще` active.

### Sheet content

Header:

- title `Ще`;
- close control `×`.

Approved 2 × 2 navigation tiles:

- `Завдання`;
- `Етапи`;
- `Календар`;
- `Налаштування`.

Below a divider:

- current user;
- role and organization;
- secondary `Вийти` action.

Logout must not look like a primary navigation tile.

### Sheet behavior

- Approximate height: 60–70% of the mobile viewport.
- Close through `×`, swipe down, or tap on the backdrop.
- Opening and closing the sheet must not reset the underlying page.
- When opened from Tasks, Stages, Calendar, or Settings, highlight that current
  destination inside the sheet.
- `Налаштування` and any other permission-controlled destination are hidden
  when unavailable; remaining tiles reflow without empty disabled slots.

## 6. Permission-dependent presentation

Mobile uses the existing permission model. Do not implement a separate mobile
role model and do not infer access from presentation alone.

Important domain distinction: the login `User` controls access, while the
business `Employee` represents an operational responsible person. Do not merge
these concepts in mobile components.

### Full access: Admin / Owner / permitted user

- Show `Відповідальний` on Lead and Case cards/details where approved and where
  the product exposes it.
- Show the responsible field on Client list cards only where it is relevant and
  permitted.
- Show permitted reassignment actions:
  `Призначити відповідального`, `Зняти відповідального`, and
  `Змінити статус`.
- Show shared organization data and Settings destinations allowed by existing
  permissions.

### Restricted employee / own records only

- Existing API scope continues to limit Leads, Cases, Tasks, and related
  Clients to accessible records.
- Hide `Відповідальний` in Lead and Case cards/details when every visible record
  already belongs to the current employee.
- Hide assign/unassign actions when reassignment is not permitted.
- Keep `Змінити статус` only when the existing permission allows it.
- Hide inaccessible navigation, settings, and administrative actions instead
  of rendering disabled placeholders.
- Close layout gaps after conditional fields/actions are removed.

### Client Detail exception

Client Detail has no approved Client-level `Відповідальний` field. Do not add
one for any role. The permission rule does not override this entity-specific
constraint.

There is one mobile visual system for all roles. Permission differences alter
content and actions, not colors, geometry, navigation, or component language.

## 7. Dashboard

Route: `/dashboard`  
Active bottom-nav item: `Пульт`

Approved mobile composition:

1. Compact header and greeting.
2. KPI cards in a two-column grid.
3. Compact mobile `Динаміка` block for recent Cases/Clients trends.
4. Vertical `Майбутні події` list.
5. `Останні справи` below the events.
6. Fixed bottom navigation.

Requirements:

- Preserve current KPI definitions and source data.
- Keep positive amounts green and debt/risk values red.
- Charts must be purpose-built for the mobile card; do not horizontally pan a
  desktop chart grid.
- Events are vertical, readable rows with date urgency and linked entity
  context.
- Do not reproduce the desktop three-column dashboard layout on mobile.

## 8. Leads list

Route: `/leads`  
Active bottom-nav item: `Ліди`

### Structure

1. Compact `Ліди` header with total/active counts.
2. Primary `+ Додати лід` action and compact `Вибрати` command.
3. Horizontally scrollable quick/status filter rail.
4. Large search field: name, phone, Instagram, and existing searchable data.
5. Compact `Фільтри` button; the approved mockup shows its closed state and
   anticipates the existing filters in a bottom sheet.
6. Vertical Lead cards.

Preserve access to the existing filters:

- `Усі`;
- `Сьогодні`;
- `Прострочені`;
- `Без відповідального`;
- `Без наступного контакту`;
- configured lead temperature;
- configured lead statuses.

Status and filter counts are dynamic. The rail remains one line and scrolls
horizontally when it does not fit.

### Lead card

Show only the approved scan-critical information:

- name/title;
- phone or contact source;
- status;
- source;
- interest/service;
- next contact;
- temperature;
- responsible employee when permitted.

An overdue next contact uses a restrained warning treatment. The whole card is
tappable and opens the existing Lead Detail. Do not show the desktop table or
all desktop columns.

### Bulk selection

Normal mode has no permanent checkboxes. After `Вибрати`:

- reveal checkboxes;
- allow multiple Lead selection;
- show a compact bar with selected count, `Дії`, and `Скасувати`;
- expose only permitted existing actions:
  `Призначити відповідального`, `Змінити статус`,
  `Зняти відповідального`.

Exiting selection mode removes checkboxes and the bulk bar.

## 9. Cases list

Route: `/cases`  
Active bottom-nav item: `Справи`

### Structure

- Compact header and existing primary create action.
- Configured status chips in a one-line horizontal rail.
- Search/filter controls remain compact.
- Cases render as a vertical card list, not a desktop table.

### Case card

Show the approved useful subset:

- Client;
- phone;
- service or services;
- status;
- responsible employee when permitted;
- value;
- paid/debt state;
- creation date when useful.

The card opens Case Detail. Financial state uses existing values and semantic
colors. Do not add a new payment state.

Bulk selection follows the same temporary selection-mode pattern as Leads and
shows only existing permitted actions.

## 10. Clients list

Route: `/clients`  
Active bottom-nav item: `Клієнти`

Render Clients as vertical cards rather than a desktop table.

Each card may show:

- Client name;
- phone;
- responsible employee only when relevant and permitted;
- number of Cases;
- one or two important active Cases;
- additional Cases collapsed as `+N` / `Ще N справ`.

Client identity opens Client Detail. Nested Case rows open the corresponding
Case Detail. Do not flatten several Cases into one unreadable line.

## 11. Lead Detail

Route: `/leads/[id]`  
Active bottom-nav item: `Ліди`

### Detail pattern

```text
Header → P0 summary → section tabs → selected section → bottom navigation
```

Tabs are based only on current Lead functionality:

- `Огляд`;
- `Контакти`;
- `Діалог`;
- `Кваліфікація`;
- `Нагадування`.

If the tab rail does not fit, it remains one line and scrolls horizontally.

### Overview priorities

- status;
- source;
- service interest;
- temperature;
- last contact;
- next contact;
- responsible employee when permitted;
- quick actions.

Approved quick actions reuse current behavior:

- `Звонив`;
- `Написав`;
- `Нема відповіді`;
- quick note;
- schedule next contact.

Do not add Documents, Payments, or a visible Lead History section that does not
exist in the current product.

## 12. Case Detail

Route: `/cases/[id]`  
Active bottom-nav item: `Справи`

### Master detail pattern

```text
Header → summary → real tabs → accordion sections → bottom navigation
```

Approved tabs:

- `Деталі`;
- `Оплати`;
- `Коментарі`;
- `Документи`.

The tab rail stays on one line and may scroll horizontally.

### Summary

Prioritize:

- Case identity/number;
- Client;
- status;
- service;
- responsible employee when permitted;
- value;
- paid;
- debt;
- nearest important date.

### Details tab

- Use collapsible accordion sections rather than one long desktop form.
- Important dates and tasks have high visual priority.
- Contracts, MOS, custom dates, notes, custom fields, and other secondary
  sections sit lower in the hierarchy.
- Respect organization-hidden standard sections.
- Render dynamic custom sections from current configuration; do not hardcode
  their number or names.
- Preserve all existing validation, save behavior, side effects, document
  operations, payments, comments, and status history.

## 13. Client Detail

Route: `/clients/[id]`  
Active bottom-nav item: `Клієнти`

### Structure

1. Compact back/header identity with Client contact.
2. Primary `Зберегти` and `Нова справа` actions.
3. P0 summary.
4. Active Cases close to the top.
5. Accordion sections.
6. Fixed bottom navigation.

### Summary

Prioritize:

- PESEL;
- citizenship;
- passport validity;
- Poland stay/rental context;
- active Case count.

Passport state must use the existing computed result: valid, less than 90 days,
or expired. Rental end receives restrained attention because the product links
it to deadline/task behavior.

### Active and closed Cases

- Active Cases appear near the top as compact, tappable Case rows.
- Each row shows Case/service and current status and opens Case Detail.
- `Нова справа` remains easy to reach.
- Existing closed Cases may appear as collapsed `Закриті справи · N`.

### Approved accordion groups

- personal data;
- passport;
- stay in Poland;
- family;
- addresses;
- secondary/custom data;
- closed Cases.

Deeper secondary content includes existing physical traits, travel history,
previous stays, metadata, and the admin/owner danger zone.

Do not add Client-level Documents, Payments, Tasks, Comments, History, or
Responsible Employee. Delete stays deep in the existing admin/owner danger
zone and must not sit beside Save.

## 14. Tasks

Route: `/tasks`  
Active bottom-nav item: `Ще`

Do not render multiple Kanban columns on mobile.

### Structure

1. Compact header with total and `+ Нове завдання`.
2. Mode switch: `Усі завдання` / `За клієнтом`.
3. Dynamic priority/section chip rail.
4. Vertical list for the selected priority.
5. Fixed bottom navigation.

When `За клієнтом` is selected, show the compact existing Client search/select.
Do not reserve that field in `Усі завдання` mode.

### Dynamic priorities

- Priorities come from organization configuration.
- Never hardcode three categories.
- Use one horizontal swipe rail when items do not fit.
- Active priority is visually clear and each priority may show its count badge.
- Never wrap the rail to two lines or shrink its labels to unreadable text.

### Task card

Show:

- task title;
- Client/Case link when present;
- responsible employee when permitted;
- due date/time;
- short note when present;
- configured priority;
- existing status, if present.

Use restrained semantic labels for `Прострочено`, `Сьогодні`, and `Завтра`.
The whole card opens the current Task/edit flow.

Desktop drag between Kanban columns is not used on mobile. The approved mobile
equivalent is the card overflow action → `Змінити пріоритет` → existing
configured priority list in a mobile menu/bottom sheet. This changes the same
field through the same mutation as desktop; it is not new business logic.

## 15. Stages

Route: `/stages`  
Active bottom-nav item: `Ще`

Do not render or horizontally pan the desktop Client × status matrix.

### Structure

1. Compact header with current Client/status counts.
2. Dynamic one-line stage selector.
3. `Пошук за ім’ям або телефоном...`.
4. Vertical Client/Case list for the selected stage.
5. Fixed bottom navigation.

### Dynamic stages

- Stage/status names and counts come from organization configuration.
- The selector scrolls horizontally when it does not fit.
- Active stage is cyan and count badges remain visible.
- Never wrap, shrink, or hardcode the stage list.

### Client and Case presentation

- Client identity is separately tappable and opens Client Detail.
- Each Case row is separately tappable and opens Case Detail.
- Show existing service and financial paid/value context.
- Multiple Cases use separate compact rows; do not concatenate them.
- A secondary Case on another stage may remain visible as context when shown in
  the approved card pattern, but the selected-stage Case remains primary.

The current Stages page is overview-only. Do not add direct status editing
until that behavior exists in the product and is separately approved.

## 16. Calendar

Route: `/calendar`  
Active bottom-nav item: `Ще`

### Structure

1. Compact header with `+ Нове завдання`.
2. `Місяць` / `Список` segmented control.
3. Compact month navigation.
4. Compact Client filter (`Клієнт: Усі`).
5. Dynamic one-line priority legend.
6. Compact month grid with dots/counters.
7. Agenda for the selected day.
8. Fixed bottom navigation.

The same Calendar data drives both views. The approved mockup shows `Місяць`;
`Список` is the alternate presentation of current data, not a new entity.

### Month grid

- Keep dates readable and the seven-column grid fully within the viewport.
- Distinguish selected date from today.
- Represent events with semantic dots or compact counts.
- Never write long task names inside date cells.
- The calendar itself does not horizontally scroll.

### Priority legend

- Priorities come from organization configuration.
- Use the same semantic colors as Tasks.
- Keep a single horizontal swipe rail when the legend does not fit.
- Do not hardcode the number of priority categories.

### Selected-day agenda

Place the selected date and event count directly below the grid. Each compact
event card shows the existing applicable subset:

- title;
- time;
- Client/Case or location context;
- responsible employee when permitted;
- priority;
- overdue/today state when applicable.

Tapping an event opens the existing Task or linked entity according to current
behavior. Do not introduce a separate Calendar Event Detail.

## 17. Shared responsive and interaction rules

### Vertical flow

- Primary content scrolls vertically.
- Tables, desktop grids, Kanban columns, and matrices become purpose-built
  cards/lists on mobile.
- No primary page-level horizontal scrolling.
- Horizontal scrolling is reserved for one-line tabs, status chips, priority
  rails, stage rails, or legends whose item count is dynamic.

### Dynamic rails

- Values and counts come from organization configuration/data.
- Keep labels readable and on one line.
- Active item must remain visually clear.
- Preserve a visible partial next item or equivalent edge cue when useful.
- Do not add a second row and do not reduce type to fit.

### Text and density

- Do not reproduce microscopic desktop metadata.
- Prefer 3–5 useful cards/rows per standard viewport where the approved screen
  allows it.
- Critical names, dates, amounts, statuses, and action labels must remain
  readable.
- Use ellipsis only for noncritical secondary strings where the full value is
  available after opening the entity. Allow safe wrapping for primary titles.
- Use one- or two-line clamps for optional notes; never hide a critical warning
  solely through truncation.

### Sheets, modals, and accordions

- Sheets and modals respect top/bottom safe areas and the fixed navigation.
- A backdrop prevents accidental interaction with the covered page.
- Accordions keep their expanded/collapsed state through ordinary edits,
  validation errors, and saving whenever the current page remains mounted.
- Do not collapse a section automatically after a failed save.

### Loading, saving, empty, and error behavior

- Reuse current product behavior, validation, messages, and mutation results.
- Mobile presentation may change placement and sizing, but not the meaning or
  lifecycle of these states.
- Avoid duplicate submissions by reflecting the existing in-progress state on
  the triggering action.
- Empty states remain concise and use only existing available actions.

## 18. Development safety and architecture

### Non-negotiable constraints

- Desktop UI at `>= 769px` remains visually unchanged.
- Do not rewrite business logic merely to support mobile presentation.
- Reuse existing APIs, authentication, organization scoping, permissions,
  statuses, priorities, Employees, filters, CRUD, validation, side effects,
  automation, and linked-entity behavior.
- Do not create duplicate mobile API endpoints or duplicate domain mutations.
- Do not hardcode organization-configurable statuses, priorities, stages,
  services, custom sections, or custom fields.

### Preferred component boundary

Where the desktop structure cannot adapt cleanly, render a desktop presentation
component and a mobile presentation component over the same loaded data and
service/mutation layer. Keep filtering, sorting, permission decisions, counts,
and mutation handlers outside the presentation split whenever possible.

Prefer CSS media behavior for pure layout changes. Use the existing `<= 768px`
viewport logic only when rendering or interaction genuinely differs, and keep
its breakpoint consistent across pages.

### Regression safety

For every phase:

- compare desktop at 769 px, 1024 px, and a standard wide viewport before and
  after the change;
- test mobile at 390 px, 414 px, and 430 px;
- test iPhone bottom safe area and content clearance above fixed navigation;
- test long Ukrainian, Polish, and Russian labels already supported by the
  product;
- test Admin/Owner and restricted employee states;
- verify current API requests, mutations, redirects, and side effects remain
  unchanged.

## 19. Implementation order

### Phase A — shared mobile foundation

- Mobile shell and compact page header.
- Fixed five-item bottom navigation.
- More bottom sheet.
- Shared cards, badges, chip rails, accordions, search/filter rows, and bulk
  selection presentation.

Manual phone QA and desktop regression check are required before Phase B.

### Phase B — primary list and overview screens

- Dashboard.
- Leads list.
- Cases list.
- Clients list.

Manual phone QA and desktop regression check are required before Phase C.

### Phase C — detail screens

- Lead Detail.
- Case Detail.
- Client Detail.

Manual phone QA and desktop regression check are required before Phase D.

### Phase D — secondary operational screens

- Tasks.
- Stages.
- Calendar.

Complete final cross-screen phone QA, permission QA, and desktop regression
verification after Phase D.

## 20. Mockup map

The labels below identify the approved conversation artifacts. They are the
visual references; this document defines their implementation constraints.

| Screen | Approved mockup | Key mobile pattern | Desktop behavior preserved | Permission notes |
| --- | --- | --- | --- | --- |
| Dashboard | Master 01 — Mobile Dashboard | Two-column KPIs, compact dynamics, vertical events/recent Cases | KPI calculations, reports, event and recent-Case data | Data remains scoped by current access rules |
| Leads | Master 02 — Mobile Leads | Filter chip rail, search/filter, vertical Lead cards, temporary bulk mode | Filters, sorting/data, add/open Lead, bulk mutations | Hide responsible and reassignment actions for restricted users when redundant/unavailable |
| Cases | Master 03 — Mobile Cases | Status chip rail and vertical Case cards | Case data, financial state, filters, open/create, bulk mutations | Responsible and reassignment actions are conditional |
| Clients | Master 04 — Mobile Clients | Vertical Client cards with nested active Case previews | Client search/data and Client/Case navigation | Responsible appears only when relevant and permitted |
| Lead Detail | Master 05 — Mobile Lead Detail | P0 summary plus real tabs and focused section content | Contacts, dialogue, qualification, reminders, quick-contact mutations | Responsible is conditional; no invented Documents/Payments/History |
| Case Detail | Master 06 — Mobile Case Detail | Summary, real tabs, accordion-based Details | Payments, comments, documents, status, dates, tasks, contracts, MOS, custom sections | Responsible and actions are conditional; hidden organization sections remain hidden |
| Client Detail | Master 07 — Mobile Client Detail | Summary, Active Cases, real Client accordions | Client CRUD, passport computation, stay/family/address data, Case links | No Client-level Responsible Employee for any role |
| Tasks | Master 08 — Mobile Tasks | Mode switch, dynamic priority rail, vertical Task cards | Configured priorities, Task CRUD/edit, due/reminder data, priority mutation | Responsible conditional; Tasks already scoped for restricted users |
| Stages | Master 09 — Mobile Stages | Dynamic stage rail leading to Client/Case list | Configured Case statuses, matrix data, links, paid/value context | Only accessible Clients/Cases are rendered; no ownership field added |
| Calendar | Master 10 — Mobile Calendar | Month/List switch, compact month grid and selected-day agenda | Calendar/task data, Client filter, priorities, linked entity navigation | Responsible hidden when redundant for restricted users |
| More | Master 11 — Mobile More bottom sheet | 60–70% overlay sheet, 2 × 2 secondary navigation, account/logout | Existing routes, current user, logout, Settings access | Hide inaccessible tiles; reflow without disabled gaps |

## 21. Definition of done

The mobile implementation is complete only when:

- all eleven approved patterns are represented at `<= 768px`;
- the desktop presentation is visually unchanged at `>= 769px`;
- the bottom navigation order and active mapping are consistent everywhere;
- More is an overlay bottom sheet, not a separate page or replacement nav;
- configured statuses, priorities, stages, services, and custom sections remain
  dynamic;
- restricted access is enforced by existing backend scope and reflected by
  conditional UI without a separate style;
- no unsupported fields, entities, actions, or business logic have been added;
- manual QA has passed at 390 px, 414 px, and 430 px, including safe areas,
  long labels, loading/saving/error paths, and permitted actions;
- desktop regression checks and current workflow side effects have passed.
