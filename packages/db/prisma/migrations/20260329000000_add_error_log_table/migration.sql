-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "routePath" TEXT,
    "httpMethod" TEXT,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "errorPayload" JSONB,
    "inputPayload" JSONB,
    "designerId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_fileName_createdAt_idx" ON "ErrorLog"("fileName", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_severity_createdAt_idx" ON "ErrorLog"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_designerId_createdAt_idx" ON "ErrorLog"("designerId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
