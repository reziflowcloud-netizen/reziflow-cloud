# Phase 3A mobile standalone resume fallback

## Architecture and scope

The existing Service Worker and canonical `/notifications/open/{notificationId}`
navigation are unchanged. Native navigation, the JavaScript click handoff,
same-origin validation, login return, access checks, idempotent read marking and
badge updates keep their existing paths. Event generation, assignment/routing,
dedupe, preferences, privacy, keys and subscriptions are unchanged. No migration.

Only mobile (viewport <=768px) standalone clients opt into resume metadata on the
existing authenticated Notification Center GET. Eligibility uses the manifest
display-mode media query or Apple's read-only `navigator.standalone` property.
References: [W3C display-mode](https://www.w3.org/TR/appmanifest/),
[Apple Home Screen detection](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).

At hidden/background the client records a boundary projected from the last
authenticated server timestamp with monotonic elapsed time. Device wall-clock
changes do not affect it. On visibility/focus/pageshow, the Center synchronizes and
queries currently unread notifications created after that boundary, using the
same User/organization/current entity access SQL as the Center. This lookup is
independent of list pagination and does not rely on an increased unread count.
It returns only a scoped existence marker, not a suggested entity or destination.

A compact dismissible banner opens the existing Center. It never chooses an
entity. It uses theme tokens and RU/UA/PL notification strings; a small sticky
in-flow header keeps it reachable on a scrolled mobile page. No timer dismisses
it. Opening the Center, dismissing, changing route, receiving an empty unread set,
or losing the session clears pending state. Stale responses cannot resurrect it;
overlapping resume requests coalesce into a fresh full synchronization.

State lives in the mounted Center's memory, scoped to the authenticated User and
organization. A fresh/cold mount with old unread messages alone does not qualify
as a resume. A successful full resolver navigation creates a fresh page after
marking the clicked message read; a client route change acknowledges the boundary.
The fallback does not promise to reconstruct a background boundary after the OS
has discarded the entire page process. Physical iPhone verification is separate.

## Isolated evidence

2026-10-10, loopback-only PostgreSQL notification QA database; synthetic records.
220 tests passed, zero failed/skipped: notifications, Phase 2 push, Phase 3A event
creation/dedupe, canonical Lead/Task resolvers, session return, same-origin,
security/tenant isolation, autosave, Staff routing and Lead visibility. Added
`notification-resume.test.mjs` covers eligibility, no-new/old-unread, unchanged
unread count with a replacement message, a new unread outside the first 30 rows,
multiple arrivals/one banner, stale responses, dismissal/Center/route suppression,
read/access revoke, expired session state, tenant/User scope changes and a fast
background/resume before the initial synchronization completes. That last case
reconstructs the saved monotonic boundary when the first server clock arrives,
then coalesces a fresh authenticated query instead of losing the resume.

Browser integration uses the actual Center, tracker, notification strings, CSS
and isolated API through a disposable loopback harness. Its standalone and
background/resume controls are explicitly simulated, not physical iPhone proof.

| Check | Isolated result |
| --- | --- |
| Old unread N=1, initial/ordinary resume | PASS, no banner |
| Background + two arrivals + resume | PASS, N=3, one banner |
| CTA opens existing Center with both arrivals | PASS |
| Center -> exact synthetic Lead | PASS, canonical resolver -> exact ID, read, badge 3->2 |
| Center -> exact synthetic Task | PASS, exact notificationTask ID/editor title, read, badge 2->1 |
| Dismiss / repeated resume / same set | PASS, no repeated banner |
| Center open / mark all read | PASS, banner cleared, badge 0 |
| Light/RU, Dark/UA, Slate/PL | PASS, browser screenshots; existing theme tokens |
| Desktop eligibility | PASS, resize removes banner; old set does not resurface on returning to mobile |
| Direct click regression | PASS, existing actual-worker simulation and resolver tests |

Browser artifacts (ignored `.qa/`): `resume-banner-light-ru.png`,
`resume-banner-dark-uk.png`, `resume-banner-slate-pl.png`,
`resume-center-two-events.png`. Browser screenshot capture was unavailable on
the full Next.js Lead/Task pages in the in-app browser; the DOM, route, exact
title and updated unread counts were observed instead. Console inspection of
those pages showed no runtime errors. This tooling limitation is not an iPhone
result.

TypeScript, Prisma validate, safe build (dummy unreachable DB), private-key scan
and `git diff --check` must pass on the final committed revision before deploy.
Windows initially refused Prisma DLL replacement while the local QA server held
it; stop that server and rerun the complete safe build.

One full-suite attempt hit the existing immediate-delivery timing assertion in
`notification-events-phase3.test.mjs:263` (expected one delivery, observed zero).
The unchanged test passed in isolation and the subsequent full 220-test run
passed. No generation/delivery logic was changed; preserve this failed attempt
as timing-sensitive QA evidence rather than treating it as an iPhone result.

## Controlled production pilot

Deploy only after isolated checks. Keep TestRezidents/User16 scope, privacy OFF,
one active iOS subscription, scheduler OFF and Phase 3B OFF. A fresh synthetic
Lead is first; only after the human confirms delivery and direct-or-banner ->
Center -> exact Lead may the synthetic Task be created/assigned. Keep separate
fixture records and manual evidence. Do not count provider acceptance as delivery
or a backend resolver test as a physical system push tap.

The phone version check identifies this UI as `resume-fallback-1` alongside the
unchanged worker version `notification-click-existing-window-2`. After both
manual flows pass, clean up only the explicitly recorded synthetic fixtures and
their notifications, check the delivery queue is empty and preferences unchanged.
Final physical results and cleanup remain PENDING until user confirmation.
