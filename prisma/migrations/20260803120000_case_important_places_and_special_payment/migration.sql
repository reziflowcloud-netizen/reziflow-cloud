ALTER TABLE "Case"
ADD COLUMN "personalAppearLocation" TEXT,
ADD COLUMN "cardPickupDate" TIMESTAMP(3),
ADD COLUMN "cardPickupTime" TEXT,
ADD COLUMN "cardPickupLocation" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "specialMethod" BOOLEAN NOT NULL DEFAULT false;
