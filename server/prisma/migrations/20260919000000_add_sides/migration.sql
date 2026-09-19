-- CreateTable
CREATE TABLE "sides" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vendorId" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_sides" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "sideId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_sides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_sides" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "sideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_item_sides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_sides_menuItemId_sideId_key" ON "menu_item_sides"("menuItemId", "sideId");

-- AddForeignKey
ALTER TABLE "sides" ADD CONSTRAINT "sides_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_sides" ADD CONSTRAINT "menu_item_sides_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_sides" ADD CONSTRAINT "menu_item_sides_sideId_fkey" FOREIGN KEY ("sideId") REFERENCES "sides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_sides" ADD CONSTRAINT "order_item_sides_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_sides" ADD CONSTRAINT "order_item_sides_sideId_fkey" FOREIGN KEY ("sideId") REFERENCES "sides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
