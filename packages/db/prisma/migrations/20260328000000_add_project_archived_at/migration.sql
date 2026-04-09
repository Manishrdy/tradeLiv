-- AlterTable: add soft-delete field
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);
