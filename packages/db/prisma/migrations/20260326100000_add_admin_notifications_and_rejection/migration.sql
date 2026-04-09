-- CreateEnum (base NotificationType — application_approved/rejected added below)
CREATE TYPE "NotificationType" AS ENUM ('message', 'quote_approved', 'quote_revision', 'quote_comment', 'order_update', 'shortlist_change', 'client_portal_view', 'payment_received', 'account_suspended');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "projectId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_designerId_read_createdAt_idx" ON "Notification"("designerId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_designerId_createdAt_idx" ON "Notification"("designerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('new_application', 'designer_approved', 'designer_rejected');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'application_approved';
ALTER TYPE "NotificationType" ADD VALUE 'application_rejected';

-- AlterTable
ALTER TABLE "Designer" ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "designerId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_read_createdAt_idx" ON "AdminNotification"("read", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "Designer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
