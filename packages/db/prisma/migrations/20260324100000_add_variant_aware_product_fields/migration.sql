-- AlterTable: Add variant-aware fields to Product
ALTER TABLE "Product" ADD COLUMN     "activeVariant" JSONB,
ADD COLUMN     "availability" TEXT,
ADD COLUMN     "availableOptions" JSONB,
ADD COLUMN     "currency" TEXT DEFAULT 'USD',
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "images" JSONB,
ADD COLUMN     "materials" JSONB,
ADD COLUMN     "pricing" JSONB,
ADD COLUMN     "promotions" TEXT[],
ADD COLUMN     "shipping" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "variantId" TEXT;
