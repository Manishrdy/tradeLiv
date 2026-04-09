-- AlterTable: add isAdmin to Designer
ALTER TABLE "Designer" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
