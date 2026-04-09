-- AlterTable
ALTER TABLE "ErrorLog"
ADD COLUMN "useDbEnv" TEXT,
ADD COLUMN "errorFingerprint" TEXT;

-- CreateTable
CREATE TABLE "ErrorIncident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "routePath" TEXT,
    "httpMethod" TEXT,
    "normalizedErrorMessage" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "useDbEnv" TEXT,
    "githubIssueNumber" INTEGER,
    "githubIssueUrl" TEXT,
    "githubIssueState" TEXT NOT NULL DEFAULT 'open',
    "issueClosedAt" TIMESTAMP(3),
    "issueCreationInProgress" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorIncident_fingerprint_key" ON "ErrorIncident"("fingerprint");

-- CreateIndex
CREATE INDEX "ErrorLog_errorFingerprint_createdAt_idx" ON "ErrorLog"("errorFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorIncident_githubIssueNumber_idx" ON "ErrorIncident"("githubIssueNumber");

-- CreateIndex
CREATE INDEX "ErrorIncident_githubIssueState_lastSeenAt_idx" ON "ErrorIncident"("githubIssueState", "lastSeenAt");
