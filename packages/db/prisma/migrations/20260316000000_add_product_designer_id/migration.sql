-- AlterTable
ALTER TABLE "Product" ADD COLUMN "designerId" TEXT;

-- Update existing products: assign to the first admin designer (fallback)
UPDATE "Product" SET "designerId" = (SELECT "id" FROM "Designer" LIMIT 1) WHERE "designerId" IS NULL;

-- Now make it required
ALTER TABLE "Product" ALTER COLUMN "designerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
