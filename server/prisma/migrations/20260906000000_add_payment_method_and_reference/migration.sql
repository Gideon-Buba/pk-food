-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FLUTTERWAVE', 'BANK_TRANSFER');

-- AlterTable: payment method + optional transfer note
ALTER TABLE "orders"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'FLUTTERWAVE',
  ADD COLUMN "transferReference" TEXT;

-- AlterTable: human-friendly order reference (added nullable, backfilled, then made required)
ALTER TABLE "orders" ADD COLUMN "reference" TEXT;

UPDATE "orders"
SET "reference" = 'PK' || upper(substr(md5(random()::text || "id"), 1, 5))
WHERE "reference" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "reference" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");
