-- CreateEnum
CREATE TYPE "FoodCategory" AS ENUM ('RICE', 'SWALLOW', 'PROTEIN', 'SIDES', 'PASTA', 'PASTRIES', 'BUFFET');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "category" "FoodCategory";
