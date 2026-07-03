/**
 * One-time script: patches menu item images with Cloudinary URLs.
 * Safe to run against a live DB — only updates the `image` column.
 *
 * Run: npx ts-node --transpile-only scripts/update-item-images.ts
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const CDN = 'https://res.cloudinary.com/dhtlzjed4/image/upload';
const V   = (ver: string, slug: string) => `${CDN}/${ver}/pk-food/menu/${slug}`;

const IMAGE_MAP: Record<string, string> = {
  // ── Yaba Buka ────────────────────────────────────────────────────
  'White Rice':  V('v1783083131', 'rice-and-stew.jpg'),
  'Ofada Rice':  V('v1783083124', 'ofada-rice-recipe-jpg.jpg'),
  'Yam':         V('v1783083106', 'boiled-yam-and-egg.jpg'),
  'Swallow':     V('v1783083133', 'swallow-eba-and-okra.jpg'),
  'Plantain':    V('v1783083129', 'plantain.jpg'),
  'Protein':     V('v1783083110', 'chicken-meal.jpg'),

  // ── Spice Shack by Sugar Street ──────────────────────────────────
  'Big Meat Pie':        V('v1783083123', 'meatpie.jpg'),
  'Big Chicken Pie':     V('v1783083127', 'pie.jpg'),
  'Small Chicken Pie':   V('v1783083127', 'pie.jpg'),
  'Small Meat Pie':      V('v1783083123', 'meatpie.jpg'),
  'Donuts':              V('v1783083117', 'donut.jpg'),
  'Sausage Bread Rolls': V('v1783083103', 'sausage-bread-rolls.png'),
  'Sausage Rolls':       V('v1783083103', 'sausage-bread-rolls.png'),

  // ── Mello's Kitchen ──────────────────────────────────────────────
  'Penne':           V('v1783083105', 'tomatopennepasta.webp'),
  'Asun Fried Rice': V('v1783083102', 'fried-rice.jpg'),
  'Jollof Rice':     V('v1783083119', 'jollof-rice.webp'),
  'Chicken Wings':   V('v1783083110', 'chicken-meal.jpg'),
  'Chicken':         V('v1783083111', 'chicken.png'),
  'Fish':            V('v1783083100', 'fish-and-tomatoes.jpg'),
  'Coleslaw':        V('v1783083114', 'coleslaw.webp'),
  'Coconut Rice':    V('v1783083112', 'coconut-rice.jpg'),
  'Lasagna':         V('v1783083104', 'slice-of-lasagna-square-a.jpg'),

  // ── Chinalase ────────────────────────────────────────────────────
  'Steamed Rice': V('v1783083118', 'fried-ricee.jpg'),
  'Buffet 1':     V('v1783083107', 'buffet.jpg'),
  'Buffet 2':     V('v1783083108', 'buffet2.jpg'),
  'City Buffet':  V('v1783083116', 'deeeeerr-.webp'),
};

async function main(): Promise<void> {
  let updated = 0;
  let skipped = 0;

  for (const [name, image] of Object.entries(IMAGE_MAP)) {
    const result = await prisma.menuItem.updateMany({
      where: { name },
      data:  { image },
    });

    if (result.count > 0) {
      console.log(`OK  "${name}" — ${result.count} row(s) updated`);
      updated += result.count;
    } else {
      console.warn(`--  "${name}" — no item found (check name spelling)`);
      skipped++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} not found.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
