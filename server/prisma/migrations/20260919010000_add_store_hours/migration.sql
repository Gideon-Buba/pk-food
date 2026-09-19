-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "openTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN     "closeTime" TEXT NOT NULL DEFAULT '20:00';
