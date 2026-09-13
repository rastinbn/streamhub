-- Vod.streamId is nullable: deleting a Stream (e.g. admin hard-delete) keeps
-- the recording (ON DELETE SET NULL), per docs/storage.md. Replaces the
-- mis-applied "rastin" migration that made the column NOT NULL.
ALTER TABLE "vods" ALTER COLUMN "streamId" DROP NOT NULL;
