-- Receipt recorded in CRM, independent of decision outcome. Existing rows default to unrecorded.
ALTER TABLE "Case" ADD COLUMN "decisionReceived" BOOLEAN NOT NULL DEFAULT false;
