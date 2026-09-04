-- Phase 7: Social & Discovery
--
-- 1. New `categories` catalog table (admin-managed via
--    GET/POST/PATCH/DELETE /api/v1/categories). Deliberately independent
--    of `channels.category` / `streams.category` (both remain freeform
--    strings) — see docs/domain-model.md §5 for why a hard FK was not
--    introduced in this phase.
-- 2. Indexes to support Phase 7's browse/search endpoints:
--    - `follows(channelId)` — "who follows channel Y"
--      (GET /channels/:id/followers). The existing
--      `follows_followerId_channelId_key` unique index already covers "who
--      does user X follow" via its leftmost column.
--    - `channels(name)` — channel search (GET /channels?search=).
--    - `streams(title)` — stream title search (GET /streams?search=).

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_name_idx" ON "categories"("name");

CREATE INDEX "follows_channelId_idx" ON "follows"("channelId");
CREATE INDEX "channels_name_idx" ON "channels"("name");
CREATE INDEX "streams_title_idx" ON "streams"("title");
