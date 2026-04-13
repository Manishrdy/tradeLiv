-- Additive migration: introduces variants JSONB on Product.
-- The field was added to schema.prisma as the single source of truth for
-- variant/pricing/option data but no migration was generated, so prod DBs
-- were left missing the column.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "variants" JSONB;
