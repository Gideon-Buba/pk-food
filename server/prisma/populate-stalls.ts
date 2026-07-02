/**
 * Production-safe stall population script.
 * Replaces ALL vendors + menu items WITHOUT touching orders, users, or announcements.
 *
 * Run with: npx ts-node --transpile-only prisma/populate-stalls.ts
 *
 * WARNING: This deletes all existing vendors and menu items.
 * Any orders referencing the old items will have their orderItems deleted first.
 * Order records themselves are preserved for history.
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Populating real stall data...');

  // Must delete orderItems before menu_items due to FK constraint
  // Orders rows themselves stay intact for history
  await prisma.orderItem.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.vendor.deleteMany();
  console.log('Cleared old vendors and menu items.');

  // ── Real stalls ────────────────────────────────────────────────
  // NOTE: Prices are placeholders — update them via the Admin panel
  const [yabaBuka, spiceShack, mellos, chinalase] = await Promise.all([
    prisma.vendor.create({ data: { name: 'Yaba Buka' } }),
    prisma.vendor.create({ data: { name: 'Spice Shack by Sugar Street' } }),
    prisma.vendor.create({ data: { name: "Mello's Kitchen" } }),
    prisma.vendor.create({ data: { name: 'Chinalase' } }),
  ]);

  await prisma.menuItem.createMany({
    data: [
      // ── Yaba Buka ─────────────────────────────────────────────
      { name: 'White Rice',  price: 800,  vendorId: yabaBuka.id, totalStock: 25, onlineStock: 25 },
      { name: 'Ofada Rice',  price: 1200, vendorId: yabaBuka.id, totalStock: 18, onlineStock: 18 },
      { name: 'Yam',         price: 700,  vendorId: yabaBuka.id, totalStock: 9,  onlineStock: 9  },
      { name: 'Swallow',     price: 1000, vendorId: yabaBuka.id, totalStock: 13, onlineStock: 13 },
      { name: 'Plantain',    price: 400,  vendorId: yabaBuka.id, totalStock: 34, onlineStock: 34 },
      { name: 'Protein',     price: 700,  vendorId: yabaBuka.id, totalStock: 50, onlineStock: 50 },

      // ── Spice Shack by Sugar Street ───────────────────────────
      { name: 'Big Meat Pie',        price: 600, vendorId: spiceShack.id, totalStock: 10, onlineStock: 10 },
      { name: 'Big Chicken Pie',     price: 600, vendorId: spiceShack.id, totalStock: 10, onlineStock: 10 },
      { name: 'Small Chicken Pie',   price: 300, vendorId: spiceShack.id, totalStock: 5,  onlineStock: 5  },
      { name: 'Small Meat Pie',      price: 300, vendorId: spiceShack.id, totalStock: 5,  onlineStock: 5  },
      { name: 'Donuts',              price: 250, vendorId: spiceShack.id, totalStock: 12, onlineStock: 12 },
      { name: 'Sausage Bread Rolls', price: 500, vendorId: spiceShack.id, totalStock: 6,  onlineStock: 6  },
      { name: 'Sausage Rolls',       price: 400, vendorId: spiceShack.id, totalStock: 9,  onlineStock: 9  },

      // ── Mello's Kitchen ───────────────────────────────────────
      { name: 'Penne',           price: 2000, vendorId: mellos.id, totalStock: 12, onlineStock: 12 },
      { name: 'Asun Fried Rice', price: 2500, vendorId: mellos.id, totalStock: 14, onlineStock: 14 },
      { name: 'Jollof Rice',     price: 1500, vendorId: mellos.id, totalStock: 16, onlineStock: 16 },
      { name: 'Chicken Wings',   price: 1500, vendorId: mellos.id, totalStock: 20, onlineStock: 20 },
      { name: 'Chicken',         price: 1200, vendorId: mellos.id, totalStock: 20, onlineStock: 20 },
      { name: 'Fish',            price: 1000, vendorId: mellos.id, totalStock: 20, onlineStock: 20 },
      { name: 'Coleslaw',        price: 500,  vendorId: mellos.id, totalStock: 10, onlineStock: 10 },
      { name: 'Coconut Rice',    price: 1500, vendorId: mellos.id, totalStock: 20, onlineStock: 20 },
      { name: 'Lasagna',         price: 3000, vendorId: mellos.id, totalStock: 2,  onlineStock: 2  },

      // ── Chinalase ─────────────────────────────────────────────
      { name: 'Steamed Rice', price: 1000, vendorId: chinalase.id, totalStock: 8,  onlineStock: 8  },
      { name: 'Buffet 1',     price: 2500, vendorId: chinalase.id, totalStock: 12, onlineStock: 12 },
      { name: 'Buffet 2',     price: 3000, vendorId: chinalase.id, totalStock: 10, onlineStock: 10 },
      { name: 'City Buffet',  price: 3500, vendorId: chinalase.id, totalStock: 6,  onlineStock: 6  },
    ],
  });

  const count = await prisma.menuItem.count();
  console.log(`Done — ${count} menu items across 4 stalls.`);
  console.log('REMINDER: Update item prices via the Admin panel — current values are placeholders.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
