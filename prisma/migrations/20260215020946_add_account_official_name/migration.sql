-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "officialName" TEXT;

-- Backfill: existing connected accounts have never been renamed, so current name IS the original
UPDATE "Account" SET "officialName" = "name" WHERE "connectionType" != 'MANUAL' AND "officialName" IS NULL;
