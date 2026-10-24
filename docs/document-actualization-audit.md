# Document actualization — WIP audit/design

Base: fresh `895ebe271f8a2c106029992f0497252cc9a81eee`. Development only; no production access or changes.

- Case has date-only `predictedDecisionDate`, shared `decisionReceived`, CAS `updatedAt`.
- DocUpdate writers/deleters: Case POST, DELETE child; client/org cascade deletion. Only reserved service marker found is `__MOS_ID__:`. Reserved `__NAME__:` records are excluded conservatively. There was no edit route: this change adds a scoped PATCH and an edit action in the existing section. No document upload/status/history behavior changes.
- Existing deterministic Task creation uses IDs/advisory locks. This control uses deterministic Case/org/effective-date cycle IDs and Case row serialization. Managed Task metadata is `documentActualization:{version:1,caseId,caseNumber,cycle}`. It never overloads the existing MOS/date/manual Task metadata.
- Existing Task/Calendar/UpcomingEvents Case-reference resolvers need the new metadata key. Scope remains User-based for Tasks, Employee-based for Cases; only explicit valid Employee↔User links are accepted. Unlinked/mismatched responsibility yields an unassigned control, not an arbitrary user.
- Existing notification candidate SQL, task_due/overdue occurrences, organization opt-in/watermark, personal preferences/privacy/push gating and outbox are reused. No schedules/cadence/settings changes. Frequent `*/15` and daily Case schedules remain as documented; no live inspection or production access was attempted.
- Existing scheduler locks Organization→entity. This automation uses Organization→Case→Task for scheduler, Case→Task for mutations and managed delivery; normal Task completion locks only Task. No Task→Case lock acquisition. Delivery revalidates the managed Case/cycle and pending outbox under that lock order; already handed-off provider sends cannot be recalled.

No migration: retained inactive/completed cycle Tasks form the durable cycle ledger. New Cases with no date need no Task; their later relevant date/document changes activate. Legacy Cases activate only on confirmed relevant date/receipt/genuine DocUpdate changes. No-op dates, unrelated patches, GET, scheduler and MOS service writes never activate. No deployment/backfill hook exists.

Dates: latest valid genuine DocUpdate date, else predicted date, +90 calendar days; literal UTC-midnight date-only values keep their CRM date and timestamps use Warsaw day. Never createdAt or three months. Completed current cycles are retained. A→B→A reuses A's ID/history; an unfinished retired A can resume while completed A cannot be recreated. Receipt stop retires only unfinished controls and cancels pending deliveries. Normal Task mutation cannot forge/detach/reassign/re-date or delete managed controls; completing one does not mutate DocUpdates or generate another cycle.

WIP validation: isolated copied-source TypeScript check PASS. Unit/integration/concurrency/browser/build checks are pending. This checkpoint is not deployment-ready.
