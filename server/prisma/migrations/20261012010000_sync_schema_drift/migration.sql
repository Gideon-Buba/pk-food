-- Catch-up for changes that reached the live DB via 'prisma db push' without a migration
-- (email/password auth, order phone, DRINKS category, magic_links removal).
-- Already present on live: mark applied there with 'prisma migrate resolve --applied'.

-- AlterEnum
ALTER TYPE "FoodCategory" ADD VALUE 'DRINKS';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "phone" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "verifyToken" TEXT,
ADD COLUMN     "verifyTokenExpiry" TIMESTAMP(3);

-- DropTable
DROP TABLE "magic_links";

-- CreateIndex
CREATE UNIQUE INDEX "users_verifyToken_key" ON "users"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

