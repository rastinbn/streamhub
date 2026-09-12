-- Phase 9: VOD & Content

-- Guarded (IF NOT EXISTS / DO blocks) so this migration is safe both on
-- databases that already ran it and on ones that never have.

-- CreateEnum (must precede the table that references it)
DO $$ BEGIN
    CREATE TYPE "VodVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vods" (
    "id" TEXT NOT NULL,
    "streamId" TEXT,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "storageKey" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "visibility" "VodVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vods_channelId_createdAt_idx" ON "vods"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "vods_visibility_createdAt_idx" ON "vods"("visibility", "createdAt");
CREATE INDEX IF NOT EXISTS "vods_streamId_idx" ON "vods"("streamId");

-- AddForeignKey (guarded: Postgres has no CREATE CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vods_streamId_fkey'
    ) THEN
        ALTER TABLE "vods" ADD CONSTRAINT "vods_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
