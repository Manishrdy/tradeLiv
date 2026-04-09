-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalHours" INTEGER NOT NULL DEFAULT 6,
    "ttlDays" INTEGER NOT NULL DEFAULT 7,
    "driveFolderId" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "fileSizeBytes" BIGINT,
    "driveFileId" TEXT,
    "driveFileName" TEXT,
    "error" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);
