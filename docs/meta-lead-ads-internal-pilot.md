# Meta Lead Ads implementation and operator guide

The internal QA E2E is completed and accepted. Do not recreate its resources or rerun Meta QA as a release step. The production candidate excludes its private Windows/ngrok tooling and rejects the internal QA resources as customer configuration.

The current authoritative implementation, default-OFF rollout, worker scheduler, credential attestation, retention limits, exact migration/backup/rollback gates and reproduction instructions are in [the release candidate plan](meta-lead-ads-release-candidate.md). This replaces the historical pilot activation instructions. Existing QA legal pages remain QA-only and are not a customer Privacy Policy or DPA.

## Receipt retention is not contact deletion

The independently authenticated `/api/internal/meta-lead-ads/retention` endpoint is manual, tenant-allowlisted and dry-run by default. Applying requires `apply=true`, `X-Meta-Lead-Ads-Retention-Confirm: APPLY_TERMINAL_RETENTION`, its exact tenant allowlist and `META_LEAD_ADS_RETENTION_ENABLED=true`. At most50 records per category are considered each call. No retention timer is installed.

Terminal complete/blocked/shadow receipts older than30 days become minimal keyed-fingerprint tombstones: raw lead identifier, contact link and diagnostic code are cleared. Pending/processing rows are preserved for investigation. Tombstones expire after366 days; Graph imports require verified lead creation time <=365 days. Keep the receipt HMAC key stable. OFF pilot allowlists expire after30 days and an explicit binding disable clears them immediately.

These mechanisms do not automatically delete CRM leads, notifications, technical logs, token configuration, independent Meta/provider records or backups. Establish their real customer retention/deletion rules and any data-subject workflow before enabling real leads. Do not promise automatic deletion based on the receipt endpoint.

All Production and external tenant changes require separate owner authorization. Never use RAM/SL, legacy messaging credentials or Production data in the synthetic test fixtures.
