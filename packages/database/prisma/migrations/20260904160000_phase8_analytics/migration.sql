-- Phase 8: Analytics

-- Guarded (IF NOT EXISTS / DO blocks) so this migration is safe both on
-- databases that already ran it and on ones that never have.

-- CreateTable
CREATE TABLE IF NOT EXISTS "stream_analytics" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "watchTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "averageViewers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followersGained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "viewer_metrics" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "viewers" INTEGER NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewer_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stream_analytics_streamId_key" ON "stream_analytics"("streamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stream_analytics_channelId_startedAt_idx" ON "stream_analytics"("channelId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "viewer_metrics_streamId_sampledAt_idx" ON "viewer_metrics"("streamId", "sampledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "viewer_metrics_channelId_sampledAt_idx" ON "viewer_metrics"("channelId", "sampledAt");

-- AddForeignKey (guarded: Postgres has no CREATE CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stream_analytics_streamId_fkey'
    ) THEN
        ALTER TABLE "stream_analytics" ADD CONSTRAINT "stream_analytics_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'viewer_metrics_streamId_fkey'
    ) THEN
        ALTER TABLE "viewer_metrics" ADD CONSTRAINT "viewer_metrics_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
