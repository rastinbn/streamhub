-- Phase 2: Authentication & Users
--
-- The `users` table was created (in the earlier migrations) with an
-- `avatarUrl` column and no `role`/`bio` columns, but `schema.prisma` had
-- since been hand-edited to rename `avatarUrl` -> `avatar`, add `bio`, and
-- add a `role` enum without a corresponding migration being generated. This
-- migration brings the migration history back in sync with schema.prisma.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'STREAMER', 'MODERATOR', 'ADMIN');

-- AlterTable: rename avatarUrl -> avatar
ALTER TABLE "users" RENAME COLUMN "avatarUrl" TO "avatar";

-- AlterTable: add bio
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- AlterTable: add role (defaults existing rows to USER)
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

-- AlterTable: passwordHash becomes required.
-- Safe for local/dev databases; any pre-existing rows with a NULL
-- passwordHash (there should be none outside of manual testing) are given a
-- placeholder hash of the literal string "unset" run through bcrypt, which
-- cannot be produced by bcrypt.hash() on real input and can never match a
-- real login attempt, so no account becomes accessible without a real
-- password reset.
UPDATE "users" SET "passwordHash" = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8oOtQ0/EOwjR9c9L6.n0YwZ8u4bLXi' WHERE "passwordHash" IS NULL;
ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL;
