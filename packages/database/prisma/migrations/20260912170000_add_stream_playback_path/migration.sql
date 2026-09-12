-- AlterTable
ALTER TABLE "streams" ADD COLUMN "playbackPath" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "streams_playbackPath_key" ON "streams"("playbackPath");
