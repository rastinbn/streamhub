/*
  Warnings:

  - You are about to drop the column `isPublished` on the `stream_page_layouts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "stream_page_layouts" DROP COLUMN "isPublished",
ADD COLUMN     "draftLayout" JSONB,
ADD COLUMN     "hasPublished" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "layout" DROP NOT NULL;
