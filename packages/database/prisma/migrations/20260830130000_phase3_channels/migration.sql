-- Phase 3: Channels & Profiles
--
-- Renames Channel.displayName -> Channel.name (matches the API contract and
-- the frontend's existing channel mock shape) and adds the new profile
-- fields (avatar, banner, category) plus a denormalized followersCount.

-- AlterTable: rename displayName -> name
ALTER TABLE "channels" RENAME COLUMN "displayName" TO "name";

-- AlterTable: add profile fields
ALTER TABLE "channels" ADD COLUMN "avatar" TEXT;
ALTER TABLE "channels" ADD COLUMN "banner" TEXT;
ALTER TABLE "channels" ADD COLUMN "category" TEXT;

-- AlterTable: denormalized follower count (maintained by the follows module
-- in a later phase; defaults to 0 for existing/new rows).
ALTER TABLE "channels" ADD COLUMN "followersCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: channels are browsed/filtered by category.
CREATE INDEX "channels_category_idx" ON "channels"("category");
