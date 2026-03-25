/**
 * Backfill script: Migrate existing Product rows to new variant-aware fields.
 *
 * Run with: npx tsx prisma/backfill-variant-fields.ts
 *
 * This script is idempotent — it only updates products that haven't been backfilled yet
 * (i.e. where the new fields are still null/empty).
 */

import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      // Only backfill products that haven't been migrated yet
      pricing: { equals: null },
    },
  });

  console.log(`Found ${products.length} products to backfill`);

  for (const p of products) {
    const price = p.price ? Number(p.price) : null;
    const meta = (p.metadata as Record<string, any>) ?? {};

    // Build pricing array from single price
    const pricing = price != null ? [{ price }] : null;

    // Build activeVariant from price
    const activeVariant = price != null ? { price } : null;

    // Build images from imageUrl
    const images = p.imageUrl ? { primary: p.imageUrl } : null;

    // Build availableOptions from finishes + metadata
    const opts: Array<{ type: string; values: string[] }> = [];
    if (p.finishes && p.finishes.length > 0) {
      opts.push({ type: 'Finish', values: p.finishes });
    }
    if (Array.isArray(meta.availableColors) && meta.availableColors.length > 0) {
      if (!opts.some(o => o.type === 'Finish')) {
        opts.push({ type: 'Color', values: meta.availableColors });
      }
    }
    if (Array.isArray(meta.availableSizes) && meta.availableSizes.length > 0) {
      opts.push({ type: 'Size', values: meta.availableSizes });
    }
    const availableOptions = opts.length > 0 ? opts : null;

    // Promote features from metadata.keyFeatures
    const features: string[] = Array.isArray(meta.keyFeatures) ? meta.keyFeatures : [];

    // Build structured materials from flat material string
    const materials = p.material ? { primary: p.material } : null;

    // Promotions — not tracked before, leave empty
    const promotions: string[] = [];

    await prisma.product.update({
      where: { id: p.id },
      data: {
        pricing: pricing ?? undefined,
        activeVariant: activeVariant ?? undefined,
        images: images ?? undefined,
        availableOptions: availableOptions ?? undefined,
        features,
        materials: materials ?? undefined,
        promotions,
      },
    });

    console.log(`  Backfilled: ${p.productName} (${p.id})`);
  }

  console.log('Backfill complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
