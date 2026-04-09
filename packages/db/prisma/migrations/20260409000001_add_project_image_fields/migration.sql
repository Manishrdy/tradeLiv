-- AlterTable: add image storage columns to Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "imageData" BYTEA;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "imageMimeType" TEXT;
