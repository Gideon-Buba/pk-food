-- Per-item discounts replace the store-wide discount.
ALTER TABLE "settings" DROP COLUMN "discountPercent";

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "originalUnitPrice" DECIMAL(10,2),
ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;
