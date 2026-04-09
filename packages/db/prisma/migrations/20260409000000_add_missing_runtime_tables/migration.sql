-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'approved', 'revision_requested', 'expired', 'converted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "FeeType" AS ENUM ('percentage', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "notes" TEXT,
    "taxRate" DECIMAL(65,30),
    "commissionType" "FeeType",
    "commissionValue" DECIMAL(65,30),
    "platformFeeType" "FeeType",
    "platformFeeValue" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30),
    "taxAmount" DECIMAL(65,30),
    "commissionAmount" DECIMAL(65,30),
    "platformFeeAmount" DECIMAL(65,30),
    "grandTotal" DECIMAL(65,30),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "convertedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "selectedVariant" JSONB,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "adjustmentLabel" TEXT,
    "adjustmentValue" DECIMAL(65,30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteComment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "senderType" "ActorType" NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lineItemId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DesignerSession" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "lastPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    CONSTRAINT "DesignerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FurnitureCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FurnitureCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_projectId_status_idx" ON "Quote"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_designerId_idx" ON "Quote"("designerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteComment_quoteId_createdAt_idx" ON "QuoteComment"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DesignerSession_designerId_startedAt_idx" ON "DesignerSession"("designerId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DesignerSession_designerId_lastPing_idx" ON "DesignerSession"("designerId", "lastPing");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FurnitureCategory_name_key" ON "FurnitureCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConfig_key_key" ON "PlatformConfig"("key");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "QuoteComment" ADD CONSTRAINT "QuoteComment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "DesignerSession" ADD CONSTRAINT "DesignerSession_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
