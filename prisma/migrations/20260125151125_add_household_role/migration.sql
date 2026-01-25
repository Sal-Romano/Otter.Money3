-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('ORGANIZER', 'PARTNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "householdRole" "HouseholdRole" NOT NULL DEFAULT 'PARTNER';
