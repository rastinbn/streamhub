-- Phase 5: Stream Management
--
-- 1. Collapses StreamStatus from { OFFLINE, LIVE, STARTING, ENDING } down to
--    { OFFLINE, LIVE, ENDED } per the finalized lifecycle: a stream session
--    is created OFFLINE, MediaMTX's publish webhook flips it to LIVE, and
--    its unpublish webhook flips it to ENDED. There is no separate
--    transitional STARTING/ENDING state. Existing STARTING rows are
--    collapsed into LIVE and ENDING rows into ENDED (defensive — no such
--    rows are expected to exist yet in any real environment).
-- 2. Replaces the raw, directly-queryable `streamKey` column with
--    `streamKeyHash` (SHA-256 digest). The raw key is now generated
--    in-application, shown to the channel owner exactly once (create /
--    rotate-key), and never persisted — only its digest is stored, which is
--    what the MediaMTX publish webhook looks up against.
-- 3. Adds the remaining Phase 5 metadata fields: `description`, `category`,
--    `thumbnail`, `viewerCount`.
-- 4. Adds indexes to support owner/channel lookups and future
--    live/category browsing.

-- Step 1: StreamStatus enum — swap in the new value set.
CREATE TYPE "StreamStatus_new" AS ENUM ('OFFLINE', 'LIVE', 'ENDED');

ALTER TABLE "streams" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "streams"
  ALTER COLUMN "status" TYPE "StreamStatus_new"
  USING (
    CASE "status"::text
      WHEN 'STARTING' THEN 'LIVE'
      WHEN 'ENDING' THEN 'ENDED'
      ELSE "status"::text
    END
  )::"StreamStatus_new";

ALTER TABLE "streams" ALTER COLUMN "status" SET DEFAULT 'OFFLINE';

DROP TYPE "StreamStatus";
ALTER TYPE "StreamStatus_new" RENAME TO "StreamStatus";

-- Step 2: streamKey (raw, unique) -> streamKeyHash (SHA-256 digest, unique,
-- nullable — null once a key is revoked and not yet rotated).
ALTER TABLE "streams" DROP COLUMN "streamKey";
ALTER TABLE "streams" ADD COLUMN "streamKeyHash" TEXT;
CREATE UNIQUE INDEX "streams_streamKeyHash_key" ON "streams"("streamKeyHash");

-- Step 3: new metadata fields.
ALTER TABLE "streams" ADD COLUMN "description" TEXT;
ALTER TABLE "streams" ADD COLUMN "category" TEXT;
ALTER TABLE "streams" ADD COLUMN "thumbnail" TEXT;
ALTER TABLE "streams" ADD COLUMN "viewerCount" INTEGER NOT NULL DEFAULT 0;

-- Step 4: indexes.
CREATE INDEX "streams_channelId_idx" ON "streams"("channelId");
CREATE INDEX "streams_status_idx" ON "streams"("status");
CREATE INDEX "streams_category_idx" ON "streams"("category");
