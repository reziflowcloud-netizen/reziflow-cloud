-- Retain the provider's period-end instruction separately from an absolute
-- future cancellation date. Nullable, no default/backfill or new index.
ALTER TABLE "StripeBillingCoordinator" ADD COLUMN "cancelAtPaidThrough" BOOLEAN;
