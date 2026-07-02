import { FoodCategory, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Clear in FK-safe order
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.announcement.deleteMany();

  // Test users — password: "test1234", all pre-verified
  const hashedPassword = await bcrypt.hash('test1234', 12);
  await Promise.all([
    prisma.user.upsert({
      where: { email: 'staff@nrs.gov.ng' },
      update: { role: Role.STAFF, password: hashedPassword, emailVerified: true },
      create: { email: 'staff@nrs.gov.ng', role: Role.STAFF, password: hashedPassword, emailVerified: true },
    }),
    prisma.user.upsert({
      where: { email: 'admin@nrs.gov.ng' },
      update: { role: Role.ADMIN, password: hashedPassword, emailVerified: true },
      create: { email: 'admin@nrs.gov.ng', role: Role.ADMIN, password: hashedPassword, emailVerified: true },
    }),
    prisma.user.upsert({
      where: { email: 'runner@nrs.gov.ng' },
      update: { role: Role.RUNNER, password: hashedPassword, emailVerified: true },
      create: { email: 'runner@nrs.gov.ng', role: Role.RUNNER, password: hashedPassword, emailVerified: true },
    }),
  ]);
  console.log('Test users seeded (password: test1234): staff | admin | runner @nrs.gov.ng');

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
      { name: 'White Rice',  price: 800,  vendorId: yabaBuka.id, totalStock: 25, onlineStock: 25, category: FoodCategory.RICE    },
      { name: 'Ofada Rice',  price: 1200, vendorId: yabaBuka.id, totalStock: 18, onlineStock: 18, category: FoodCategory.RICE    },
      { name: 'Yam',         price: 700,  vendorId: yabaBuka.id, totalStock: 9,  onlineStock: 9,  category: FoodCategory.SIDES   },
      { name: 'Swallow',     price: 1000, vendorId: yabaBuka.id, totalStock: 13, onlineStock: 13, category: FoodCategory.SWALLOW },
      { name: 'Plantain',    price: 400,  vendorId: yabaBuka.id, totalStock: 34, onlineStock: 34, category: FoodCategory.SIDES   },
      { name: 'Protein',     price: 700,  vendorId: yabaBuka.id, totalStock: 50, onlineStock: 50, category: FoodCategory.PROTEIN },

      // ── Spice Shack by Sugar Street ───────────────────────────
      { name: 'Big Meat Pie',        price: 600, vendorId: spiceShack.id, totalStock: 10, onlineStock: 10, category: FoodCategory.PASTRIES },
      { name: 'Big Chicken Pie',     price: 600, vendorId: spiceShack.id, totalStock: 10, onlineStock: 10, category: FoodCategory.PASTRIES },
      { name: 'Small Chicken Pie',   price: 300, vendorId: spiceShack.id, totalStock: 5,  onlineStock: 5,  category: FoodCategory.PASTRIES },
      { name: 'Small Meat Pie',      price: 300, vendorId: spiceShack.id, totalStock: 5,  onlineStock: 5,  category: FoodCategory.PASTRIES },
      { name: 'Donuts',              price: 250, vendorId: spiceShack.id, totalStock: 12, onlineStock: 12, category: FoodCategory.PASTRIES },
      { name: 'Sausage Bread Rolls', price: 500, vendorId: spiceShack.id, totalStock: 6,  onlineStock: 6,  category: FoodCategory.PASTRIES },
      { name: 'Sausage Rolls',       price: 400, vendorId: spiceShack.id, totalStock: 9,  onlineStock: 9,  category: FoodCategory.PASTRIES },

      // ── Mello's Kitchen ───────────────────────────────────────
      { name: 'Penne',           price: 2000, vendorId: mellos.id, totalStock: 12, onlineStock: 12, category: FoodCategory.PASTA   },
      { name: 'Asun Fried Rice', price: 2500, vendorId: mellos.id, totalStock: 14, onlineStock: 14, category: FoodCategory.RICE    },
      { name: 'Jollof Rice',     price: 1500, vendorId: mellos.id, totalStock: 16, onlineStock: 16, category: FoodCategory.RICE    },
      { name: 'Chicken Wings',   price: 1500, vendorId: mellos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Chicken',         price: 1200, vendorId: mellos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Fish',            price: 1000, vendorId: mellos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Coleslaw',        price: 500,  vendorId: mellos.id, totalStock: 10, onlineStock: 10, category: FoodCategory.SIDES   },
      { name: 'Coconut Rice',    price: 1500, vendorId: mellos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.RICE    },
      { name: 'Lasagna',         price: 3000, vendorId: mellos.id, totalStock: 2,  onlineStock: 2,  category: FoodCategory.PASTA   },

      // ── Chinalase ─────────────────────────────────────────────
      { name: 'Steamed Rice', price: 1000, vendorId: chinalase.id, totalStock: 8,  onlineStock: 8,  category: FoodCategory.RICE   },
      { name: 'Buffet 1',     price: 2500, vendorId: chinalase.id, totalStock: 12, onlineStock: 12, category: FoodCategory.BUFFET },
      { name: 'Buffet 2',     price: 3000, vendorId: chinalase.id, totalStock: 10, onlineStock: 10, category: FoodCategory.BUFFET },
      { name: 'City Buffet',  price: 3500, vendorId: chinalase.id, totalStock: 6,  onlineStock: 6,  category: FoodCategory.BUFFET },
    ],
  });

  await prisma.announcement.createMany({
    data: [
      { type: 'STATUS',  message: 'Canteen is open — last orders by 2:00 PM daily.', active: true },
      { type: 'GENERAL', message: 'Welcome to PK Food! Order from any stall and get it delivered to your floor.', active: true },
    ],
  });

  const count = await prisma.menuItem.count();
  console.log(`Done — ${count} menu items seeded across 4 stalls.`);
  console.log('REMINDER: Update item prices via the Admin panel — current values are placeholders.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
