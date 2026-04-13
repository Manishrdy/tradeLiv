-- Additive migration: introduces contextType/contextId/metadata on Message.
-- These fields were added to schema.prisma in an earlier commit but no migration
-- was generated, so prod DBs were left missing the columns.

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "contextType" TEXT,
  ADD COLUMN IF NOT EXISTS "contextId"   TEXT,
  ADD COLUMN IF NOT EXISTS "metadata"    JSONB;

CREATE INDEX IF NOT EXISTS "Message_projectId_contextType_contextId_idx"
  ON "Message" ("projectId", "contextType", "contextId");
