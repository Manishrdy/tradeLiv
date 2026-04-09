/*
  Warnings:

  - You are about to drop the column `scrapeBatchId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `ScrapeBatch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_scrapeBatchId_fkey";

-- DropForeignKey
ALTER TABLE "ScrapeBatch" DROP CONSTRAINT "ScrapeBatch_scrapedById_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "scrapeBatchId";

-- DropTable
DROP TABLE "ScrapeBatch";

-- DropEnum
DROP TYPE "ScrapeStatus";
