-- AlterTable: remove accessCode from Client
ALTER TABLE "Client" DROP COLUMN IF EXISTS "accessCode";

-- AlterTable: add portalToken to Project
ALTER TABLE "Project" ADD COLUMN "portalToken" TEXT;

-- CreateIndex: unique constraint on portalToken
CREATE UNIQUE INDEX "Project_portalToken_key" ON "Project"("portalToken");
