-- AddValue to DesignerStatus enum
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
-- Prisma handles this automatically by running it outside the transaction block.
ALTER TYPE "DesignerStatus" ADD VALUE IF NOT EXISTS 'email_pending';

-- AddColumns to Designer for email verification
ALTER TABLE "Designer"
  ADD COLUMN "emailVerificationToken" TEXT,
  ADD COLUMN "emailVerificationExpiry" TIMESTAMP(3);

CREATE INDEX "Designer_emailVerificationToken_idx" ON "Designer"("emailVerificationToken");
