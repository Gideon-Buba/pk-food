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

  // ── Vendors ────────────────────────────────────────────────────
  const [yabaBuka, spiceShack, chinalase, drinks, melos] = await Promise.all([
    prisma.vendor.create({ data: { name: 'Yaba Buka' } }),
    prisma.vendor.create({ data: { name: 'Spice Shack by Sugar Street' } }),
    prisma.vendor.create({ data: { name: 'Chinalase Canteen' } }),
    prisma.vendor.create({ data: { name: 'Drinks' } }),
    prisma.vendor.create({ data: { name: "Melo's Kitchen" } }),
  ]);

  await prisma.menuItem.createMany({
    data: [

      // ── Chinalase Canteen ──────────────────────────────────────
      // Buffet packs
      { name: 'Belleful Lunch Pack',               price: 6500, vendorId: chinalase.id, totalStock: 20, onlineStock: 20, category: FoodCategory.BUFFET },
      { name: 'Buffet 1',                          price: 6500, vendorId: chinalase.id, totalStock: 20, onlineStock: 20, category: FoodCategory.BUFFET },
      { name: 'Buffet 2',                          price: 6500, vendorId: chinalase.id, totalStock: 20, onlineStock: 20, category: FoodCategory.BUFFET },
      { name: 'City Buffet',                       price: 9500, vendorId: chinalase.id, totalStock: 15, onlineStock: 15, category: FoodCategory.BUFFET },
      { name: 'Create Your Own Buffet (CYO)',       price: 9500, vendorId: chinalase.id, totalStock: 15, onlineStock: 15, category: FoodCategory.BUFFET },
      // Sides / add-ons
      { name: 'Firecracker Wings',                 price: 5500, vendorId: chinalase.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PROTEIN },
      { name: 'Firecracker Lamb Ribs',             price: 6500, vendorId: chinalase.id, totalStock: 10, onlineStock: 10, category: FoodCategory.PROTEIN },
      { name: 'Asian Surprise',                    price: 6500, vendorId: chinalase.id, totalStock: 10, onlineStock: 10, category: FoodCategory.SIDES   },
      { name: 'Fish / Seafood Sauce',              price: 9500, vendorId: chinalase.id, totalStock: 10, onlineStock: 10, category: FoodCategory.PROTEIN },
      { name: 'Crispy Plate',                      price: 6500, vendorId: chinalase.id, totalStock: 10, onlineStock: 10, category: FoodCategory.SIDES   },

      // ── Spice Shack by Sugar Street ───────────────────────────
      { name: 'Sausage Roll',                      price: 1300, vendorId: spiceShack.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PASTRIES },
      { name: 'Bread Sausage Roll',                price: 1200, vendorId: spiceShack.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PASTRIES },
      { name: 'Doughnut',                          price: 750,  vendorId: spiceShack.id, totalStock: 30, onlineStock: 30, category: FoodCategory.PASTRIES },
      { name: 'Chicken Pie (Big)',                  price: 2000, vendorId: spiceShack.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PASTRIES },
      { name: 'Meat Pie (Big)',                     price: 2500, vendorId: spiceShack.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PASTRIES },
      { name: 'Chicken Pie (Small)',                price: 1000, vendorId: spiceShack.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PASTRIES },
      { name: 'Meat Pie (Small)',                   price: 1300, vendorId: spiceShack.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PASTRIES },

      // ── Yaba Buka ─────────────────────────────────────────────
      // Items available most days
      { name: 'White Rice and Stew',               price: 3000, vendorId: yabaBuka.id, totalStock: 30, onlineStock: 30, category: FoodCategory.RICE    },
      { name: 'Ofada Rice and Sauce',              price: 6000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.RICE    },
      { name: 'Boiled Yam',                        price: 2000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Egg Sauce',                         price: 1000, vendorId: yabaBuka.id, totalStock: 30, onlineStock: 30, category: FoodCategory.SIDES   },
      { name: 'Fried Kpanla',                      price: 2000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Beef',                              price: 1000, vendorId: yabaBuka.id, totalStock: 40, onlineStock: 40, category: FoodCategory.PROTEIN },
      { name: 'Bread',                             price: 1000, vendorId: yabaBuka.id, totalStock: 25, onlineStock: 25, category: FoodCategory.SIDES   },
      // Thursday items
      { name: 'Native Jollof Rice',                price: 3500, vendorId: yabaBuka.id, totalStock: 25, onlineStock: 25, category: FoodCategory.RICE    },
      { name: 'Semo / Amala / Fufu',               price: 1000, vendorId: yabaBuka.id, totalStock: 25, onlineStock: 25, category: FoodCategory.SWALLOW },
      { name: 'Gbegiri / Ewedu',                   price: 1500, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Ewa Agoyin',                        price: 3000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Boiled Plantain',                   price: 2000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Eforiro',                           price: 3000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'Ogbono',                            price: 3000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'Chicken',                           price: 2000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Kpomo',                             price: 1000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      // Friday items
      { name: 'Porridge Beans',                    price: 3000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.RICE    },
      { name: 'Pounded Yam',                       price: 1500, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SWALLOW },
      { name: 'Fufu / Garri',                      price: 1000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SWALLOW },
      { name: 'Edikaikong',                        price: 3000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'Uziza Soup',                        price: 3000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'Egusi',                             price: 3000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'White Okro',                        price: 1500, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.SIDES   },
      { name: 'Moi Moi',                           price: 1500, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Assorted Meat',                     price: 1000, vendorId: yabaBuka.id, totalStock: 20, onlineStock: 20, category: FoodCategory.PROTEIN },
      { name: 'Plantain',                          price: 500,  vendorId: yabaBuka.id, totalStock: 30, onlineStock: 30, category: FoodCategory.SIDES   },
      { name: 'Goat Meat',                         price: 2000, vendorId: yabaBuka.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PROTEIN },

      // ── Drinks ────────────────────────────────────────────────
      { name: 'Coca-Cola (50CL)',                  price: 700,  vendorId: drinks.id, totalStock: 50, onlineStock: 50, category: FoodCategory.DRINKS },
      { name: 'Fanta (50CL)',                      price: 700,  vendorId: drinks.id, totalStock: 50, onlineStock: 50, category: FoodCategory.DRINKS },
      { name: 'Sprite (50CL)',                     price: 700,  vendorId: drinks.id, totalStock: 50, onlineStock: 50, category: FoodCategory.DRINKS },
      { name: 'Malt',                              price: 800,  vendorId: drinks.id, totalStock: 50, onlineStock: 50, category: FoodCategory.DRINKS },
      { name: 'Bitter Lemon',                      price: 750,  vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Water',                             price: 400,  vendorId: drinks.id, totalStock: 100, onlineStock: 100, category: FoodCategory.DRINKS },
      { name: 'Chivita Exotic (500ml)',            price: 1500, vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Chivita Active (315ml)',            price: 1300, vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Ribena (250ml)',                    price: 900,  vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Lucozade Boost (250ml)',            price: 900,  vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Zobo (Big)',                        price: 1400, vendorId: drinks.id, totalStock: 20, onlineStock: 20, category: FoodCategory.DRINKS },
      { name: 'Ginger Drink (Big)',                price: 1400, vendorId: drinks.id, totalStock: 20, onlineStock: 20, category: FoodCategory.DRINKS },
      { name: 'Kunu Aya (Big)',                    price: 1400, vendorId: drinks.id, totalStock: 20, onlineStock: 20, category: FoodCategory.DRINKS },
      { name: 'Orange Juice',                      price: 2000, vendorId: drinks.id, totalStock: 20, onlineStock: 20, category: FoodCategory.DRINKS },
      { name: 'Zobo (Small)',                      price: 1000, vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Ginger Drink (Small)',              price: 1000, vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Kunu Aya (Small)',                  price: 1000, vendorId: drinks.id, totalStock: 30, onlineStock: 30, category: FoodCategory.DRINKS },
      { name: 'Small Orange Juice',                price: 1500, vendorId: drinks.id, totalStock: 20, onlineStock: 20, category: FoodCategory.DRINKS },

      // ── Melo's Kitchen ────────────────────────────────────────
      { name: 'Owambe Jollof Rice',                price: 3250, vendorId: melos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.RICE    },
      { name: 'Signature Fried Rice',              price: 3750, vendorId: melos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.RICE    },
      { name: 'Goat Meat Pasta in Rich Tomato Sauce', price: 3750, vendorId: melos.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PASTA   },
      { name: 'Gizdodo',                           price: 2250, vendorId: melos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
      { name: 'Beef Lasagna',                      price: 5000, vendorId: melos.id, totalStock: 10, onlineStock: 10, category: FoodCategory.PASTA   },
      { name: 'Peppered Chicken in Rich Pepper Sauce', price: 4500, vendorId: melos.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PROTEIN },
      { name: 'Peppered Croaker Fish in Rich Pepper Sauce', price: 4500, vendorId: melos.id, totalStock: 15, onlineStock: 15, category: FoodCategory.PROTEIN },
      { name: 'Classic Creamy Coleslaw',           price: 2500, vendorId: melos.id, totalStock: 20, onlineStock: 20, category: FoodCategory.SIDES   },
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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
