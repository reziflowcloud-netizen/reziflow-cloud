-- Nullable provider scheduling evidence on the isolated billing coordinator.
-- No default, backfill, index or change to any pre-billing application table.
ALTER TABLE "StripeBillingCoordinator" ADD COLUMN "scheduledCancelAt" TIMESTAMP(3);
