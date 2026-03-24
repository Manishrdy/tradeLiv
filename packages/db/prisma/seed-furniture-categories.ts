import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  // Seating
  { name: 'Sofa', group: 'Seating', icon: '🛋️', sortOrder: 0 },
  { name: 'Armchair', group: 'Seating', icon: '💺', sortOrder: 1 },

  // Tables
  { name: 'Dining Table', group: 'Tables', icon: '🍽️', sortOrder: 10 },
  { name: 'Desk', group: 'Tables', icon: '🖥️', sortOrder: 11 },
  { name: 'Side Table', group: 'Tables', icon: '🪑', sortOrder: 12 },
  { name: 'Coffee Table', group: 'Tables', icon: '☕', sortOrder: 13 },
  { name: 'Console Table', group: 'Tables', icon: '🪞', sortOrder: 14 },

  // Beds & Bedroom
  { name: 'Bed', group: 'Bedroom', icon: '🛏️', sortOrder: 20 },
  { name: 'Wardrobe', group: 'Bedroom', icon: '🚪', sortOrder: 21 },
  { name: 'Dresser', group: 'Bedroom', icon: '🗄️', sortOrder: 22 },

  // Storage
  { name: 'Storage', group: 'Storage', icon: '📦', sortOrder: 30 },
  { name: 'Bookshelf', group: 'Storage', icon: '📚', sortOrder: 31 },
  { name: 'TV Unit', group: 'Storage', icon: '📺', sortOrder: 32 },
  { name: 'Shoe Rack', group: 'Storage', icon: '👟', sortOrder: 33 },

  // Decor & Accessories
  { name: 'Lighting', group: 'Decor', icon: '💡', sortOrder: 40 },
  { name: 'Fan', group: 'Decor', icon: '🌀', sortOrder: 41 },
  { name: 'Rug', group: 'Decor', icon: '🟫', sortOrder: 42 },
  { name: 'Mirror', group: 'Decor', icon: '🪞', sortOrder: 43 },
  { name: 'Curtains', group: 'Decor', icon: '🪟', sortOrder: 44 },
  { name: 'Wall Art', group: 'Decor', icon: '🖼️', sortOrder: 45 },
  { name: 'Planter', group: 'Decor', icon: '🪴', sortOrder: 46 },
];

async function main() {
  console.log('Seeding furniture categories...');

  for (const cat of CATEGORIES) {
    await prisma.furnitureCategory.upsert({
      where: { name: cat.name },
      update: { group: cat.group, icon: cat.icon, sortOrder: cat.sortOrder },
      create: { ...cat, active: true },
    });
    console.log(`  ✓ ${cat.name}`);
  }

  console.log(`\nDone! ${CATEGORIES.length} categories seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
