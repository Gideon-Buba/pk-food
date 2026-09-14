-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "requiresPackaging" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "requiresPackaging" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "packagingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
